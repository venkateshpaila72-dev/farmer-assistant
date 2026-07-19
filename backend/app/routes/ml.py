from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime
from app.db.database import get_db
from app.db.models import FARMER_PROFILES_COLLECTION
from app.db.schemas import (
    CropRecommendRequest, CropRecommendResponse,
    FertilizerRecommendRequest, FertilizerRecommendResponse,
    YieldPredictRequest, YieldPredictResponse
)
from app.utils.weather_utils import get_current_weather, get_season_from_month
from app.ml_models import crop_recommender, fertilizer_suggester, yield_predictor
from app.core.security import get_current_user


def _check_owner(current_user: dict, username: str):
    """Shared ownership check — admins can act on any username, farmers only their own."""
    if current_user["role"] != "admin" and current_user["username"] != username:
        raise HTTPException(status_code=403, detail="Not your account")

router = APIRouter()


# ── Soil nutrient estimates per soil type ─────────────────────────────────────
# Used when farmer hasn't done soil test — estimated from soil type
SOIL_NUTRIENTS = {
    "red_loamy":   {"N": 80,  "P": 40, "K": 45, "ph": 6.5},
    "black":       {"N": 90,  "P": 45, "K": 50, "ph": 7.2},
    "sandy":       {"N": 50,  "P": 25, "K": 30, "ph": 6.0},
    "clay":        {"N": 85,  "P": 42, "K": 48, "ph": 7.0},
    "loamy":       {"N": 88,  "P": 44, "K": 46, "ph": 6.8},
    "alluvial":    {"N": 95,  "P": 48, "K": 52, "ph": 7.1},
    "laterite":    {"N": 60,  "P": 30, "K": 35, "ph": 5.8},
    "default":     {"N": 80,  "P": 40, "K": 43, "ph": 6.5}
}

# The soil-image classifier (soil_classifier.py) outputs a different taxonomy
# than the one above (Black/Cinder/Laterite/Peat/Yellow Soil vs.
# red_loamy/black/sandy/clay/loamy/alluvial/laterite) — these were built
# independently and never reconciled. This bridges classifier output to a
# usable nutrient-key lookup.
#
# "Black Soil" and "Laterite Soil" map cleanly (same real-world soil type).
# "Cinder Soil", "Peat Soil", and "Yellow Soil" do NOT have a real
# agronomic equivalent in SOIL_NUTRIENTS — these three are best-effort
# approximations based on general soil characteristics (cinder: coarse,
# well-drained, low-fertility → closest to sandy; peat: organic-rich,
# moisture-retentive → closest to clay; yellow: weathered, laterite-derived
# → closest to laterite), not authoritative agronomic matches. Worth a
# domain-expert review before relying on these three for real advice.
SOIL_CLASSIFIER_TO_NUTRIENT_KEY = {
    "black soil":    "black",
    "laterite soil": "laterite",
    "cinder soil":   "sandy",     # approximation — no exact match
    "peat soil":     "clay",      # approximation — no exact match
    "yellow soil":   "laterite",  # approximation — no exact match
}


def resolve_soil_nutrients(soil_type: str) -> dict:
    """
    Resolves ANY soil type string — whether it's an onboarding value
    (e.g. 'black', 'loamy'), a stored profile value, or a raw soil-image
    classifier output (e.g. 'Black Soil') — to a SOIL_NUTRIENTS entry.
    Falls back to 'default' if nothing matches rather than raising, since
    a rough estimate is better than blocking a crop recommendation.
    """
    if not soil_type:
        return SOIL_NUTRIENTS["default"]
    key = soil_type.strip().lower().replace(" ", "_")
    if key in SOIL_NUTRIENTS:
        return SOIL_NUTRIENTS[key]
    mapped = SOIL_CLASSIFIER_TO_NUTRIENT_KEY.get(soil_type.strip().lower())
    if mapped:
        return SOIL_NUTRIENTS[mapped]
    return SOIL_NUTRIENTS["default"]


async def get_farmer_context(username: str) -> dict:
    """Load farmer profile + live weather as context for ML predictions."""
    db = get_db()

    profile = await db[FARMER_PROFILES_COLLECTION].find_one({"username": username})
    if not profile:
        raise HTTPException(status_code=404, detail="Farmer profile not found")

    location = profile.get("current_location", profile.get("home_location", {}))
    soil_type = profile.get("soil_type", "default")

    # Get live weather — falls back to sensible seasonal-average defaults if
    # the weather API is unreachable (network/AV/firewall issues), rather
    # than 500ing the whole crop/fertilizer recommendation over a weather
    # hiccup. The direct /weather/current endpoint (weather.py) does NOT do
    # this — a farmer checking weather directly should see a real failure,
    # not a silently faked number. This fallback is only for the ML context
    # builder, where a reasonable estimate is better than blocking entirely.
    try:
        weather = await get_current_weather(
            lat=location.get("lat", 17.97),
            lng=location.get("lng", 79.59)
        )
        current = weather.get("current", {})
    except Exception as e:
        print(f"⚠️  Weather fetch failed for {username}'s ML context, using defaults: {e}")
        current = {}

    # Get soil nutrients from profile or estimate from soil type
    nutrients = SOIL_NUTRIENTS.get(soil_type, SOIL_NUTRIENTS["default"])

    return {
        "profile":     profile,
        "location":    location,
        "soil_type":   soil_type,
        "nutrients":   nutrients,
        "temperature": current.get("temperature", 28.0),
        "humidity":    current.get("humidity", 65.0),
        "rainfall":    current.get("precipitation", 100.0),
        "season":      get_season_from_month(datetime.now().month)
    }


