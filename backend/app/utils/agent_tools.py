"""
Agent tools — callable functions the chatbot can invoke via Groq tool-calling.

Each tool is a plain async function. Groq decides WHEN to call which tool
based on the farmer's actual question — nothing is preloaded or guessed
in advance, which fixes the original bug where only 3 "preferred_crops"
were ever queried (so asking about rice when it wasn't in preferred_crops
returned nothing, even though rice data existed in MongoDB).

IMPORTANT — arrival_date format fix:
Market price documents store arrival_date as a STRING like "25/06/2026"
(DD/MM/YYYY). Sorting this with MongoDB's .sort("arrival_date", -1) sorts
it ALPHABETICALLY, not chronologically — this silently produced wrong
"latest price" and "trend" results. Every tool here that needs real
chronological order parses the string into a real datetime first, then
sorts in Python after fetching.
"""

from datetime import datetime
from app.db.database import get_db
from app.db.models import MARKET_PRICES_COLLECTION, DISEASE_LOGS_COLLECTION
from app.rag.retriever import retrieve_context


def _parse_arrival_date(date_str: str):
    """
    Parse 'DD/MM/YYYY' string into a real datetime for correct chronological
    sorting. Returns datetime.min if parsing fails, so bad/missing dates sort
    last instead of crashing or sorting first by accident.
    """
    try:
        return datetime.strptime(date_str.strip(), "%d/%m/%Y")
    except Exception:
        return datetime.min


async def get_market_price(crop: str, state: str, district: str = None) -> dict:
    """
    TOOL: Get the most recent market price for ANY crop, in ANY state.
    Not limited to the farmer's saved preferred_crops — this is the fix
    for the original bug where rice (not in preferred_crops) never showed up
    even though rice data existed in MongoDB.
    """
    db = get_db()

    query = {
        "state":     {"$regex": state, "$options": "i"},
        "commodity": {"$regex": crop,  "$options": "i"}
    }
    if district:
        query["district"] = {"$regex": district, "$options": "i"}

    # Fetch a reasonable window, then sort correctly in Python by real date
    records = await db[MARKET_PRICES_COLLECTION].find(
        query, {"_id": 0}
    ).limit(200).to_list(length=200)

    if not records:
        return {
            "found":   False,
            "message": f"No price data found for {crop} in {state}."
                       f" The admin may not have uploaded data covering this crop/state yet."
        }

    # Real chronological sort, not string sort
    records.sort(key=lambda r: _parse_arrival_date(r.get("arrival_date", "")), reverse=True)
    latest = records[0]

    return {
        "found":        True,
        "crop":         latest.get("commodity_raw", crop),
        "state":        latest.get("state"),
        "district":     latest.get("district"),
        "market":       latest.get("market"),
        "min_price":    latest.get("min_price"),
        "max_price":    latest.get("max_price"),
        "modal_price":  latest.get("modal_price"),
        "arrival_date": latest.get("arrival_date"),
        "total_markets_with_data": len(records)
    }


async def get_price_trend(crop: str, state: str, days: int = 30) -> dict:
    """
    TOOL: Get price trend for a crop over time, properly sorted by real date
    (fixes the string-sort bug — previously "trend" data wasn't reliably
    ordered chronologically).
    """
    db = get_db()

    query = {
        "state":     {"$regex": state, "$options": "i"},
        "commodity": {"$regex": crop,  "$options": "i"}
    }

    records = await db[MARKET_PRICES_COLLECTION].find(
        query, {"_id": 0}
    ).limit(300).to_list(length=300)

    if not records:
        return {
            "found":   False,
            "message": f"No trend data found for {crop} in {state}."
        }

    # Parse and sort chronologically (oldest -> newest for a clean trend line)
    for r in records:
        r["_parsed_date"] = _parse_arrival_date(r.get("arrival_date", ""))
    records.sort(key=lambda r: r["_parsed_date"])

    # Deduplicate by date (keep one record per day — average if multiple markets)
    by_date = {}
    for r in records:
        date_key = r.get("arrival_date", "unknown")
        by_date.setdefault(date_key, []).append(r["modal_price"])

    trend_points = [
        {"date": date, "avg_modal_price": round(sum(prices) / len(prices), 2)}
        for date, prices in by_date.items()
    ]
    # Sort the final trend points chronologically too
    trend_points.sort(key=lambda p: _parse_arrival_date(p["date"]))

    if not trend_points:
        return {"found": False, "message": f"No usable trend data for {crop} in {state}."}

    first_price = trend_points[0]["avg_modal_price"]
    last_price  = trend_points[-1]["avg_modal_price"]
    change_pct  = round(((last_price - first_price) / first_price) * 100, 1) if first_price else 0

    return {
        "found":          True,
        "crop":           crop,
        "state":          state,
        "data_points":    len(trend_points),
        "trend":          trend_points[-days:] if len(trend_points) > days else trend_points,
        "earliest_price": first_price,
        "latest_price":   last_price,
        "change_percent": change_pct
    }


