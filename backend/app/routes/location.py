from fastapi import APIRouter, HTTPException, status, Depends
from datetime import datetime
from math import radians, sin, cos, sqrt, atan2
from app.db.database import get_db
from app.db.models import FARMER_PROFILES_COLLECTION
from app.db.schemas import LocationCheckRequest, LocationUpdateRequest, MessageResponse
from app.core.security import get_current_user

router = APIRouter()


def haversine_distance(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """
    Calculate distance in km between two GPS coordinates.
    Used to detect if farmer has moved to a new location.
    """
    R = 6371  # Earth radius in km
    lat1, lng1, lat2, lng2 = map(radians, [lat1, lng1, lat2, lng2])
    dlat = lat2 - lat1
    dlng = lng2 - lng1
    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlng/2)**2
    return R * 2 * atan2(sqrt(a), sqrt(1 - a))


@router.post("/check")
async def check_location(data: LocationCheckRequest, current_user: dict = Depends(get_current_user)):
    """
    Compare farmer's current GPS with saved home location.
    Returns whether farmer has moved and how far.
    Frontend uses this to ask farmer: 'Temporary visit or moved permanently?'
    """
    if current_user["role"] != "admin" and current_user["username"] != data.username:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your account")

    db = get_db()

    profile = await db[FARMER_PROFILES_COLLECTION].find_one(
        {"username": data.username}
    )

    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Farmer profile not found"
        )

    home = profile["home_location"]
    distance_km = haversine_distance(
        home["lat"], home["lng"],
        data.current_lat, data.current_lng
    )

    # If moved more than 50km — consider it a new location
    location_changed = distance_km > 50

    return {
        "username": data.username,
        "location_changed": location_changed,
        "distance_km": round(distance_km, 2),
        "home_location": {
            "state": home["state"],
            "district": home["district"]
        },
        "current_lat": data.current_lat,
        "current_lng": data.current_lng
    }


@router.post("/update", response_model=MessageResponse)
async def update_location(data: LocationUpdateRequest, current_user: dict = Depends(get_current_user)):
    """
    Update farmer's current location.
    is_temporary=True  → only used for today, home location unchanged
    is_temporary=False → permanently moved, update home location too
    """
    if current_user["role"] != "admin" and current_user["username"] != data.username:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your account")

    db = get_db()

    profile = await db[FARMER_PROFILES_COLLECTION].find_one(
        {"username": data.username}
    )

    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Farmer profile not found"
        )

    # Always update current location
    update_data = {
        "current_location": {
            "state": data.new_state,
            "district": data.new_district,
            "lat": data.new_lat,
            "lng": data.new_lng,
            "is_temporary": data.is_temporary,
            "detected_at": datetime.utcnow().strftime("%Y-%m-%d")
        },
        "updated_at": datetime.utcnow()
    }

    # If permanent move — update home location too
    if not data.is_temporary:
        update_data["home_location"] = {
            "state": data.new_state,
            "district": data.new_district,
            "lat": data.new_lat,
            "lng": data.new_lng
        }
        # Add to location history
        await db[FARMER_PROFILES_COLLECTION].update_one(
            {"username": data.username},
            {"$push": {
                "location_history": {
                    "state": data.new_state,
                    "district": data.new_district,
                    "from": datetime.utcnow().strftime("%Y-%m-%d"),
                    "to": "present"
                }
            }}
        )

    await db[FARMER_PROFILES_COLLECTION].update_one(
        {"username": data.username},
        {"$set": update_data}
    )

    move_type = "Temporary visit" if data.is_temporary else "Permanent move"

    return MessageResponse(
        message=f"{move_type} recorded. Location updated to {data.new_district}, {data.new_state}",
        success=True
    )


@router.get("/current/{username}")
async def get_current_location(username: str, current_user: dict = Depends(get_current_user)):
    """Get farmer's current active location."""
    if current_user["role"] != "admin" and current_user["username"] != username:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your account")

    db = get_db()

    profile = await db[FARMER_PROFILES_COLLECTION].find_one(
        {"username": username},
        {"current_location": 1, "home_location": 1, "_id": 0}
    )

    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Farmer profile not found"
        )

    return {
        "username": username,
        "current_location": profile["current_location"],
        "home_location": profile["home_location"]
    }