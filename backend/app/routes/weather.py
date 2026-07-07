from fastapi import APIRouter, HTTPException
from datetime import datetime
from app.utils.weather_utils import get_current_weather, get_season_from_month
from app.db.database import get_db
from app.db.models import FARMER_PROFILES_COLLECTION

router = APIRouter()


@router.get("/current")
async def current_weather(lat: float, lng: float):
    """
    Get current weather + 5 day forecast + farming alerts.
    Pass lat/lng from browser GPS.
    """
    try:
        weather = await get_current_weather(lat, lng)
        return weather
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Weather fetch failed: {str(e)}")


@router.get("/farmer/{username}")
async def farmer_weather(username: str):
    """
    Get weather for farmer's current location.
    Auto-loads lat/lng from farmer's profile — no manual input needed.
    """
    db = get_db()

    profile = await db[FARMER_PROFILES_COLLECTION].find_one({"username": username})
    if not profile:
        raise HTTPException(status_code=404, detail="Farmer profile not found")

    location = profile.get("current_location", profile.get("home_location"))
    lat = location["lat"]
    lng = location["lng"]

    try:
        weather = await get_current_weather(lat, lng)

        # Add location and season info
        weather["location"] = {
            "state": location.get("state"),
            "district": location.get("district"),
            "lat": lat,
            "lng": lng
        }
        weather["season"] = get_season_from_month(datetime.now().month)

        return weather
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Weather fetch failed: {str(e)}")


@router.get("/season")
async def current_season():
    """Returns current Indian farming season based on today's month."""
    month = datetime.now().month
    season = get_season_from_month(month)
    return {
        "month": month,
        "season": season,
        "description": {
            "Kharif": "June–October — Rice, Cotton, Maize, Soybean",
            "Rabi":   "November–March — Wheat, Mustard, Gram, Barley",
            "Zaid":   "March–June — Watermelon, Cucumber, Moong"
        }.get(season)
    }