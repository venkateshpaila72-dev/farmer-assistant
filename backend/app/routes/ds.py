from fastapi import APIRouter, HTTPException
from app.db.database import get_db
from app.db.models import MARKET_PRICES_COLLECTION

router = APIRouter()


@router.get("/price-trends")
async def price_trends(state: str):
    """
    Get price trend data for all commodities in a state.
    Used for price trend charts on DS dashboard.
    """
    db = get_db()

    pipeline = [
        {"$match": {"state": {"$regex": state, "$options": "i"}}},
        {"$group": {
            "_id": {
                "commodity":    "$commodity_raw",
                "arrival_date": "$arrival_date"
            },
            "avg_price": {"$avg": "$modal_price"}
        }},
        {"$sort": {"_id.arrival_date": -1}},
        {"$limit": 500}
    ]

    results = await db[MARKET_PRICES_COLLECTION].aggregate(pipeline).to_list(length=500)

    if not results:
        raise HTTPException(
            status_code=404,
            detail=f"No price data for {state}. Admin needs to upload dataset."
        )

    # Restructure for chart
    chart_data = {}
    for r in results:
        commodity = r["_id"]["commodity"]
        date      = r["_id"]["arrival_date"]
        if commodity not in chart_data:
            chart_data[commodity] = []
        chart_data[commodity].append({
            "date":  date,
            "price": round(r["avg_price"], 2)
        })

    # Sort each commodity by date
    for commodity in chart_data:
        chart_data[commodity].sort(key=lambda x: x["date"])

    return {
        "state":      state,
        "chart_data": chart_data
    }


@router.get("/top-commodities")
async def top_commodities(state: str, limit: int = 10):
    """
    Get top commodities by average price in a state.
    Used for bar chart on DS dashboard.
    """
    db = get_db()

    pipeline = [
        {"$match": {"state": {"$regex": state, "$options": "i"}}},
        {"$group": {
            "_id":           "$commodity_raw",
            "avg_price":     {"$avg": "$modal_price"},
            "max_price":     {"$max": "$modal_price"},
            "min_price":     {"$min": "$modal_price"},
            "total_records": {"$sum": 1}
        }},
        {"$sort":  {"avg_price": -1}},
        {"$limit": limit}
    ]

    results = await db[MARKET_PRICES_COLLECTION].aggregate(pipeline).to_list(length=limit)

    if not results:
        raise HTTPException(status_code=404, detail=f"No data for {state}")

    return {
        "state": state,
        "commodities": [
            {
                "commodity":   r["_id"],
                "avg_price":   round(r["avg_price"], 2),
                "max_price":   round(r["max_price"], 2),
                "min_price":   round(r["min_price"], 2),
                "data_points": r["total_records"]
            }
            for r in results
        ]
    }


@router.get("/market-summary")
async def market_summary(state: str):
    """Overall market summary for a state."""
    db = get_db()

    total = await db[MARKET_PRICES_COLLECTION].count_documents(
        {"state": {"$regex": state, "$options": "i"}}
    )

    if total == 0:
        raise HTTPException(
            status_code=404,
            detail=f"No market data for {state}"
        )

    expensive = await db[MARKET_PRICES_COLLECTION].find_one(
        {"state": {"$regex": state, "$options": "i"}},
        {"_id": 0, "commodity_raw": 1, "modal_price": 1, "arrival_date": 1},
        sort=[("modal_price", -1)]
    )

    cheapest = await db[MARKET_PRICES_COLLECTION].find_one(
        {"state": {"$regex": state, "$options": "i"}},
        {"_id": 0, "commodity_raw": 1, "modal_price": 1, "arrival_date": 1},
        sort=[("modal_price", 1)]
    )

    commodities = await db[MARKET_PRICES_COLLECTION].distinct(
        "commodity_raw",
        {"state": {"$regex": state, "$options": "i"}}
    )

    return {
        "state":             state,
        "total_records":     total,
        "total_commodities": len(commodities),
        "most_expensive":    expensive,
        "cheapest":          cheapest
    }