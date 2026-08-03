"""
LangChain tool definitions for the farmer-chat ReAct agent.

Each tool here is a thin @tool wrapper around the SAME underlying
implementation in app/utils/agent_tools.py (get_market_price,
get_price_trend, get_last_disease_detection) — that module's careful
chronological date-parsing and Mongo query logic is reused as-is, not
rewritten, so tool BEHAVIOR is guaranteed identical to before. Only the
calling convention changes: these are real LangChain StructuredTool
objects (via the @tool decorator + Pydantic schemas), usable with
.bind_tools() on any LangChain chat model and with LangGraph's ToolNode.

search_farming_documents is the one exception — it's rebuilt on top of
the new PineconeHostedRetriever (a genuine LangChain BaseRetriever) rather
than calling retrieve_context() directly, so RAG is backed by a real
LangChain retrieval abstraction end to end.
"""

from typing import Optional
from pydantic import BaseModel, Field
from langchain_core.tools import tool

from app.utils.agent_tools import (
    get_market_price as _get_market_price,
    get_price_trend as _get_price_trend,
    get_last_disease_detection as _get_last_disease_detection,
)
from app.rag.langchain_retriever import get_farming_docs_retriever

_farming_docs_retriever = get_farming_docs_retriever(top_k=3)


class GetMarketPriceInput(BaseModel):
    crop: str = Field(..., description="Crop/commodity name, e.g. 'rice', 'tomato'")
    state: str = Field(..., description="Indian state name, e.g. 'Telangana'")
    district: Optional[str] = Field(None, description="Optional district name to narrow the search")


@tool("get_market_price", args_schema=GetMarketPriceInput)
async def get_market_price(crop: str, state: str, district: Optional[str] = None) -> dict:
    """Get the most recent market price for any crop in any Indian state.
    Use this whenever the farmer asks about current/today's/latest price
    of any commodity, even if it is not one of their usual crops."""
    return await _get_market_price(crop=crop, state=state, district=district)


class GetPriceTrendInput(BaseModel):
    crop: str = Field(..., description="Crop/commodity name")
    state: str = Field(..., description="Indian state name")
    days: int = Field(30, description="Number of recent data points to return, default 30")


@tool("get_price_trend", args_schema=GetPriceTrendInput)
async def get_price_trend(crop: str, state: str, days: int = 30) -> dict:
    """Get the price trend over time for a crop in a state — use this when
    the farmer asks about price history, trend, whether prices are rising
    or falling, or last week's/last month's prices."""
    return await _get_price_trend(crop=crop, state=state, days=days)


class SearchFarmingDocumentsInput(BaseModel):
    query: str = Field(..., description="The farming knowledge question to search for")


@tool("search_farming_documents", args_schema=SearchFarmingDocumentsInput)
async def search_farming_documents(query: str) -> dict:
    """Search verified ICAR farming documents for disease treatment,
    fertilizer dosage, pest management, or cultivation practice knowledge.
    Use this for 'how do I treat/manage/control' type questions, NOT for
    simple live-data questions like current weather or current price."""
    docs = await _farming_docs_retriever.ainvoke(query)

    if not docs:
        return {
            "found": False,
            "message": "No relevant ICAR document content found for this query.",
        }

    context = "\n\n".join(d.page_content for d in docs)
    sources = []
    for d in docs:
        src = d.metadata.get("source", "unknown")
        if src not in sources:
            sources.append(src)

    return {"found": True, "context": context, "sources": sources}


class GetLastDiseaseDetectionInput(BaseModel):
    username: str = Field(..., description="The farmer's username")


@tool("get_last_disease_detection", args_schema=GetLastDiseaseDetectionInput)
async def get_last_disease_detection(username: str) -> dict:
    """Get the farmer's most recently detected crop disease from a photo
    they uploaded. Use this when the farmer refers to 'my plant', 'what's
    wrong with it', 'that disease', or asks to continue discussing a
    disease without naming it explicitly."""
    return await _get_last_disease_detection(username=username)


# The full toolset the chat agent binds to the model, and the lookup map
# the graph uses for the malformed-tool-call recovery path (see
# langgraph_chat_agent.py) — mirrors agent_tools.py's TOOL_FUNCTIONS shape.
CHAT_TOOLS = [
    get_market_price,
    get_price_trend,
    search_farming_documents,
    get_last_disease_detection,
]

CHAT_TOOLS_BY_NAME = {t.name: t for t in CHAT_TOOLS}