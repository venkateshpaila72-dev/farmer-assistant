from fastapi import APIRouter, UploadFile, File, HTTPException, Form, BackgroundTasks, Depends
from datetime import datetime, timedelta
from app.db.database import get_db
from app.db.models import MARKET_PRICES_COLLECTION, FARMER_PROFILES_COLLECTION
from app.utils.market_utils import get_prices_from_db, get_trending_from_db
from app.core.security import get_current_user, get_current_admin
from app.db.schemas import MarketPriceCreate
import csv
import io

router = APIRouter()

# Keep only 2 weeks of data — controls MongoDB storage
RETENTION_WEEKS = 2


async def process_csv(content: bytes, uploaded_by: str):
    """
    Background task — reads CSV and inserts into MongoDB in batches.
    Exact column names from data.gov.in AGMARKNET API:
    Arrival_Date, Commodity, Commodity_Code, District, Grade,
    Market, Max_Price, Min_Price, Modal_Price, State, Variety
    """
    db          = get_db()
    decoded     = content.decode("utf-8", errors="ignore")
    reader      = csv.DictReader(io.StringIO(decoded))

    batch       = []
    total       = 0
    skipped     = 0
    batch_size  = 500
    uploaded_at = datetime.utcnow()

    for row in reader:
        try:
            # Strip whitespace from all keys and values
            row = {
                k.strip(): v.strip() if isinstance(v, str) else v
                for k, v in row.items()
            }

            state     = row.get("State", "").strip()
            district  = row.get("District", "").strip()
            market    = row.get("Market", "").strip()
            commodity = row.get("Commodity", "").strip()
            variety   = row.get("Variety", "").strip()
            grade     = row.get("Grade", "").strip()
            date      = row.get("Arrival_Date", "").strip()
            com_code  = row.get("Commodity_Code", "").strip()

            min_price   = row.get("Min_Price", "0") or "0"
            max_price   = row.get("Max_Price", "0") or "0"
            modal_price = row.get("Modal_Price", "0") or "0"

            # Skip rows missing essential fields
            if not state or not commodity or not district:
                skipped += 1
                continue

            record = {
                "state":          state,
                "district":       district,
                "market":         market,
                "commodity":      commodity.lower(),   # lowercase for easy search
                "commodity_raw":  commodity,           # original case for display
                "variety":        variety,
                "grade":          grade,
                "commodity_code": com_code,
                "min_price":      float(str(min_price).replace(",", "") or 0),
                "max_price":      float(str(max_price).replace(",", "") or 0),
                "modal_price":    float(str(modal_price).replace(",", "") or 0),
                "arrival_date":   date,
                "uploaded_by":    uploaded_by,
                "uploaded_at":    uploaded_at
            }

            batch.append(record)
            total += 1

            # Insert in batches of 500
            if len(batch) >= batch_size:
                await db[MARKET_PRICES_COLLECTION].insert_many(batch)
                batch = []

        except (ValueError, KeyError):
            skipped += 1
            continue

    # Insert remaining
    if batch:
        await db[MARKET_PRICES_COLLECTION].insert_many(batch)

    # Auto-delete data older than 2 weeks
    cutoff = datetime.utcnow() - timedelta(weeks=RETENTION_WEEKS)
    deleted = await db[MARKET_PRICES_COLLECTION].delete_many(
        {"uploaded_at": {"$lt": cutoff}}
    )

    print(f"✅ Market CSV processed: {total} inserted, {skipped} skipped")
    print(f"🗑️  Old records deleted: {deleted.deleted_count}")


# ── Admin — Upload CSV ─────────────────────────────────────────────────────────

