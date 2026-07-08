from fastapi import APIRouter, HTTPException, Depends
from app.utils.news_utils import get_farming_news, get_pest_alerts
from app.db.database import get_db
from app.db.models import FARMER_PROFILES_COLLECTION
from app.core.security import get_current_user

router = APIRouter()


@router.get("/feed")
async def news_feed(state: str = None, max_results: int = 10):
    """
    Get latest farming news.
    Tries state-specific first, falls back to general India farming news.
    """
    news = await get_farming_news(state=state, max_results=max_results)

    return {
        "state":          state or "India",
        "total":          len(news),
        "articles":       news,
        "note": "Showing general India farming news if state-specific unavailable" if not state else None
    }


@router.get("/farmer/{username}")
async def farmer_news(username: str, current_user: dict = Depends(get_current_user)):
    """
    Get news personalized to farmer's state.
    Auto-loads state from farmer profile.
    Falls back to general India news if state-specific unavailable.
    """
    if current_user["role"] != "admin" and current_user["username"] != username:
        raise HTTPException(status_code=403, detail="Not your account")

    db = get_db()

    profile = await db[FARMER_PROFILES_COLLECTION].find_one({"username": username})
    if not profile:
        raise HTTPException(status_code=404, detail="Farmer profile not found")

    state = profile["current_location"]["state"]
    news  = await get_farming_news(state=state, max_results=10)

    return {
        "username": username,
        "state":    state,
        "total":    len(news),
        "articles": news
    }


@router.get("/alerts")
async def pest_alerts(state: str = None):
    """
    Get pest outbreak and crop disease alert news.
    Used by disease agent in agentic AI every morning.
    """
    alerts = await get_pest_alerts(state=state)

    return {
        "state":  state or "India",
        "total":  len(alerts),
        "alerts": alerts
    }