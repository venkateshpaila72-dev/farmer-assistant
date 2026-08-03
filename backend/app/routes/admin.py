from fastapi import APIRouter, HTTPException, status, Depends, UploadFile, File, Form
from datetime import datetime
from bson import ObjectId
from app.db.database import get_db
from app.db.models import (
    ADMINS_COLLECTION,
    USERS_COLLECTION,
    ANNOUNCEMENTS_COLLECTION
)
from app.db.schemas import AdminRegister, AdminResponse, MessageResponse
from app.core.security import hash_password, get_current_admin
from app.utils.cloudinary_utils import upload_image

router = APIRouter()


# NOTE: addnewadmin is intentionally left OPEN (no auth) so the very first
# admin account can be created on a fresh deployment. Once at least one
# admin exists, protect this in production by either:
#   (a) disabling this route after first use, or
#   (b) requiring an ADMIN_SIGNUP_SECRET passed alongside the request
# Everything else below requires a valid admin token.
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
async def get_all_farmers(admin: dict = Depends(get_current_admin)):
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
async def get_analytics(admin: dict = Depends(get_current_admin)):
    """Admin — platform usage stats."""
    db = get_db()

    total_farmers = await db[USERS_COLLECTION].count_documents({"role": "user"})
    total_admins  = await db[ADMINS_COLLECTION].count_documents({})

    return {
        "total_farmers": total_farmers,
        "total_admins": total_admins
    }


@router.post("/announcement", response_model=MessageResponse)
async def post_announcement(
    title: str = Form(...),
    content: str = Form(...),
    posted_by: str = Form(...),
    image: UploadFile = File(None),
    admin: dict = Depends(get_current_admin)
):
    """Admin — post a government scheme or farming announcement, with an optional image."""
    db = get_db()

    image_url = None
    if image is not None:
        contents = await image.read()
        if contents:
            result = await upload_image(contents, folder="announcements")
            image_url = result["url"]

    announcement_doc = {
        "title":      title,
        "content":    content,
        "posted_by":  posted_by,
        "image_url":  image_url,
        "created_at": datetime.utcnow(),
        "updated_at": None  # set when the announcement is later edited
    }

    await db[ANNOUNCEMENTS_COLLECTION].insert_one(announcement_doc)

    return MessageResponse(
        message="Announcement posted successfully",
        success=True
    )


@router.put("/announcement/{announcement_id}", response_model=MessageResponse)
async def edit_announcement(
    announcement_id: str,
    title: str = Form(...),
    content: str = Form(...),
    image: UploadFile = File(None),
    admin: dict = Depends(get_current_admin)
):
    """
    Admin — edit a previously posted announcement. A new image (if given)
    replaces the old one; leaving it out keeps whatever image was already
    there. updated_at is set here so farmers can see it was edited/reposted,
    not just posted once and forgotten.
    """
    db = get_db()

    existing = await db[ANNOUNCEMENTS_COLLECTION].find_one({"_id": ObjectId(announcement_id)})
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Announcement not found")

    update_doc = {
        "title":      title,
        "content":    content,
        "updated_at": datetime.utcnow()
    }

    if image is not None:
        contents = await image.read()
        if contents:
            result = await upload_image(contents, folder="announcements")
            update_doc["image_url"] = result["url"]

    await db[ANNOUNCEMENTS_COLLECTION].update_one(
        {"_id": ObjectId(announcement_id)},
        {"$set": update_doc}
    )

    return MessageResponse(
        message="Announcement updated successfully",
        success=True
    )


@router.get("/announcements")
async def get_announcements():
    """Get all announcements — visible to all farmers."""
    db = get_db()

    cursor = db[ANNOUNCEMENTS_COLLECTION].find({}).sort("created_at", -1).limit(50)
    announcements = []
    async for doc in cursor:
        doc["id"] = str(doc.pop("_id"))
        announcements.append(doc)

    return {
        "total": len(announcements),
        "announcements": announcements
    }