# ── Crop Recommendation ────────────────────────────────────────────────────────

@router.post("/recommend-crop")
async def recommend_crop(data: CropRecommendRequest, current_user: dict = Depends(get_current_user)):
    """
    Recommend best crops for farmer.
    Auto-loads soil + weather from farmer profile — farmer enters nothing.
    Optionally accepts manual soil values if farmer has soil test report.
    """
    _check_owner(current_user, data.username)
    ctx = await get_farmer_context(data.username)

    # If a soil_type override was passed (e.g. from a just-detected photo
    # classification that we deliberately did NOT save to the profile),
    # resolve nutrients from that instead of the stored profile's soil type.
    base_nutrients = resolve_soil_nutrients(data.soil_type) if data.soil_type else ctx["nutrients"]

    # Use provided values OR auto-loaded from profile + weather
    N           = data.N           or base_nutrients["N"]
    P           = data.P           or base_nutrients["P"]
    K           = data.K           or base_nutrients["K"]
    temperature = data.temperature or ctx["temperature"]
    humidity    = data.humidity    or ctx["humidity"]
    ph          = data.ph          or base_nutrients["ph"]
    rainfall    = data.rainfall    or ctx["rainfall"]

    try:
        result = crop_recommender.recommend_crop(
            N=N, P=P, K=K,
            temperature=temperature,
            humidity=humidity,
            ph=ph,
            rainfall=rainfall
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Crop recommendation failed: {str(e)}")

    return {
        **result,
        "season":    ctx["season"],
        "location":  ctx["location"].get("state", ""),
        "soil_type": ctx["soil_type"],
        "data_source": "auto-loaded from profile + live weather"
    }


@router.get("/recommend-crop/{username}")
async def recommend_crop_get(username: str, current_user: dict = Depends(get_current_user)):
    """GET version — auto-loads everything from farmer profile."""
    _check_owner(current_user, username)
    ctx = await get_farmer_context(username)
    n   = ctx["nutrients"]

    try:
        result = crop_recommender.recommend_crop(
            N=n["N"], P=n["P"], K=n["K"],
            temperature=ctx["temperature"],
            humidity=ctx["humidity"],
            ph=n["ph"],
            rainfall=ctx["rainfall"]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Crop recommendation failed: {str(e)}")

    return {
        **result,
        "season":    ctx["season"],
        "location":  ctx["location"].get("state", ""),
        "soil_type": ctx["soil_type"]
    }


# ── Fertilizer Recommendation ─────────────────────────────────────────────────

@router.post("/recommend-fertilizer")
async def recommend_fertilizer(data: FertilizerRecommendRequest, current_user: dict = Depends(get_current_user)):
    """
    Recommend best fertilizer for farmer's crop.
    Auto-loads soil type, temperature, humidity from farmer profile.
    Farmer only selects the crop.
    """
    _check_owner(current_user, data.username)
    ctx      = await get_farmer_context(data.username)
    n        = ctx["nutrients"]
    soil     = ctx["soil_type"]

    # Map our soil types to fertilizer model soil types
    soil_map = {
        "red_loamy": "Red",
        "black":     "Black",
        "sandy":     "Sandy",
        "clay":      "Clayey",
        "loamy":     "Loamy",
        "alluvial":  "Loamy",
        "laterite":  "Red",
        "default":   "Loamy"
    }
    mapped_soil = soil_map.get(soil, "Loamy")

    try:
        result = fertilizer_suggester.suggest_fertilizer(
            temperature=ctx["temperature"],
            humidity=ctx["humidity"],
            moisture=50.0,               # default moisture
            soil_type=mapped_soil,
            crop_type=data.crop_type,
            nitrogen=n["N"],
            potassium=n["K"],
            phosphorous=n["P"]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Fertilizer recommendation failed: {str(e)}")

    return result


@router.get("/fertilizer-types")
async def get_fertilizer_types():
    """Returns available soil and crop types for fertilizer model."""
    return fertilizer_suggester.get_available_types()


# ── Yield Prediction ──────────────────────────────────────────────────────────

@router.post("/predict-yield")
async def predict_yield(data: YieldPredictRequest, current_user: dict = Depends(get_current_user)):
    """
    Predict crop yield for farmer.
    Farmer provides crop, season, year and area.
    Rainfall auto-loaded from live weather if not provided.
    """
    _check_owner(current_user, data.username)
    ctx      = await get_farmer_context(data.username)
    rainfall = data.rainfall or ctx["rainfall"] or 1000.0

    try:
        result = yield_predictor.predict_yield(
            state=ctx["location"].get("state", data.username),
            crop=data.crop,
            season=data.season,
            year=data.year,
            area_hectares=data.area_hectares,
            rainfall=rainfall
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Yield prediction failed: {str(e)}")

    return result


@router.get("/yield-options")
async def get_yield_options():
    """Returns available crops, seasons and states for yield prediction."""
    return yield_predictor.get_available_options()