async def search_farming_documents(query: str) -> dict:
    """
    TOOL: Search ICAR farming documents (RAG) for treatment, fertilizer,
    disease, or cultivation knowledge. Wraps the existing Pinecone retriever.
    """
    result = await retrieve_context(query, top_k=3)

    if not result["found"]:
        return {
            "found":   False,
            "message": "No relevant ICAR document content found for this query."
        }

    return {
        "found":   True,
        "context": result["context"],
        "sources": result["sources"]
    }


async def get_last_disease_detection(username: str) -> dict:
    """
    TOOL: Get the farmer's most recently detected crop disease (from a
    photo they uploaded via /vision/detect-disease), so the chatbot can
    keep discussing it conversationally without the farmer repeating
    themselves.
    """
    db = get_db()

    log = await db[DISEASE_LOGS_COLLECTION].find_one(
        {"username": username},
        {"_id": 0},
        sort=[("detected_at", -1)]
    )

    if not log:
        return {
            "found":   False,
            "message": "This farmer has not uploaded any disease photos yet."
        }

    return {
        "found":      True,
        "disease":    log.get("disease"),
        "severity":   log.get("severity"),
        "confidence": log.get("confidence"),
        "treatment":  log.get("treatment"),
        "prevention": log.get("prevention"),
        "is_healthy": log.get("is_healthy"),
        "detected_at": log.get("detected_at").isoformat() if log.get("detected_at") else None
    }


# ── Tool schemas for Groq function calling ──────────────────────────────────
# These describe each tool to Groq so it can decide which to call and with
# what arguments, based on the farmer's actual question.

TOOL_SCHEMAS = [
    {
        "type": "function",
        "function": {
            "name": "get_market_price",
            "description": (
                "Get the most recent market price for any crop in any Indian state. "
                "Use this whenever the farmer asks about current/today's/latest price "
                "of any commodity, even if it is not one of their usual crops."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "crop":     {"type": "string", "description": "Crop/commodity name, e.g. 'rice', 'tomato'"},
                    "state":    {"type": "string", "description": "Indian state name, e.g. 'Telangana'"},
                    "district": {"type": "string", "description": "Optional district name to narrow the search"}
                },
                "required": ["crop", "state"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_price_trend",
            "description": (
                "Get the price trend over time for a crop in a state — use this when "
                "the farmer asks about price history, trend, whether prices are rising "
                "or falling, or last week's/last month's prices."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "crop":  {"type": "string", "description": "Crop/commodity name"},
                    "state": {"type": "string", "description": "Indian state name"},
                    "days":  {"type": "integer", "description": "Number of recent data points to return, default 30"}
                },
                "required": ["crop", "state"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "search_farming_documents",
            "description": (
                "Search verified ICAR farming documents for disease treatment, "
                "fertilizer dosage, pest management, or cultivation practice knowledge. "
                "Use this for 'how do I treat/manage/control' type questions, NOT for "
                "simple live-data questions like current weather or current price."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "The farming knowledge question to search for"}
                },
                "required": ["query"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_last_disease_detection",
            "description": (
                "Get the farmer's most recently detected crop disease from a photo they "
                "uploaded. Use this when the farmer refers to 'my plant', 'what's wrong "
                "with it', 'that disease', or asks to continue discussing a disease "
                "without naming it explicitly."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "username": {"type": "string", "description": "The farmer's username"}
                },
                "required": ["username"]
            }
        }
    }
]


# Map tool name -> actual callable, used by the ReAct loop to execute calls
TOOL_FUNCTIONS = {
    "get_market_price":            get_market_price,
    "get_price_trend":             get_price_trend,
    "search_farming_documents":    search_farming_documents,
    "get_last_disease_detection":  get_last_disease_detection,
}