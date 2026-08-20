import asyncio
import time
import httpx
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from bs4 import BeautifulSoup
from app.core.config import settings

# ---------------------------------------------------------------------------
# In-memory cache
# ---------------------------------------------------------------------------
_CACHE_TTL_SECONDS       = 30 * 60   # 30 min for successful results
_FAILURE_BACKOFF_SECONDS = 5 * 60    # 5 min cooldown after a failure
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


# ---------------------------------------------------------------------------
# Image extraction cache  (separate from article cache — 6 h TTL)
# ---------------------------------------------------------------------------
_IMAGE_CACHE_TTL = 6 * 60 * 60        # 6 hours
_image_cache: dict = {}                # url -> (timestamp, image_url | None)


def _img_cache_get(url: str):
    entry = _image_cache.get(url)
    if not entry:
        return ...
    ts, img = entry
    if time.time() - ts > _IMAGE_CACHE_TTL:
        return ...
    return img


def _img_cache_set(url: str, img: str | None):
    _image_cache[url] = (time.time(), img)


# ---------------------------------------------------------------------------
# OG / Twitter image extraction
# ---------------------------------------------------------------------------
async def extract_article_image(url: str) -> str | None:
    """Fetch an article page and extract the best social-share image.

    Priority: og:image  →  twitter:image  →  None.
    Returns None on any failure (timeout, bad HTML, missing tags).
    Results are cached for 6 h.
    """
    if not url:
        return None

    cached = _img_cache_get(url)
    if cached is not ...:
        return cached

    try:
        async with httpx.AsyncClient(timeout=8, follow_redirects=True) as client:
            resp = await client.get(url, headers={
                "User-Agent": (
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/120.0.0.0 Safari/537.36"
                ),
                "Accept": "text/html,application/xhtml+xml,*/*;q=0.8",
            })
            if resp.status_code != 200:
                _img_cache_set(url, None)
                return None

            # Only parse the first 200 KB — meta tags are always in <head>.
            html = resp.text[:200_000]
            soup = BeautifulSoup(html, "lxml")

            # 1. og:image
            og = soup.find("meta", property="og:image")
            if og and og.get("content"):
                img = og["content"].strip()
                if img.startswith("http"):
                    _img_cache_set(url, img)
                    return img

            # 2. twitter:image
            tw = (
                soup.find("meta", attrs={"name": "twitter:image"})
                or soup.find("meta", attrs={"property": "twitter:image"})
            )
            if tw and tw.get("content"):
                img = tw["content"].strip()
                if img.startswith("http"):
                    _img_cache_set(url, img)
                    return img

            _img_cache_set(url, None)
            return None

    except Exception as exc:
        print(f"Image extraction failed for {url}: {type(exc).__name__}: {exc}")
        _img_cache_set(url, None)
        return None


async def enrich_articles_with_images(articles: list) -> list:
    """For articles missing an image, attempt to scrape one from the page.

    Uses a semaphore to cap concurrent HTTP requests at 5.
    Never raises — individual failures leave image as None.
    """
    sem = asyncio.Semaphore(5)

    async def _fill(article: dict):
        if article.get("image"):
            return  # already has one (GNews)
        url = article.get("url")
        if not url:
            return
        async with sem:
            img = await extract_article_image(url)
        if img:
            article["image"] = img

    await asyncio.gather(*[_fill(a) for a in articles], return_exceptions=True)
    return articles


def _merge_unique(*article_lists: list, limit: int) -> list:
    """De-duplicate articles by URL (fallback: title), preserve order, cap at limit."""
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


# ---------------------------------------------------------------------------
# Date parsing
# ---------------------------------------------------------------------------
def parse_date(iso_str: str) -> datetime:
    """Parse ISO-8601 / RFC-822 date string to tz-aware UTC datetime.
    Returns datetime.min (UTC) for None/invalid values."""
    if not iso_str:
        return datetime.min.replace(tzinfo=timezone.utc)
    try:
        clean = iso_str.replace("Z", "+00:00")
        dt = datetime.fromisoformat(clean)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except Exception:
        return datetime.min.replace(tzinfo=timezone.utc)


# ---------------------------------------------------------------------------
# Public fetchers
# ---------------------------------------------------------------------------
async def get_farming_news(max_results: int = 10) -> list:
    """
    Main news feed for the News tab — ALL INDIA farming/agriculture news.

    Hybrid source strategy:
      1. GNews is tried first (better metadata: images, descriptions) but
         has a daily quota, so it can silently return [] once exhausted.
      2. Google News RSS (no key, no daily cap) is always fetched too and
         acts as the reliable fallback/backbone — if GNews comes back
         empty (quota hit or API error) we lean on RSS harder by pulling
         extra results so the feed still fills up.
      3. Both are merged (GNews first so its richer articles are kept
         when duplicates exist), de-duplicated by URL, restricted to the
         last 21 days, and sorted newest-first.

    Strictly India-scoped: GNews uses country="in", RSS uses locale="IN".
    """
    q1 = "India agriculture farming crop"
    q2 = "India farmer news"

    gnews_a, gnews_b = await asyncio.gather(
        _fetch_gnews(query=q1, max_results=max_results, country="in"),
        _fetch_gnews(query=q2, max_results=max_results, country="in"),
    )
    gnews_articles = _merge_unique(gnews_a, gnews_b, limit=max_results * 2)

    # GNews quota/error → lean harder on RSS to make sure the feed isn't thin.
    rss_max = max_results if gnews_articles else max_results * 2

    rss_a, rss_b = await asyncio.gather(
        _fetch_google_news_rss(query=q1, max_results=rss_max, locale="IN"),
        _fetch_google_news_rss(query=q2, max_results=rss_max, locale="IN"),
    )
    rss_articles = _merge_unique(rss_a, rss_b, limit=rss_max * 2)

    # GNews first (kept on duplicate) so richer articles win the merge.
    articles = _merge_unique(gnews_articles, rss_articles, limit=max_results * 4)

    cutoff = datetime.now(timezone.utc) - timedelta(days=21)
    filtered = [a for a in articles if parse_date(a.get("published_at")) >= cutoff]
    filtered.sort(key=lambda x: parse_date(x.get("published_at")), reverse=True)
    result = filtered[:max_results]
    await enrich_articles_with_images(result)
    return result


