from fastapi import APIRouter, HTTPException, status
from datetime import datetime
from app.db.database import get_db
from app.db.models import (
    ADMINS_COLLECTION,
    USERS_COLLECTION,
    ANNOUNCEMENTS_COLLECTION
)
from app.db.schemas import AdminRegister, AdminResponse, MessageResponse, AnnouncementCreate
from app.core.security import hash_password

router = APIRouter()


@router.post("/addnewadmin", response_model=MessageResponse)
async def register_admin(data: AdminRegister):
    db = get_db()

    # Check email not already taken
    existing = await db[ADMINS_COLLECTION].find_one({"email": data.email})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Admin email already exists"
        )

    admin_doc = {
        "name": data.name,
        "email": data.email,
        "password": hash_password(data.password),
        "role": "admin",
        "created_at": datetime.utcnow()
    }

    await db[ADMINS_COLLECTION].insert_one(admin_doc)

    return MessageResponse(
        message=f"Admin '{data.name}' registered successfully",
        success=True
    )


@router.get("/all-farmers")
async def get_all_farmers():
    """Admin — view all registered farmers."""
    db = get_db()

    farmers = await db[USERS_COLLECTION].find(
        {"role": "user"},
        {"password": 0, "_id": 0}    # exclude password and _id from response
    ).to_list(length=1000)

    return {
        "total": len(farmers),
        "farmers": farmers
    }


@router.get("/analytics")
async def get_analytics():
    """Admin — platform usage stats."""
    db = get_db()

    total_farmers = await db[USERS_COLLECTION].count_documents({"role": "user"})
    total_admins  = await db[ADMINS_COLLECTION].count_documents({})

    return {
        "total_farmers": total_farmers,
        "total_admins": total_admins
    }


@router.post("/announcement", response_model=MessageResponse)
async def post_announcement(data: AnnouncementCreate):
    """Admin — post a government scheme or farming announcement."""
    db = get_db()

    announcement_doc = {
        "title": data.title,
        "content": data.content,
        "posted_by": data.posted_by,
        "created_at": datetime.utcnow()
    }

    await db[ANNOUNCEMENTS_COLLECTION].insert_one(announcement_doc)

    return MessageResponse(
        message="Announcement posted successfully",
        success=True
    )


@router.get("/announcements")
async def get_announcements():
    """Get all announcements — visible to all farmers."""
    db = get_db()

    announcements = await db[ANNOUNCEMENTS_COLLECTION].find(
        {},
        {"_id": 0}
    ).sort("created_at", -1).to_list(length=50)

    return {
        "total": len(announcements),
        "announcements": announcements
    }