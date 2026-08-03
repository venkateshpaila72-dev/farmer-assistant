import time
import httpx
from app.core.config import settings

# In-memory cache, keyed by the exact query string — this is the actual
# unit of GNews API cost, and the same few queries (per state, plus the
# general India fallback) get hit on almost every dashboard load, chat
# session, and news page visit across every farmer. Without this, a
# handful of active users can exhaust GNews's free-tier daily quota fast,
# which is exactly what was happening (repeated blank "GNews fetch error:"
# lines — see _fetch_gnews below for why those were blank).
#
# Note: this is a single-process in-memory cache. Fine for the current
# single-uvicorn-worker deployment; would need moving to Mongo/Redis if
# this ever runs with multiple worker processes.
_CACHE_TTL_SECONDS       = 30 * 60  # successful results are reused for 30 min
_FAILURE_BACKOFF_SECONDS = 5 * 60   # after a failure, don't retry the same query for 5 min
_cache: dict = {}  # query_key -> (timestamp, articles, is_failure)


def _cache_get(key: str):
    entry = _cache.get(key)
    if not entry:
        return None
    ts, articles, is_failure = entry
    ttl = _FAILURE_BACKOFF_SECONDS if is_failure else _CACHE_TTL_SECONDS
    if time.time() - ts > ttl:
        return None
    return articles


def _cache_set(key: str, articles: list, is_failure: bool = False):
    _cache[key] = (time.time(), articles, is_failure)


async def get_farming_news(state: str = None, max_results: int = 10) -> list:
    """
    Fetch farming news using GNews API.
    State-specific when possible, falls back to general India farming news.

    GNews free tier reality:
    - 100 requests/day
    - State-specific queries often return 0 for Indian states
    - General India farming queries work reliably
    """

    articles = []

    # Try 1 — state specific query
    if state:
        articles = await _fetch_gnews(
            query=f"{state} farming crop agriculture",
            max_results=max_results
        )

    # Try 2 — if state returned 0, try state + India
    if not articles and state:
        articles = await _fetch_gnews(
            query=f"{state} India farmer",
            max_results=max_results
        )

    # Try 3 — fallback to general India farming news
    if not articles:
        articles = await _fetch_gnews(
            query="India agriculture farming crop",
            max_results=max_results
        )

    return articles


async def get_pest_alerts(state: str = None) -> list:
    """
    Fetch pest and disease alert news.
    Falls back to general India pest news if state-specific returns 0.
    """
    articles = []

    if state:
        articles = await _fetch_gnews(
            query=f"{state} crop pest disease",
            max_results=5
        )

    if not articles:
        articles = await _fetch_gnews(
            query="India crop pest disease outbreak farmer",
            max_results=5
        )

    return articles


async def _fetch_gnews(query: str, max_results: int = 10) -> list:
    """
    Internal helper — calls GNews API with given query.
    Returns empty list on any error (never crashes).
    Checks the cache first — see _cache_get/_cache_set above.
    """
    cache_key = f"{query}::{max_results}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    params = {
        "q":      query,
        "lang":   "en",
        "max":    max_results,
        "apikey": settings.GNEWS_API_KEY
    }

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.get(
                f"{settings.GNEWS_BASE_URL}/search",
                params=params
            )

            if response.status_code != 200:
                print(f"GNews error: {response.status_code} for query '{query}'")
                _cache_set(cache_key, [], is_failure=True)
                return []

            data     = response.json()
            articles = data.get("articles", [])

            result = [
                {
                    "title":        a.get("title"),
                    "description":  a.get("description"),
                    "url":          a.get("url"),
                    "source":       a.get("source", {}).get("name"),
                    "published_at": a.get("publishedAt"),
                    "image":        a.get("image")
                }
                for a in articles
                if a.get("title")  # skip articles with no title
            ]
            _cache_set(cache_key, result, is_failure=False)
            return result

    except Exception as e:
        # str(e) is frequently EMPTY for httpx timeout/connection errors —
        # that's what caused the blank "GNews fetch error: " log lines.
        # The exception TYPE is where the real information is here.
        print(f"GNews fetch error ({type(e).__name__}): {e}")
        _cache_set(cache_key, [], is_failure=True)
        return []