async def get_pest_alerts(state: str = None, max_results: int = 12) -> list:
    """
    INDIA-ONLY pest/disease alerts.
    - state=None  → India-wide alerts.
    - state="XYZ" → alerts for that Indian state ONLY (no general India merge).
    Always uses country="in" for GNews and locale="IN" for RSS.
    Filters to last 90 days, sorted newest-first.
    """
    if state:
        query = f"{state} India crop pest disease outbreak"
        gnews_results = await _fetch_gnews(query=query, max_results=max_results, country="in")
        rss_results   = await _fetch_google_news_rss(query=query, max_results=max_results, locale="IN")
        alerts = _merge_unique(gnews_results, rss_results, limit=max_results * 2)
    else:
        query = "India crop pest disease outbreak farmer"
        gnews_results = await _fetch_gnews(query=query, max_results=max_results, country="in")
        rss_results   = await _fetch_google_news_rss(query=query, max_results=max_results, locale="IN")
        alerts = _merge_unique(gnews_results, rss_results, limit=max_results * 2)

    cutoff = datetime.now(timezone.utc) - timedelta(days=90)
    filtered = [a for a in alerts if parse_date(a.get("published_at")) >= cutoff]
    filtered.sort(key=lambda x: parse_date(x.get("published_at")), reverse=True)
    result = filtered[:max_results]
    await enrich_articles_with_images(result)
    return result


async def get_scheme_news(state: str = None, max_results: int = 12) -> list:
    """
    Government scheme news — always All India, ignores state param.
    Filters to last 90 days, sorted newest-first.
    """
    state = None  # force nationwide

    general = await _fetch_gnews(
        query="India farmer government scheme subsidy yojana",
        max_results=max_results,
        country="in"
    )
    rss_results = await _fetch_google_news_rss(
        query="India farmer government scheme",
        max_results=max_results,
        locale="IN"
    )

    articles = _merge_unique(general, rss_results, limit=max_results * 2)

    cutoff = datetime.now(timezone.utc) - timedelta(days=90)
    filtered = [a for a in articles if parse_date(a.get("published_at")) >= cutoff]
    filtered.sort(key=lambda x: parse_date(x.get("published_at")), reverse=True)
    result = filtered[:max_results]
    await enrich_articles_with_images(result)
    return result


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------
async def _fetch_google_news_rss(
    query: str,
    max_results: int = 10,
    locale: str = None,          # "IN" for India, None for global
) -> list:
    """Google News RSS — free, no API key, no daily cap."""
    cache_key = f"rss::{query}::{max_results}::{locale}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    if locale and locale.upper() == "IN":
        params = {"q": query, "hl": "en-IN", "gl": "IN", "ceid": "IN:en"}
    else:
        params = {"q": query, "hl": "en", "gl": "US"}

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
                source_el = item.find("source")
                source    = source_el.text if source_el is not None else "Google News"

                pub_date_raw = item.findtext("pubDate")
                pub_date_iso = None
                if pub_date_raw:
                    try:
                        dt = parsedate_to_datetime(pub_date_raw)
                        pub_date_iso = dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
                    except Exception:
                        pub_date_iso = pub_date_raw

                result.append({
                    "title":        title,
                    "description":  None,
                    "url":          item.findtext("link"),
                    "source":       source,
                    "published_at": pub_date_iso,
                    "image":        None,
                })

            _cache_set(cache_key, result, is_failure=False)
            return result

    except Exception as e:
        print(f"Google News RSS fetch error ({type(e).__name__}): {e}")
        _cache_set(cache_key, [], is_failure=True)
        return []


async def _fetch_gnews(
    query: str,
    max_results: int = 10,
    country: str = None,         # "in" for India, None for global
) -> list:
    """GNews API helper.  country=None → no country filter (global)."""
    cache_key = f"gnews::{query}::{max_results}::{country}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    params = {
        "q":      query,
        "lang":   "en",
        "max":    max_results,
        "apikey": settings.GNEWS_API_KEY,
    }
    if country:
        params["country"] = country   # e.g. "in" for India

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.get(
                f"{settings.GNEWS_BASE_URL}/search",
                params=params
            )

            if response.status_code != 200:
                if response.status_code in (403, 429):
                    # Quota exhausted — expected under free-tier limits.
                    # Callers fall back to RSS when GNews comes back empty.
                    print(f"GNews quota exceeded ({response.status_code}) for query '{query}' — falling back to RSS")
                else:
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
                    "image":        a.get("image"),
                }
                for a in articles
                if a.get("title")
            ]
            _cache_set(cache_key, result, is_failure=False)
            return result

    except Exception as e:
        print(f"GNews fetch error ({type(e).__name__}): {e}")
        _cache_set(cache_key, [], is_failure=True)
        return []