import httpx
from app.core.config import settings


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
    """
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
                return []

            data     = response.json()
            articles = data.get("articles", [])

            return [
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

    except Exception as e:
        print(f"GNews fetch error: {e}")
        return []