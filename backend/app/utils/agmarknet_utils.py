"""
Mandi Price API adapter for the Farmer Assistant backend.

API: https://mandi-api.onrender.com/v1

Supported states:
- Maharashtra
- Uttar Pradesh
- Punjab
- Madhya Pradesh
- Karnataka

Note:
This is a community API, not an official government API.
Andhra Pradesh and Telangana are not supported by this provider.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Any

import httpx
from pymongo import UpdateOne

from app.db.database import get_db
from app.db.models import MARKET_PRICES_COLLECTION


BASE_URL = "https://mandi-api.onrender.com/v1"

REQUEST_TIMEOUT = httpx.Timeout(45.0, connect=10.0)

HEADERS = {
    "Accept": "application/json",
    "User-Agent": "FarmerAssistant/1.0",
}

SUPPORTED_STATES = {
    "maharashtra": "Maharashtra",
    "uttar pradesh": "Uttar Pradesh",
    "punjab": "Punjab",
    "madhya pradesh": "Madhya Pradesh",
    "karnataka": "Karnataka",
}


class AgmarknetError(RuntimeError):
    """Raised when the market-price provider cannot serve a request."""


def _canonical_state(state_name: str) -> str:
    """Validate the state and return its canonical name."""

    cleaned = " ".join(state_name.strip().split())
    canonical = SUPPORTED_STATES.get(cleaned.casefold())

    if not canonical:
        supported = ", ".join(SUPPORTED_STATES.values())

        raise AgmarknetError(
            f"{state_name!r} is not supported by the Mandi Price API. "
            f"Supported states: {supported}. "
            "Andhra Pradesh and Telangana are not available "
            "from this provider."
        )

    return canonical


async def _get_json(
    path: str,
    params: dict[str, Any] | None = None,
) -> dict:
    """Send an HTTP request and validate the JSON response."""

    url = f"{BASE_URL}/{path.lstrip('/')}"

    try:
        async with httpx.AsyncClient(
            timeout=REQUEST_TIMEOUT,
            headers=HEADERS,
            follow_redirects=True,
        ) as client:

            response = await client.get(
                url,
                params=params or {},
            )

            if response.is_error:
                raise AgmarknetError(
                    f"Mandi Price API returned HTTP "
                    f"{response.status_code}: "
                    f"{response.text[:1000]}"
                )

            try:
                payload = response.json()
            except ValueError as exc:
                raise AgmarknetError(
                    "Mandi Price API returned invalid JSON: "
                    f"{response.text[:500]}"
                ) from exc

    except httpx.TimeoutException as exc:
        raise AgmarknetError(
            f"Mandi Price API timed out: {exc}"
        ) from exc

    except httpx.RequestError as exc:
        raise AgmarknetError(
            f"Mandi Price API connection failed: {exc}"
        ) from exc

    if not isinstance(payload, dict):
        raise AgmarknetError(
            "Mandi Price API returned an unexpected response format."
        )

    return payload


def _number(value: Any) -> float:
    """Convert a price value to float."""

    if value is None or value == "":
        return 0.0

    if isinstance(value, (int, float)):
        return float(value)

    return float(str(value).replace(",", "").strip())


def _records_from_payload(payload: dict) -> list[dict]:
    """Extract records from the API response."""

    if payload.get("success") is not True:
        raise AgmarknetError(
            "Mandi Price API reported failure: "
            f"{str(payload)[:800]}"
        )

    records = payload.get("data")

    if not isinstance(records, list):
        raise AgmarknetError(
            "Mandi Price API response does not contain a valid data list."
        )

    return [
        record
        for record in records
        if isinstance(record, dict)
    ]


async def fetch_agmarknet_prices(
    state: str,
    arrival_date: str | None = None,
    commodity: str | None = None,
    market: str | None = None,
    variety: str | None = None,
) -> list[dict]:
    """
    Fetch market prices from the Mandi Price API.

    Args:
        state: Supported state name.
        arrival_date: Optional date in YYYY-MM-DD format.
        commodity: Optional commodity filter.
        market: Optional market filter.
        variety: Optional variety filter.

    Returns:
        A list of market-price records.
    """

    canonical_state = _canonical_state(state)

    params: dict[str, str] = {
        "state": canonical_state,
    }

    if arrival_date:
        try:
            date.fromisoformat(arrival_date)
        except ValueError as exc:
            raise ValueError(
                "arrival_date must use YYYY-MM-DD format."
            ) from exc

        params["date"] = arrival_date

    if commodity and commodity.strip():
        params["commodity"] = commodity.strip()

    if market and market.strip():
        params["market"] = market.strip()

    if variety and variety.strip():
        params["variety"] = variety.strip()

    payload = await _get_json(
        "/prices",
        params=params,
    )

    records = _records_from_payload(payload)

    meta = payload.get("meta") or {}

    print(
        f"Mandi Price API | "
        f"State={canonical_state} | "
        f"Requested date={arrival_date or 'latest available'} | "
        f"Records={len(records)} | "
        f"Latest fetch={meta.get('latest_fetched_at', 'unknown')}"
    )

    return records


async def sync_state_prices(state: str) -> int:
    """
    Fetch available prices and upsert them into MongoDB.

    The actual arrival_date returned by the API is preserved.
    Old records are never relabeled as today's prices.
    """

    canonical_state = _canonical_state(state)

    records = await fetch_agmarknet_prices(
        state=canonical_state,
    )

    if not records:
        print(
            f"No market-price records returned for "
            f"{canonical_state}."
        )
        return 0

    uploaded_at = datetime.utcnow()
    documents: list[dict] = []

    for record in records:

        commodity_raw = str(
            record.get("commodity") or ""
        ).strip()

        market_name = str(
            record.get("market") or ""
        ).strip()

        row_state = str(
            record.get("state") or canonical_state
        ).strip()

        arrival_date_value = str(
            record.get("arrival_date") or ""
        ).strip()

        # Required fields must come from the actual API record.
        if (
            not commodity_raw
            or not market_name
            or not arrival_date_value
        ):
            continue

        try:
            min_price = _number(
                record.get("min_price")
            )

            max_price = _number(
                record.get("max_price")
            )

            modal_price = _number(
                record.get("modal_price")
            )

        except (TypeError, ValueError):
            print(
                f"Skipping malformed price record: {record!r}"
            )
            continue

        document = {
            "state": row_state,

            "district": str(
                record.get("district") or ""
            ).strip(),

            "market": market_name,

            "commodity": commodity_raw.lower(),

            "commodity_raw": commodity_raw,

            "variety": str(
                record.get("variety") or ""
            ).strip(),

            "grade": str(
                record.get("grade") or ""
            ).strip(),

            "commodity_code": str(
                record.get("commodity_code") or ""
            ).strip(),

            "min_price": min_price,

            "max_price": max_price,

            "modal_price": modal_price,

            "arrival_date": arrival_date_value,

            "uploaded_by": "mandi_price_api",

            "uploaded_at": uploaded_at,

            "source_fetched_at": record.get(
                "fetched_at"
            ),
        }

        documents.append(document)

    if not documents:
        print(
            f"Received {len(records)} records for "
            f"{canonical_state}, but none contained "
            "the required commodity, market, and arrival date."
        )
        return 0

    db = get_db()

    operations = []

    for document in documents:

        filter_query = {
            "state": document["state"],
            "district": document["district"],
            "market": document["market"],
            "commodity": document["commodity"],
            "variety": document["variety"],
            "arrival_date": document["arrival_date"],
        }

        operations.append(
            UpdateOne(
                filter_query,
                {"$set": document},
                upsert=True,
            )
        )

    result = await db[
        MARKET_PRICES_COLLECTION
    ].bulk_write(
        operations,
        ordered=False,
    )

    print(
        f"Market-price sync completed | "
        f"State={canonical_state} | "
        f"Received={len(records)} | "
        f"Valid={len(documents)} | "
        f"Inserted={result.upserted_count} | "
        f"Modified={result.modified_count}"
    )

    return len(documents)


async def test_agmarknet_connection() -> bool:
    """Check whether the provider's states endpoint is accessible."""

    payload = await _get_json("/states")

    if payload.get("success") is not True:
        raise AgmarknetError(
            "Mandi Price API states check failed: "
            f"{str(payload)[:500]}"
        )

    return True


async def test_agmarknet_state(
    state: str = "Maharashtra",
) -> dict:
    """Check whether a state is supported by this provider."""

    canonical_state = _canonical_state(state)

    return {
        "state": canonical_state,
        "supported": True,
    }