@router.post("/upload-dataset")
async def upload_market_dataset(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    uploaded_by: str = Form(default="admin"),
    admin: dict = Depends(get_current_admin)
):
    """
    Admin uploads market price CSV from data.gov.in AGMARKNET.
    Expected columns:
    Arrival_Date, Commodity, Commodity_Code, District, Grade,
    Market, Max_Price, Min_Price, Modal_Price, State, Variety

    Processing happens in background — returns immediately.
    Check status with GET /market/upload-status
    """
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files allowed")

    content = await file.read()

    if len(content) == 0:
        raise HTTPException(status_code=400, detail="File is empty")

    background_tasks.add_task(process_csv, content, uploaded_by)

    return {
        "success":  True,
        "message":  "CSV upload started — processing in background",
        "filename": file.filename,
        "note":     "Wait 1-2 minutes then check GET /market/upload-status"
    }


# ── Admin — Add a single record ──────────────────────────────────────────────
# For the odd correction or one-off addition where a full CSV re-upload isn't
# worth it — same record shape as process_csv above, inserted immediately
# (no background task needed for a single document).

@router.post("/add-price")
async def add_market_price(data: MarketPriceCreate, admin: dict = Depends(get_current_admin)):
    db = get_db()

    record = {
        "state":          data.state.strip(),
        "district":       data.district.strip(),
        "market":         data.market.strip(),
        "commodity":      data.commodity.strip().lower(),
        "commodity_raw":  data.commodity.strip(),
        "variety":        data.variety.strip(),
        "grade":          data.grade.strip(),
        "commodity_code": data.commodity_code.strip(),
        "min_price":      data.min_price,
        "max_price":      data.max_price,
        "modal_price":    data.modal_price,
        "arrival_date":   data.arrival_date.strip(),
        "uploaded_by":    admin.get("email") or admin.get("name") or "admin",
        "uploaded_at":    datetime.utcnow()
    }

    await db[MARKET_PRICES_COLLECTION].insert_one(record)

    return {"success": True, "message": "Price record added"}


# ── Admin — Browse actual records ────────────────────────────────────────────
# The upload-status endpoint below only ever gave a count + state list — no
# way to actually see what's in the database. This lists real records,
# most-recently-uploaded first, with simple pagination.

@router.get("/records")
async def get_market_records(
    limit: int = 50,
    skip: int = 0,
    state: str = None,
    admin: dict = Depends(get_current_admin)
):
    db = get_db()
    query = {}
    if state:
        query["state"] = {"$regex": state, "$options": "i"}

    total   = await db[MARKET_PRICES_COLLECTION].count_documents(query)
    records = await db[MARKET_PRICES_COLLECTION].find(
        query, {"_id": 0}
    ).sort("uploaded_at", -1).skip(skip).limit(limit).to_list(length=limit)

    return {"total": total, "records": records}


# ── Upload status ──────────────────────────────────────────────────────────────

@router.get("/upload-status")
async def upload_status():
    """Check how many records are in MongoDB and which states are available."""
    db     = get_db()
    total  = await db[MARKET_PRICES_COLLECTION].count_documents({})
    states = await db[MARKET_PRICES_COLLECTION].distinct("state")
    comms  = await db[MARKET_PRICES_COLLECTION].distinct("commodity_raw")

    estimated_mb = round((total * 250) / (1024 * 1024), 2)

    return {
        "total_records":       total,
        "states_available":    sorted(states),
        "commodities_count":   len(comms),
        "estimated_size_mb":   estimated_mb,
        "mongodb_limit_mb":    512,
        "storage_used_pct":    round((estimated_mb / 512) * 100, 1),
        "ready":               total > 0
    }


# ── Get prices ─────────────────────────────────────────────────────────────────

@router.get("/prices")
async def get_prices(
    state: str,
    commodity: str = None,
    district: str = None,
    limit: int = 50,
    skip: int = 0
):
    """
    Get market prices by state.
    Optionally filter by commodity and district.
    `skip` lets the frontend page through large states ("load more")
    instead of pulling everything in one request.
    """
    prices = await get_prices_from_db(
        state=state,
        commodity=commodity,
        district=district,
        limit=limit,
        skip=skip
    )

    if not prices:
        # skip > 0 with an empty page just means "no more records" (end of
        # pagination) — that's not an error, only skip == 0 is a real miss.
        if skip == 0:
            raise HTTPException(
                status_code=404,
                detail=f"No price data for {state}. Admin needs to upload dataset first."
            )
        return {
            "state":     state,
            "commodity": commodity or "all",
            "district":  district or "all",
            "total":     0,
            "prices":    []
        }

    return {
        "state":     state,
        "commodity": commodity or "all",
        "district":  district or "all",
        "total":     len(prices),
        "prices":    prices
    }


