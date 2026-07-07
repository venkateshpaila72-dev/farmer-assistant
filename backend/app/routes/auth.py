from fastapi import APIRouter, HTTPException, status
from app.db.database import get_db
from app.db.models import USERS_COLLECTION, ADMINS_COLLECTION
from app.db.schemas import UserLogin, AdminLogin, TokenResponse
from app.core.security import verify_password, create_token

router = APIRouter()


@router.post("/verifyuser", response_model=TokenResponse)
async def farmer_login(data: UserLogin):
    db = get_db()

    # Find farmer by username
    farmer = await db[USERS_COLLECTION].find_one({"username": data.username})
    if not farmer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Username not found"
        )

    # Verify password
    if not verify_password(data.password, farmer["password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect password"
        )

    # Create JWT token
    token = create_token({
        "sub": farmer["username"],
        "role": "user"
    })

    return TokenResponse(
        access_token=token,
        role="user",
        username=farmer["username"]
    )


@router.post("/verifyadmin", response_model=TokenResponse)
async def admin_login(data: AdminLogin):
    db = get_db()

    # Find admin by email
    admin = await db[ADMINS_COLLECTION].find_one({"email": data.email})
    if not admin:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Admin email not found"
        )

    # Verify password
    if not verify_password(data.password, admin["password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect password"
        )

    # Create JWT token
    token = create_token({
        "sub": admin["email"],
        "role": "admin"
    })

    return TokenResponse(
        access_token=token,
        role="admin",
        username=admin["name"]
    )