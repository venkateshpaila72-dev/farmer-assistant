from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends
from app.utils.news_utils import get_farming_news, get_pest_alerts, get_scheme_news
from app.db.database import get_db
from app.db.models import FARMER_PROFILES_COLLECTION, PEST_ALERTS_COLLECTION, SCHEME_NEWS_COLLECTION
from app.core.security import get_current_user

router = APIRouter()


@router.get("/feed")
async def news_feed(state: str = None, max_results: int = 10):
    """
    Get latest farming news.
    Blends state-specific stories (when a state is given) with general
    India-wide farming news, so the feed is filled out to max_results
    instead of stopping at whatever thin set a narrow state query alone
    turns up — see get_farming_news in utils/news_utils.py for why.
    """
    news = await get_farming_news(state=state, max_results=max_results)

    return {
        "state":          state or "India",
        "total":          len(news),
        "articles":       news,
        "note": "Includes general India farming news alongside state-specific stories" if state else None
    }


@router.get("/farmer/{username}")
async def farmer_news(username: str, current_user: dict = Depends(get_current_user)):
    """
    Get news personalized to farmer's state.
    Auto-loads state from farmer profile.
    Blends state-specific with general India-wide farming news (see
    get_farming_news) so this is never left thin.
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
    Used by disease agent in agentic AI every morning, and by the Pest
    Alerts tab in the News section.

    Pest/disease-outbreak-specific English news for India is genuinely
    thin on GNews's free tier, so an empty live result is common and
    doesn't necessarily mean anything is broken. Rather than show a bare
    "no alerts" every time that happens, we persist the most recent
    successful fetch per state to MongoDB and fall back to it — clearly
    marked as not live — so a farmer always sees the last known relevant
    alerts instead of nothing.
    """
    db = get_db()
    state_key = state or ""  # "" = general/All India, matches the unique index

    live_alerts = await get_pest_alerts(state=state)

    if live_alerts:
        # Live fetch succeeded — persist as the new "last known good" batch
        # for this state, and serve it directly.
        await db[PEST_ALERTS_COLLECTION].update_one(
            {"state_key": state_key},
            {"$set": {
                "state_key":  state_key,
                "state":      state or "India",
                "alerts":     live_alerts,
                "fetched_at": datetime.utcnow()
            }},
            upsert=True
        )
        return {
            "state":     state or "India",
            "total":     len(live_alerts),
            "alerts":    live_alerts,
            "is_live":   True,
            "fetched_at": None
        }

    # Live fetch came back empty — fall back to whatever was last stored
    # for this exact state, so farmers see recent past alerts instead of
    # a stark empty page.
    stored = await db[PEST_ALERTS_COLLECTION].find_one({"state_key": state_key})
    if stored and stored.get("alerts"):
        return {
            "state":      state or "India",
            "total":      len(stored["alerts"]),
            "alerts":     stored["alerts"],
            "is_live":    False,
            "fetched_at": stored.get("fetched_at").isoformat() if stored.get("fetched_at") else None
        }

    # Never fetched anything for this state before — genuinely nothing to show.
    return {
        "state":      state or "India",
        "total":      0,
        "alerts":     [],
        "is_live":    False,
        "fetched_at": None
    }


@router.get("/schemes")
async def scheme_news(state: str = None):
    """
    Get government farming-scheme news (new subsidies, loan waivers,
    direct benefit transfer schemes, insurance schemes, etc).

    This is a supplementary, GNews-sourced "in the news" signal — NOT the
    verified/curated scheme list (that's GET /admins/announcements, where
    an admin has actually reviewed and structured the scheme's benefit/
    eligibility/where-to-apply details). This feed exists so a farmer (or
    an admin) can notice a new scheme worth looking into, same
    live-fetch-with-persisted-fallback pattern as /alerts above.
    """
    db = get_db()
    state_key = state or ""

    live_news = await get_scheme_news(state=state)

    if live_news:
        await db[SCHEME_NEWS_COLLECTION].update_one(
            {"state_key": state_key},
            {"$set": {
                "state_key":  state_key,
                "state":      state or "India",
                "articles":   live_news,
                "fetched_at": datetime.utcnow()
            }},
            upsert=True
        )
        return {
            "state":      state or "India",
            "total":      len(live_news),
            "articles":   live_news,
            "is_live":    True,
            "fetched_at": None
        }

    stored = await db[SCHEME_NEWS_COLLECTION].find_one({"state_key": state_key})
    if stored and stored.get("articles"):
        return {
            "state":      state or "India",
            "total":      len(stored["articles"]),
            "articles":   stored["articles"],
            "is_live":    False,
            "fetched_at": stored.get("fetched_at").isoformat() if stored.get("fetched_at") else None
        }

    return {
        "state":      state or "India",
        "total":      0,
        "articles":   [],
        "is_live":    False,
        "fetched_at": None
    }