# ── Farmer prices ──────────────────────────────────────────────────────────────

@router.get("/farmer/{username}")
async def get_farmer_prices(username: str, current_user: dict = Depends(get_current_user)):
    """
    Get prices for farmer's preferred crops in their state.
    Auto-loads everything from farmer profile.
    """
    if current_user["role"] != "admin" and current_user["username"] != username:
        raise HTTPException(status_code=403, detail="Not your account")

    db = get_db()

    profile = await db[FARMER_PROFILES_COLLECTION].find_one({"username": username})
    if not profile:
        raise HTTPException(status_code=404, detail="Farmer profile not found")

    state           = profile["current_location"]["state"]
    district        = profile["current_location"].get("district", "")
    preferred_crops = profile.get("preferred_crops", [])

    results = {}
    for crop in preferred_crops:
        prices = []
        matched_district = None

        # AGMARKNET mandi data is often sparse at the district level — a
        # crop can easily have plenty of state-wide records with none
        # happening to fall in this exact district. A strict, unconditional
        # district filter here previously made the dashboard show "no
        # price data" for crops that genuinely DO have pricing (the chat's
        # get_market_price tool finds them fine because it treats district
        # as optional, not required). Try district-level first since it's
        # the most locally relevant, then fall back to state-level so a
        # real result isn't hidden just because it's not hyper-local.
        if district:
            prices = await get_prices_from_db(
                state=state,
                commodity=crop,
                district=district,
                limit=10
            )
            if prices:
                matched_district = district

        if not prices:
            prices = await get_prices_from_db(
                state=state,
                commodity=crop,
                district=None,
                limit=10
            )

        if prices:
            results[crop] = {
                "records":  prices,
                # Lets the frontend show "closest available" vs "your
                # district" instead of implying every price is hyper-local.
                "district": matched_district or "statewide",
            }

    return {
        "username":        username,
        "state":           state,
        "district":        district or "all",
        "preferred_crops": preferred_crops,
        "prices":          results
    }


# ── Trending ───────────────────────────────────────────────────────────────────

@router.get("/trending")
async def get_trending_crops(state: str, limit: int = 5):
    """
    Get trending crops in a state calculated from real market data.
    """
    trending = await get_trending_from_db(state=state, limit=limit)

    if not trending:
        raise HTTPException(
            status_code=404,
            detail=f"No market data for {state}. Admin needs to upload dataset."
        )

    return {
        "state":          state,
        "trending_crops": trending
    }


# ── Price trend ────────────────────────────────────────────────────────────────

@router.get("/trend")
async def get_price_trend(state: str, commodity: str):
    """Get price trend for a commodity in a state for chart display."""
    prices = await get_prices_from_db(
        state=state,
        commodity=commodity,
        limit=30
    )

    if not prices:
        raise HTTPException(
            status_code=404,
            detail=f"No trend data for {commodity} in {state}"
        )

    return {
        "state":     state,
        "commodity": commodity,
        "total":     len(prices),
        "trend":     prices
    }


# ── Available states ───────────────────────────────────────────────────────────

@router.get("/states")
async def get_available_states():
    """Returns all states that have data in MongoDB."""
    db     = get_db()
    states = await db[MARKET_PRICES_COLLECTION].distinct("state")

    if not states:
        return {
            "message": "No data uploaded yet. Admin needs to upload CSV first.",
            "states":  []
        }

    return {
        "total":  len(states),
        "states": sorted(states)
    }