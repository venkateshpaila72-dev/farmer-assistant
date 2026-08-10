import time
import httpx
import xml.etree.ElementTree as ET
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


def _merge_unique(*article_lists: list, limit: int) -> list:
    """Combine several article lists into one, de-duplicated by URL (falling
    back to title when a URL is missing), preserving the order the lists
    were passed in — so state-specific results land first, general-India
    ones fill in after. Caps at `limit`."""
    seen = set()
    merged = []
    for articles in article_lists:
        for a in articles:
            key = a.get("url") or a.get("title")
            if not key or key in seen:
                continue
            seen.add(key)
            merged.append(a)
            if len(merged) >= limit:
                return merged
    return merged


async def get_farming_news(state: str = None, max_results: int = 10) -> list:
    """
    Fetch farming news using GNews API.
    Blends state-specific results with general India farming news so the
    feed is never left thin just because one narrow query only turned up a
    couple of matches.

    GNews free tier reality:
    - 100 requests/day
    - State-specific queries often return 0, or just 1-2, articles for
      Indian states — narrow "<state> farming crop agriculture"-style
      queries simply don't have deep English-language coverage.
    - General India farming queries return more reliably.

    FIX: this used to stop at the FIRST query tier that returned any
    non-empty result at all, even a single thin match — so a state query
    that found exactly 1 article was treated as "done" and the broader,
    better-populated general-India query was never even tried. That's why
    the feed was consistently stuck showing just one old article instead
    of the up-to-`max_results` the caller actually asked for. Now every
    tier is queried and the results are merged (deduped by URL) so the
    feed is filled out as fully as GNews can support, with state-specific
    stories still surfaced first when they exist.
    """
    state_specific  = []
    state_plus_india = []

    if state:
        state_specific = await _fetch_gnews(
            query=f"{state} farming crop agriculture",
            max_results=max_results
        )
        state_plus_india = await _fetch_gnews(
            query=f"{state} India farmer",
            max_results=max_results
        )

    general = await _fetch_gnews(
        query="India agriculture farming crop",
        max_results=max_results
    )

    return _merge_unique(state_specific, state_plus_india, general, limit=max_results)


async def get_pest_alerts(state: str = None, max_results: int = 5) -> list:
    """
    Fetch pest and disease alert news — blends state-specific with general
    India pest/disease coverage the same way get_farming_news does, rather
    than abandoning the general query the moment a state query finds
    anything at all.

    Note: pest/disease-outbreak-specific English news for India is
    genuinely thin on GNews's free tier — an empty result here is often a
    real "nothing newsworthy today" rather than a bug. That's exactly why
    routes/news.py now persists whatever this DOES find to MongoDB, so the
    /alerts endpoint can fall back to the most recent past batch instead of
    just showing a bare empty state every time today's live query misses.
    """
    state_specific = []
    if state:
        state_specific = await _fetch_gnews(
            query=f"{state} crop pest disease",
            max_results=max_results
        )

    general = await _fetch_gnews(
        query="India crop pest disease outbreak farmer",
        max_results=max_results
    )

    articles = _merge_unique(state_specific, general, limit=max_results)

    return articles


async def get_scheme_news(state: str = None, max_results: int = 5) -> list:
    """
    Fetch government farming-scheme news — blends state-specific with
    general India scheme coverage the same way get_farming_news and
    get_pest_alerts do, PLUS Google News RSS as a second, quota-free
    source (GNews's free tier caps at 100 requests/day; Google News RSS
    has no such cap, so it widens coverage without extra cost — at the
    tradeoff of being an unofficial, unversioned feed that Google could
    change without notice, and often skewing toward slightly older items
    for narrow queries rather than breaking news).

    This is a supplementary, informal signal for NEW schemes (subsidies,
    loan waivers, direct benefit transfers, insurance schemes) — it's
    news-sourced, not an official government feed, so results here should
    be shown to farmers as "in the news" rather than as verified/curated
    scheme info. The admin-curated ANNOUNCEMENTS_COLLECTION (see
    routes/admin.py) is the trustworthy, structured source for schemes
    that have actually been reviewed and turned into a proper scheme card
    (benefit amount, eligibility, where to apply) — this feed exists to
    help an admin notice a new scheme worth reviewing and promoting there
    (see draft_scheme_from_news in groq_utils.py), not to replace that
    review step.
    """
    state_specific = []
    if state:
        state_specific = await _fetch_gnews(
            query=f"{state} farmer government scheme subsidy",
            max_results=max_results
        )

    general = await _fetch_gnews(
        query="India farmer government scheme subsidy yojana",
        max_results=max_results
    )

    rss_query = f"{state} farmer scheme" if state else "India farmer government scheme"
    rss_results = await _fetch_google_news_rss(query=rss_query, max_results=max_results)

    articles = _merge_unique(state_specific, general, rss_results, limit=max_results)

    return articles


async def _fetch_google_news_rss(query: str, max_results: int = 10) -> list:
    """
    Internal helper — Google News RSS (news.google.com/rss/search), a
    free, no-API-key, no-daily-cap feed. Unofficial (not a documented
    Google API — could change format without notice) but stable in
    practice. Returns the same article shape as _fetch_gnews so callers
    can merge them interchangeably, except `description` and `image` are
    always None — the RSS format doesn't include either, only title/link/
    source/date.
    """
    cache_key = f"rss::{query}::{max_results}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    params = {
        "q":    query,
        "hl":   "en-IN",
        "gl":   "IN",
        "ceid": "IN:en",
    }

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.get("https://news.google.com/rss/search", params=params)

            if response.status_code != 200:
                print(f"Google News RSS error: {response.status_code} for query '{query}'")
                _cache_set(cache_key, [], is_failure=True)
                return []

            root  = ET.fromstring(response.text)
            items = root.findall("./channel/item")[:max_results]

            result = []
            for item in items:
                title = item.findtext("title")
                if not title:
                    continue
                # Google News RSS <source> is a child element with the
                # publisher name as its text content (falls back to the
                # generic "Google News" label if that structure ever
                # changes, rather than crashing this one item).
                source_el = item.find("source")
                source    = source_el.text if source_el is not None else "Google News"

                result.append({
                    "title":        title,
                    "description":  None,
                    "url":          item.findtext("link"),
                    "source":       source,
                    "published_at": item.findtext("pubDate"),
                    "image":        None,
                })

            _cache_set(cache_key, result, is_failure=False)
            return result

    except Exception as e:
        print(f"Google News RSS fetch error ({type(e).__name__}): {e}")
        _cache_set(cache_key, [], is_failure=True)
        return []


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