import asyncio
import logging
import time
import httpx
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from bs4 import BeautifulSoup
from app.core.config import settings

# ---------------------------------------------------------------------------
# Structured logging
# ---------------------------------------------------------------------------
# Uses the standard logging module (module-level logger, no basicConfig here
# — handler/formatter config is left to the app entrypoint / uvicorn so this
# module doesn't clobber global logging setup). Every log call is structured
# as key=value pairs so log aggregators (or plain grep) can filter by
# source/query/status without parsing free-text sentences.
logger = logging.getLogger("app.news")


def _log_fetch(source: str, query: str, count: int, ok: bool, detail: str = "") -> None:
    """Structured log line for a single source fetch attempt."""
    status = "ok" if ok else "fail"
    msg = f'news_fetch source="{source}" query="{query}" status={status} count={count}'
    if detail:
        msg += f' detail="{detail}"'
    if ok:
        logger.info(msg)
    else:
        logger.warning(msg)


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


def _normalize_to_iso_z(raw: str | None) -> str | None:
    """Normalize a date string from any upstream source (NewsData.io's
    'YYYY-MM-DD HH:MM:SS', Currents' ISO-with-offset, RFC-822, etc.) into the
    same 'YYYY-MM-DDTHH:MM:SSZ' shape GNews/RSS already produce, so
    parse_date() and the frontend's `new Date(iso)` both handle every
    source identically. Returns None (never raises) if nothing parses —
    callers already treat a missing date as datetime.min via parse_date().
    """
    if not raw:
        return None
    raw = raw.strip()

    # 1. ISO-8601 (with or without 'Z' / offset) — covers Currents API.
    try:
        clean = raw.replace("Z", "+00:00")
        dt = datetime.fromisoformat(clean)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
    except Exception:
        pass

    # 2. NewsData.io's "YYYY-MM-DD HH:MM:SS" (no timezone, assumed UTC).
    try:
        dt = datetime.strptime(raw, "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)
        return dt.isoformat().replace("+00:00", "Z")
    except Exception:
        pass

    # 3. RFC-822 (Google News RSS / generic RSS <pubDate>) as a last resort.
    try:
        dt = parsedate_to_datetime(raw)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
    except Exception:
        pass

    return None


# ---------------------------------------------------------------------------
# Curated agriculture / government RSS feeds (Tier 2 — no key, no quota)
# ---------------------------------------------------------------------------
# These are pre-filtered to agriculture/government-scheme content, so they
# don't take a search query — we just pull latest items from each and merge.
# NOTE: verify each URL still resolves before relying on it in production —
# publisher RSS endpoints move without notice. A dead/renamed feed fails
# closed (logged + skipped) and never breaks the overall response; see
# _fetch_curated_rss().
CURATED_RSS_FEEDS = [
    {"name": "Krishi Jagran",  "url": "https://www.krishijagran.com/rss/latest-news.xml"},
    {"name": "PIB — Agriculture", "url": "https://pib.gov.in/RssMain.aspx?ModId=6&Mid=0"},
    {"name": "Down To Earth — Agriculture", "url": "https://www.downtoearth.org.in/rss/agriculture"},
]


# ---------------------------------------------------------------------------
# Shared 4-tier fan-out (used by all three public fetchers below)
# ---------------------------------------------------------------------------
async def _fetch_tiered_articles(
    queries: list[str],
    max_results: int,
    country: str = "in",       # GNews/NewsData/Currents country code
    locale: str = "IN",        # Google News RSS locale
) -> list:
    """
    Source priority chain (matches the architecture decided on for the news
    module — see project notes): each tier is only pulled if the previous
    tiers haven't already produced a comfortable buffer, so quota-limited
    sources aren't hit on every request once cheaper tiers are enough.

      Tier 1 — GNews + NewsData.io, fetched in parallel. Both are quota-
               limited but have the richest metadata (images, descriptions).
      Tier 2 — Curated agriculture/government RSS (Krishi Jagran, PIB,
               Down To Earth, ...). No key, no quota, pre-filtered content.
      Tier 3 — Google News RSS. No key, no quota, generic backbone — the
               same reliable fallback the module always had.
      Tier 4 — Currents API. Optional (CURRENTS_API_KEY may be unset), and
               only ever called as an absolute last resort.

    Every tier is merge-deduped by URL into the running list, earlier
    (richer) tiers winning on duplicate URLs. Returns the merged, NOT YET
    date-filtered/sorted list — callers apply their own cutoff (21 vs 90
    days) and slice to max_results, same as before this change.
    """
    buffer_target = max_results * 2  # keep enough headroom for date-cutoff filtering downstream

    # ---- Tier 1: GNews + NewsData.io in parallel ----
    tier1_calls = (
        [_fetch_gnews(query=q, max_results=max_results, country=country) for q in queries]
        + [_fetch_newsdata(query=q, max_results=max_results, country=country) for q in queries]
    )
    tier1_results = await asyncio.gather(*tier1_calls)
    articles = _merge_unique(*tier1_results, limit=max_results * 4)

    # ---- Tier 2: curated agriculture / government RSS ----
    if len(articles) < buffer_target:
        curated = await _fetch_curated_rss(max_results_per_feed=max_results)
        articles = _merge_unique(articles, curated, limit=max_results * 6)

    # ---- Tier 3: Google News RSS (pulled harder the thinner things are) ----
    if len(articles) < buffer_target:
        rss_max = max_results if articles else max_results * 2
        rss_calls = [_fetch_google_news_rss(query=q, max_results=rss_max, locale=locale) for q in queries]
        rss_results = await asyncio.gather(*rss_calls)
        rss_articles = _merge_unique(*rss_results, limit=rss_max * 2)
        articles = _merge_unique(articles, rss_articles, limit=max_results * 8)

    # ---- Tier 4: Currents API — optional, absolute last resort ----
    if len(articles) < max_results and settings.CURRENTS_API_KEY:
        currents_country = country.upper() if country else None
        currents_calls = [_fetch_currents(query=q, max_results=max_results, country=currents_country) for q in queries]
        currents_results = await asyncio.gather(*currents_calls)
        currents_articles = _merge_unique(*currents_results, limit=max_results * 2)
        articles = _merge_unique(articles, currents_articles, limit=max_results * 9)

    return articles


# ---------------------------------------------------------------------------
# Public fetchers
# ---------------------------------------------------------------------------
async def get_farming_news(max_results: int = 10) -> list:
    """
    Main news feed for the News tab — ALL INDIA farming/agriculture news.

    Runs the shared 4-tier source chain (see _fetch_tiered_articles), then
    restricts to the last 21 days and sorts newest-first.

    Strictly India-scoped: country="in" for API sources, locale="IN" for RSS.
    """
    queries = ["India agriculture farming crop", "India farmer news"]

    articles = await _fetch_tiered_articles(queries, max_results, country="in", locale="IN")

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
    Runs the shared 4-tier source chain, filtered to last 90 days, newest-first.
    """
    if state:
        query = f"{state} India crop pest disease outbreak"
    else:
        query = "India crop pest disease outbreak farmer"

    alerts = await _fetch_tiered_articles([query], max_results, country="in", locale="IN")

    cutoff = datetime.now(timezone.utc) - timedelta(days=90)
    filtered = [a for a in alerts if parse_date(a.get("published_at")) >= cutoff]
    filtered.sort(key=lambda x: parse_date(x.get("published_at")), reverse=True)
    result = filtered[:max_results]
    await enrich_articles_with_images(result)
    return result


async def get_scheme_news(state: str = None, max_results: int = 12) -> list:
    """
    Government scheme news — always All India, ignores state param.
    Runs the shared 4-tier source chain, filtered to last 90 days, newest-first.
    """
    state = None  # force nationwide

    articles = await _fetch_tiered_articles(
        ["India farmer government scheme subsidy yojana"],
        max_results,
        country="in",
        locale="IN",
    )

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
                _log_fetch("google_news_rss", query, 0, ok=False, detail=f"http_{response.status_code}")
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
            _log_fetch("google_news_rss", query, len(result), ok=True)
            return result

    except Exception as e:
        _log_fetch("google_news_rss", query, 0, ok=False, detail=f"{type(e).__name__}: {e}")
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
                detail = "quota_exhausted" if response.status_code in (403, 429) else f"http_{response.status_code}"
                # Quota exhausted is expected under free-tier limits — callers
                # fall back to NewsData/RSS when GNews comes back empty.
                _log_fetch("gnews", query, 0, ok=False, detail=detail)
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
            _log_fetch("gnews", query, len(result), ok=True)
            return result

    except Exception as e:
        _log_fetch("gnews", query, 0, ok=False, detail=f"{type(e).__name__}: {e}")
        _cache_set(cache_key, [], is_failure=True)
        return []


# ---------------------------------------------------------------------------
# NewsData.io — Tier 1 secondary source (parallel with GNews)
# ---------------------------------------------------------------------------
async def _fetch_newsdata(
    query: str,
    max_results: int = 10,
    country: str = None,         # "in" for India, None for global
) -> list:
    """NewsData.io API helper — mirrors _fetch_gnews()'s cache/backoff shape
    so it drops into the exact same fan-out pattern as the existing sources.
    Free tier: 200 credits/day. Returns [] (never raises) on any failure,
    same contract as _fetch_gnews/_fetch_google_news_rss.
    """
    cache_key = f"newsdata::{query}::{max_results}::{country}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    params = {
        "q":        query,
        "language": "en",
        "apikey":   settings.NEWSDATA_API_KEY,
    }
    if country:
        params["country"] = country  # e.g. "in" for India

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.get(f"{settings.NEWSDATA_BASE_URL}/news", params=params)

            if response.status_code != 200:
                detail = "quota_exhausted" if response.status_code in (403, 429) else f"http_{response.status_code}"
                _log_fetch("newsdata", query, 0, ok=False, detail=detail)
                _cache_set(cache_key, [], is_failure=True)
                return []

            data = response.json()
            if data.get("status") != "success":
                _log_fetch("newsdata", query, 0, ok=False, detail=str(data.get("results", ""))[:120])
                _cache_set(cache_key, [], is_failure=True)
                return []

            articles = data.get("results", []) or []

            result = []
            for a in articles[:max_results]:
                title = a.get("title")
                if not title:
                    continue
                image = a.get("image_url")
                result.append({
                    "title":        title,
                    "description":  a.get("description"),
                    "url":          a.get("link"),
                    "source":       a.get("source_id") or a.get("source_name") or "NewsData",
                    "published_at": _normalize_to_iso_z(a.get("pubDate")),
                    "image":        image if image else None,
                })

            _cache_set(cache_key, result, is_failure=False)
            _log_fetch("newsdata", query, len(result), ok=True)
            return result

    except Exception as e:
        _log_fetch("newsdata", query, 0, ok=False, detail=f"{type(e).__name__}: {e}")
        _cache_set(cache_key, [], is_failure=True)
        return []


# ---------------------------------------------------------------------------
# Curated agriculture / government RSS feeds — Tier 2 (no key, no quota)
# ---------------------------------------------------------------------------
async def _fetch_single_rss(feed_url: str, source_name: str, max_results: int = 10) -> list:
    """Fetch and parse one curated RSS feed. Never raises — a dead/renamed
    feed logs a warning and returns [], same fail-closed contract as every
    other fetcher here, so one bad feed URL can't break the merged response.
    """
    cache_key = f"curated_rss::{feed_url}::{max_results}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    try:
        async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
            response = await client.get(feed_url, headers={
                "User-Agent": "Mozilla/5.0 (compatible; FarmerAssistantBot/1.0)"
            })

            if response.status_code != 200:
                _log_fetch(f"curated_rss:{source_name}", "-", 0, ok=False, detail=f"http_{response.status_code}")
                _cache_set(cache_key, [], is_failure=True)
                return []

            root = ET.fromstring(response.content)
            items = root.findall("./channel/item")[:max_results]
            if not items:
                # RSS 2.0 without a <channel>, or Atom feed — fall back to
                # scanning for <item> anywhere, otherwise treat as empty.
                items = root.findall(".//item")[:max_results]

            result = []
            for item in items:
                title = item.findtext("title")
                if not title:
                    continue
                pub_date_raw = item.findtext("pubDate") or item.findtext("published")
                result.append({
                    "title":        title.strip(),
                    "description":  (item.findtext("description") or "").strip() or None,
                    "url":          item.findtext("link"),
                    "source":       source_name,
                    "published_at": _normalize_to_iso_z(pub_date_raw),
                    "image":        None,
                })

            _cache_set(cache_key, result, is_failure=False)
            _log_fetch(f"curated_rss:{source_name}", "-", len(result), ok=True)
            return result

    except Exception as e:
        _log_fetch(f"curated_rss:{source_name}", "-", 0, ok=False, detail=f"{type(e).__name__}: {e}")
        _cache_set(cache_key, [], is_failure=True)
        return []


async def _fetch_curated_rss(max_results_per_feed: int = 10) -> list:
    """Fetch all CURATED_RSS_FEEDS in parallel and merge (dedup by URL).
    A feed that's down or renamed is skipped silently (logged, not raised) —
    the remaining feeds still contribute, so this tier degrades gracefully
    feed-by-feed rather than all-or-nothing.
    """
    results = await asyncio.gather(
        *[_fetch_single_rss(f["url"], f["name"], max_results_per_feed) for f in CURATED_RSS_FEEDS],
        return_exceptions=True,
    )
    lists = [r for r in results if isinstance(r, list)]
    return _merge_unique(*lists, limit=max_results_per_feed * len(CURATED_RSS_FEEDS) + 1)


# ---------------------------------------------------------------------------
# Currents API — Tier 4, optional low-priority fallback
# ---------------------------------------------------------------------------
async def _fetch_currents(query: str, max_results: int = 10, country: str = None) -> list:
    """Currents API helper. Only called when CURRENTS_API_KEY is configured
    AND the earlier tiers came back thin — this is intentionally the last
    resort in the priority chain. Returns [] (never raises) if no key is
    set, so this tier is a clean no-op rather than a startup requirement.
    """
    if not settings.CURRENTS_API_KEY:
        return []

    cache_key = f"currents::{query}::{max_results}::{country}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    params = {
        "keywords": query,
        "language": "en",
        "apiKey":   settings.CURRENTS_API_KEY,
    }
    if country:
        params["country"] = country  # e.g. "IN" for India

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.get(f"{settings.CURRENTS_BASE_URL}/search", params=params)

            if response.status_code != 200:
                detail = "quota_exhausted" if response.status_code in (403, 429) else f"http_{response.status_code}"
                _log_fetch("currents", query, 0, ok=False, detail=detail)
                _cache_set(cache_key, [], is_failure=True)
                return []

            data = response.json()
            articles = data.get("news", []) or []

            result = []
            for a in articles[:max_results]:
                title = a.get("title")
                if not title:
                    continue
                # Currents sometimes returns the literal string "None" for a
                # missing image instead of a real null — normalize it.
                image = a.get("image")
                if image in (None, "None", ""):
                    image = None
                result.append({
                    "title":        title,
                    "description":  a.get("description"),
                    "url":          a.get("url"),
                    "source":       a.get("author") or "Currents",
                    "published_at": _normalize_to_iso_z(a.get("published")),
                    "image":        image,
                })

            _cache_set(cache_key, result, is_failure=False)
            _log_fetch("currents", query, len(result), ok=True)
            return result

    except Exception as e:
        _log_fetch("currents", query, 0, ok=False, detail=f"{type(e).__name__}: {e}")
        _cache_set(cache_key, [], is_failure=True)
        return []