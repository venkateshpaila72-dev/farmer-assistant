from fastapi import APIRouter, HTTPException, status, Depends
from datetime import datetime
from app.db.database import get_db
from app.db.models import USERS_COLLECTION, FARMER_PROFILES_COLLECTION
from app.db.schemas import UserRegister, UserResponse, MessageResponse
from app.core.security import hash_password, get_current_user

router = APIRouter()


@router.get("/verifynewuser/{username}")
async def check_username_available(username: str):
    """Check if username is already taken before registering."""
    db = get_db()
    existing = await db[USERS_COLLECTION].find_one({"username": username})
    if existing:
        return {"available": False, "message": "Username already taken"}
    return {"available": True, "message": "Username is available"}


@router.post("/addnewuser", response_model=MessageResponse)
async def register_farmer(data: UserRegister):
    db = get_db()

    # Check username not already taken
    existing = await db[USERS_COLLECTION].find_one({"username": data.username})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already exists"
        )

    # Save farmer to MongoDB
    farmer_doc = {
        "username": data.username,
        "password": hash_password(data.password),
        "phone": data.phone,
        "door_no": data.door_no,
        "village": data.village,
        "city": data.city,
        "state": data.state,
        "role": "user",
        "created_at": datetime.utcnow()
    }

    await db[USERS_COLLECTION].insert_one(farmer_doc)

    return MessageResponse(
        message=f"Farmer '{data.username}' registered successfully",
        success=True
    )


@router.get("/profile/{username}", response_model=UserResponse)
async def get_farmer_profile(username: str, current_user: dict = Depends(get_current_user)):
    # A farmer can only view their own profile; admins can view any profile.
    if current_user["role"] != "admin" and current_user["username"] != username:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only view your own profile"
        )

    db = get_db()

    farmer = await db[USERS_COLLECTION].find_one({"username": username})
    if not farmer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Farmer not found"
        )

    return UserResponse(
        username=farmer["username"],
        phone=farmer["phone"],
        village=farmer["village"],
        city=farmer["city"],
        state=farmer["state"],
        role=farmer["role"],
        created_at=farmer.get("created_at")
    )


@router.get("/onboarding-status/{username}")
async def check_onboarding_status(username: str):
    """Check if farmer has completed onboarding profile setup."""
    db = get_db()
    profile = await db[FARMER_PROFILES_COLLECTION].find_one({"username": username})
    return {
        "username": username,
        "onboarding_complete": profile is not None
    }