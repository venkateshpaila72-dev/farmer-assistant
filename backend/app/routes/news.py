from datetime import datetime
from urllib.parse import urlparse
from fastapi import APIRouter, HTTPException, Depends, Query
from fastapi.responses import Response
import httpx
from app.utils.news_utils import get_farming_news, get_pest_alerts, get_scheme_news
from app.db.database import get_db
from app.db.models import FARMER_PROFILES_COLLECTION, PEST_ALERTS_COLLECTION, SCHEME_NEWS_COLLECTION
from app.core.security import get_current_user

router = APIRouter()


# ---------------------------------------------------------------------------
# News feed — global agriculture
# ---------------------------------------------------------------------------
@router.get("/feed")
async def news_feed(max_results: int = 10):
    """
    Global agriculture news — India + worldwide.
    No state filter.
    """
    news = await get_farming_news(max_results=max_results)
    return {
        "total":    len(news),
        "articles": news,
    }


# ---------------------------------------------------------------------------
# Farmer-personalised news (kept for backward compat / chat agent)
# ---------------------------------------------------------------------------
@router.get("/farmer/{username}")
async def farmer_news(username: str, current_user: dict = Depends(get_current_user)):
    """Personalised news based on farmer's state (used by chat agent)."""
    if current_user["role"] != "admin" and current_user["username"] != username:
        raise HTTPException(status_code=403, detail="Not your account")

    db = get_db()
    profile = await db[FARMER_PROFILES_COLLECTION].find_one({"username": username})
    if not profile:
        raise HTTPException(status_code=404, detail="Farmer profile not found")

    state = profile["current_location"]["state"]
    # For the farmer endpoint we still pull India-specific news
    from app.utils.news_utils import _fetch_gnews, _fetch_google_news_rss, _merge_unique, parse_date
    from datetime import timedelta, timezone as tz

    q1 = f"{state} India farming crop agriculture"
    q2 = f"{state} India farmer"
    g1 = await _fetch_gnews(query=q1, max_results=10, country="in")
    g2 = await _fetch_gnews(query=q2, max_results=10, country="in")
    rss = await _fetch_google_news_rss(query=q1, max_results=10, locale="IN")
    articles = _merge_unique(g1, g2, rss, limit=30)
    cutoff = datetime.now(tz.utc) - timedelta(days=21)
    articles = [a for a in articles if parse_date(a.get("published_at")) >= cutoff]
    articles.sort(key=lambda x: parse_date(x.get("published_at")), reverse=True)
    news = articles[:10]

    return {
        "username": username,
        "state":    state,
        "total":    len(news),
        "articles": news,
    }


# ---------------------------------------------------------------------------
# Pest alerts — India only
# ---------------------------------------------------------------------------
@router.get("/alerts")
async def pest_alerts(state: str = None):
    """
    Pest outbreak / crop disease alerts — India only.
    state=None → All India.  state="XYZ" → that state only (no merge).
    Live-fetch-with-persisted-fallback pattern.
    """
    db = get_db()
    state_key = state or ""

    live_alerts = await get_pest_alerts(state=state)

    if live_alerts:
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
            "state":      state or "India",
            "total":      len(live_alerts),
            "alerts":     live_alerts,
            "is_live":    True,
            "fetched_at": None
        }

    stored = await db[PEST_ALERTS_COLLECTION].find_one({"state_key": state_key})
    if stored and stored.get("alerts"):
        return {
            "state":      state or "India",
            "total":      len(stored["alerts"]),
            "alerts":     stored["alerts"],
            "is_live":    False,
            "fetched_at": stored.get("fetched_at").isoformat() if stored.get("fetched_at") else None
        }

    return {
        "state":      state or "India",
        "total":      0,
        "alerts":     [],
        "is_live":    False,
        "fetched_at": None
    }


# ---------------------------------------------------------------------------
# Government schemes — always All India
# ---------------------------------------------------------------------------
@router.get("/schemes")
async def scheme_news(state: str = None):
    """Government scheme news — always All India, ignores state param."""
    state = None
    db = get_db()
    state_key = ""

    live_news = await get_scheme_news(state=state)

    if live_news:
        await db[SCHEME_NEWS_COLLECTION].update_one(
            {"state_key": state_key},
            {"$set": {
                "state_key":  state_key,
                "state":      "India",
                "articles":   live_news,
                "fetched_at": datetime.utcnow()
            }},
            upsert=True
        )
        return {
            "state":      "India",
            "total":      len(live_news),
            "articles":   live_news,
            "is_live":    True,
            "fetched_at": None
        }

    stored = await db[SCHEME_NEWS_COLLECTION].find_one({"state_key": state_key})
    if stored and stored.get("articles"):
        return {
            "state":      "India",
            "total":      len(stored["articles"]),
            "articles":   stored["articles"],
            "is_live":    False,
            "fetched_at": stored.get("fetched_at").isoformat() if stored.get("fetched_at") else None
        }

    return {
        "state":      "India",
        "total":      0,
        "articles":   [],
        "is_live":    False,
        "fetched_at": None
    }


# ---------------------------------------------------------------------------
# Image proxy — relay upstream article images safely
# ---------------------------------------------------------------------------
# Re-use a single, global AsyncClient to keep connections warm, keepalive pools alive, and avoid DNS / Handshake overhead.
_image_http_client = None

def get_image_http_client() -> httpx.AsyncClient:
    global _image_http_client
    if _image_http_client is None:
        _image_http_client = httpx.AsyncClient(
            timeout=10.0,
            follow_redirects=True,
            limits=httpx.Limits(max_keepalive_connections=30, max_connections=50),
        )
    return _image_http_client

def _is_allowed_image_url(url: str) -> bool:
    """Allow any https URL — we validate it's actually an image by Content-Type."""
    try:
        parsed = urlparse(url)
        return parsed.scheme == "https" and bool(parsed.netloc)
    except Exception:
        return False


@router.get("/image-proxy")
async def image_proxy(url: str = Query(..., description="HTTPS image URL to proxy")):
    """
    Relay an external news article image through our backend.
    This avoids CORS / hotlink-protection issues that prevent
    upstream images from loading directly in <img> tags.

    Only proxies HTTPS URLs that actually return image content-types.
    """
    if not _is_allowed_image_url(url):
        raise HTTPException(status_code=400, detail="Invalid image URL")

    try:
        client = get_image_http_client()
        # Use the global HTTP client with standard browser headers to bypass CDN blocks
        resp = await client.get(url, headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
        })

        if resp.status_code != 200:
            raise HTTPException(status_code=502, detail="Upstream image not available")

        content_type = resp.headers.get("content-type", "")
        if not content_type.startswith("image/"):
            raise HTTPException(status_code=502, detail="Upstream did not return an image")

        return Response(
            content=resp.content,
            media_type=content_type,
            headers={
                "Cache-Control": "public, max-age=86400",  # cache 24h
                "X-Content-Type-Options": "nosniff",
            },
        )

    except httpx.HTTPError as e:
        # Print or handle error for debugging
        print(f"Proxy request error for {url}: {e}")
        raise HTTPException(status_code=502, detail="Failed to fetch upstream image")