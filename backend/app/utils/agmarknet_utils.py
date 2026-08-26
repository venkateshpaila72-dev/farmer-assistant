"""
AGMARKNET live price fetching (data.gov.in).

Why this file looks the way it does:
On some Windows dev machines, Python's own hostname resolution for
api.data.gov.in hangs indefinitely (a Windows DNS-resolver quirk) even
though curl and raw sockets connect to the same host instantly. httpx
usually works fine in production (Linux), so we try the fast native path
first and only fall back to a curl subprocess if it stalls — the fallback
never fires on a healthy network, so it costs nothing when things are normal.
"""

import asyncio
import json
import subprocess
import httpx
from datetime import datetime, timedelta
from urllib.parse import urlencode
from pymongo import UpdateOne
from app.core.config import settings

AGMARKNET_URL = settings.AGMARKNET_API_URL


async def _fetch_via_httpx(params: dict, timeout: float = 8.0) -> dict:
    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.get(AGMARKNET_URL, params=params)
        response.raise_for_status()
        return response.json()


async def _fetch_via_curl(params: dict, timeout: int = 20) -> dict:
    """
    Runs curl as a plain BLOCKING subprocess call, off the event loop via
    asyncio.to_thread. We deliberately do NOT use
    asyncio.create_subprocess_exec here — that async-subprocess API needs
    Windows' ProactorEventLoop, which uvicorn doesn't use (it uses
    SelectorEventLoop), so it fails with a bare NotImplementedError on
    Windows. subprocess.run() has no such restriction and works the same
    on Windows, Linux, and macOS.
    """
    query = urlencode(params)
    full_url = f"{AGMARKNET_URL}?{query}"

    def _run_curl_blocking() -> str:
        result = subprocess.run(
            # -g disables curl's URL "globbing" (it treats [ ] { } as range
            # patterns by default) — AGMARKNET's filters[State]=... params
            # contain literal brackets that must NOT be glob-parsed.
            ["curl", "-4", "-g", "-s", "--max-time", str(timeout), full_url],
            capture_output=True,
            text=True,
            timeout=timeout + 5,
        )
        if result.returncode != 0:
            raise RuntimeError(f"curl fallback failed (code {result.returncode}): {result.stderr}")
        return result.stdout

    stdout = await asyncio.to_thread(_run_curl_blocking)
    return json.loads(stdout)


async def fetch_agmarknet_prices(
    state: str | None = None,
    commodity: str | None = None,
    arrival_date: str | None = None,
    limit: int = 500,
) -> list[dict]:
    """
    Fetch live price records from AGMARKNET.
    arrival_date, if given, must be "DD-MM-YYYY" (AGMARKNET's own filter
    format) — without it, the API returns an unsorted mix of records that
    can span back many years, not today's prices.
    Returns a list of raw records in AGMARKNET's own field format
    (Arrival_Date, Commodity, District, Market, Max_Price, Min_Price,
    Modal_Price, State, Variety, Grade, Commodity_Code) — same shape
    process_csv() already expects from the manual CSV upload path.
    """
    params = {
        "api-key": settings.AGMARKNET_API_KEY,
        "format": "json",
        "limit": limit,
    }
    if state:
        params["filters[State]"] = state
    if commodity:
        params["filters[Commodity]"] = commodity
    if arrival_date:
        params["filters[Arrival_Date]"] = arrival_date

    try:
        data = await _fetch_via_httpx(params)
    except (httpx.TimeoutException, httpx.ConnectError):
        # Fast path stalled — fall back to the known-reliable curl path.
        data = await _fetch_via_curl(params)

    return data.get("records", [])


async def sync_state_prices(state: str) -> int:
    """
    Fetches today's live AGMARKNET prices for one state and writes them into
    MongoDB (market_prices collection) — same document shape process_csv()
    already writes from the manual CSV upload path, so every existing read
    route (get_prices_from_db, trending, etc.) keeps working unchanged.
    Called by the daily scheduler job, once per state that has onboarded
    farmers. Returns the number of price records written.

    Tries today's date first; some mandis report a day late, so if today
    has nothing yet we fall back to yesterday once rather than silently
    returning unfiltered (potentially years-old) data.
    """
    from app.db.database import get_db
    from app.db.models import MARKET_PRICES_COLLECTION

    today = datetime.utcnow()
    yesterday = today - timedelta(days=1)

    records = await fetch_agmarknet_prices(state=state, arrival_date=today.strftime("%d-%m-%Y"), limit=1000)
    if not records:
        records = await fetch_agmarknet_prices(state=state, arrival_date=yesterday.strftime("%d-%m-%Y"), limit=1000)

    if not records:
        return 0

    uploaded_at = datetime.utcnow()
    docs = []
    for row in records:
        try:
            docs.append({
                "state":          row.get("State", state),
                "district":       row.get("District", ""),
                "market":         row.get("Market", ""),
                "commodity":      row.get("Commodity", "").lower(),
                "commodity_raw":  row.get("Commodity", ""),
                "variety":        row.get("Variety", ""),
                "grade":          row.get("Grade", ""),
                "commodity_code": row.get("Commodity_Code", ""),
                "min_price":      float(str(row.get("Min_Price", "0") or "0").replace(",", "")),
                "max_price":      float(str(row.get("Max_Price", "0") or "0").replace(",", "")),
                "modal_price":    float(str(row.get("Modal_Price", "0") or "0").replace(",", "")),
                "arrival_date":   row.get("Arrival_Date", ""),
                "uploaded_by":    "agmarknet_live",
                "uploaded_at":    uploaded_at,
            })
        except (ValueError, TypeError):
            continue  # skip malformed rows, don't fail the whole batch

    if not docs:
        return 0

    db = get_db()

    # Upsert on the natural identity of a price record (state/district/
    # market/commodity/variety/arrival_date) instead of insert_many, so
    # re-running the sync for a day that's already synced UPDATES the
    # existing record (fresher prices, fresher uploaded_at) rather than
    # inserting a duplicate copy. Paired with the unique index on this
    # same key in db/models.py.
    operations = [
        UpdateOne(
            {
                "state":        doc["state"],
                "district":     doc["district"],
                "market":       doc["market"],
                "commodity":    doc["commodity"],
                "variety":      doc["variety"],
                "arrival_date": doc["arrival_date"],
            },
            {"$set": doc},
            upsert=True,
        )
        for doc in docs
    ]
    await db[MARKET_PRICES_COLLECTION].bulk_write(operations, ordered=False)
    return len(docs)