from fastapi import APIRouter, HTTPException, status
from datetime import datetime
from app.db.database import get_db
from app.db.models import FARMER_PROFILES_COLLECTION
from app.db.schemas import OnboardingData, OnboardingResponse

router = APIRouter()


@router.post("/save", response_model=OnboardingResponse)
async def save_onboarding(data: OnboardingData):
    """
    Save farmer's one-time onboarding profile.
    Called once after registration — never again unless farmer wants to update.
    Stores: soil type, farm size, preferred crops, irrigation, language, GPS location.
    """
    db = get_db()

    # Check if profile already exists
    existing = await db[FARMER_PROFILES_COLLECTION].find_one(
        {"username": data.username}
    )

    profile_doc = {
        "username": data.username,
        "soil_type": data.soil_type,
        "soil_image_url": data.soil_image_url,
        "farm_acres": data.farm_acres,
        "preferred_crops": data.preferred_crops,
        "irrigation_type": data.irrigation_type,
        "main_problem": data.main_problem,
        "chat_language": data.chat_language,
        "home_location": {
            "state": data.home_location.state,
            "district": data.home_location.district,
            "village": data.home_location.village,
            "lat": data.home_location.lat,
            "lng": data.home_location.lng
        },
        "current_location": {
            "state": data.home_location.state,
            "district": data.home_location.district,
            "lat": data.home_location.lat,
            "lng": data.home_location.lng,
            "is_temporary": False,
            "detected_at": datetime.utcnow().strftime("%Y-%m-%d")
        },
        "location_history": [
            {
                "state": data.home_location.state,
                "district": data.home_location.district,
                "from": datetime.utcnow().strftime("%Y-%m-%d"),
                "to": "present"
            }
        ],
        "onboarding_complete": True,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }

    if existing:
        # Update existing profile
        await db[FARMER_PROFILES_COLLECTION].update_one(
            {"username": data.username},
            {"$set": profile_doc}
        )
        message = "Profile updated successfully"
    else:
        # Create new profile
        await db[FARMER_PROFILES_COLLECTION].insert_one(profile_doc)
        message = "Onboarding completed successfully"

    return OnboardingResponse(
        message=message,
        username=data.username,
        onboarding_complete=True
    )


@router.get("/profile/{username}")
async def get_onboarding_profile(username: str):
    """Get farmer's full onboarding profile."""
    db = get_db()

    profile = await db[FARMER_PROFILES_COLLECTION].find_one(
        {"username": username},
        {"_id": 0}
    )

    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Onboarding profile not found. Please complete onboarding first."
        )

    return profile