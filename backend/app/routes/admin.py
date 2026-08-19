from fastapi import APIRouter, HTTPException, status, Depends, UploadFile, File, Form
from datetime import datetime
from bson import ObjectId
import re
from app.db.database import get_db
from app.db.models import (
    ADMINS_COLLECTION,
    USERS_COLLECTION,
    ANNOUNCEMENTS_COLLECTION
)
from app.db.schemas import AdminRegister, AdminResponse, MessageResponse, UpdateFarmerPhone
from app.core.security import hash_password, get_current_admin
from app.utils.cloudinary_utils import upload_image
from app.utils.groq_utils import draft_scheme_from_news
from pydantic import BaseModel

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


@router.put("/farmer/{username}/phone", response_model=MessageResponse)
async def update_farmer_phone(
    username: str,
    data: UpdateFarmerPhone,
    admin: dict = Depends(get_current_admin)
):
    """
    Admin — correct a farmer's phone number. This is the number the daily
    WhatsApp report goes to (see agents/supervisor.py's _think_node, which
    reads USERS_COLLECTION.phone) — there's no separate copy anywhere else
    to keep in sync.

    Validation here is intentionally loose (digit-count only, no country-
    code enforcement) since farmer.phone is stored as free text elsewhere
    in this codebase too (see UserRegister) — send_whatsapp_message's own
    _format_whatsapp_number normalizes it at send time.
    """
    db = get_db()

    phone = data.phone.strip()
    digit_count = len(re.sub(r"\D", "", phone))
    if digit_count < 10:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Phone number looks too short — check the digits and try again"
        )

    result = await db[USERS_COLLECTION].update_one(
        {"username": username, "role": "user"},
        {"$set": {"phone": phone}}
    )
    if result.matched_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Farmer not found"
        )

    return MessageResponse(
        message=f"Phone number updated for '{username}'",
        success=True
    )


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


class DraftFromNewsRequest(BaseModel):
    title: str
    source_text: str = ""   # article description/snippet, and/or anything
                             # extra the admin pastes in for more context
    url: str = ""


@router.post("/announcement/draft-from-news")
async def draft_announcement_from_news(
    body: DraftFromNewsRequest,
    admin: dict = Depends(get_current_admin)
):
    """
    AI-assisted first draft of a scheme announcement, from a real news
    item (e.g. one the admin found in the farmer-facing Schemes tab).

    This does NOT post anything — it only returns a draft for the admin
    form to pre-fill, which the admin then reviews/edits/discards before
    ever hitting the actual Post button. See draft_scheme_from_news's own
    docstring for why that review step is non-negotiable: getting a real
    scheme's eligibility or benefit amount wrong could genuinely mislead
    a farmer about money they may or may not be entitled to.
    """
    if not body.title.strip():
        raise HTTPException(status_code=400, detail="Article title is required")

    draft = draft_scheme_from_news(
        title=body.title.strip(),
        source_text=body.source_text.strip(),
        url=body.url.strip()
    )
    return draft


@router.post("/announcement", response_model=MessageResponse)
async def post_announcement(
    title: str = Form(...),
    content: str = Form(...),
    posted_by: str = Form(...),
    benefit: str = Form(""),
    eligibility: str = Form(""),
    where_to_apply: str = Form(""),
    official_link: str = Form(""),
    scheme_status: str = Form("active"),
    image: UploadFile = File(None),
    admin: dict = Depends(get_current_admin)
):
    """Admin — post a government scheme or farming announcement, with an
    optional image and optional structured scheme fields (benefit,
    eligibility, where_to_apply, official_link, scheme_status) that render
    as a scannable scheme card on the farmer-facing feed instead of a
    free-text paragraph. All are optional — a plain non-scheme
    announcement just leaves them blank/default.

    Note: this Form param is named scheme_status, not status — `status`
    is already imported from fastapi in this file (for HTTP status codes),
    and a same-named parameter would shadow it within this function."""
    db = get_db()

    image_url = None
    if image is not None:
        contents = await image.read()
        if contents:
            result = await upload_image(contents, folder="announcements")
            image_url = result["url"]

    announcement_doc = {
        "title":          title,
        "content":        content,
        "posted_by":      posted_by,
        "benefit":        benefit or None,
        "eligibility":    eligibility or None,
        "where_to_apply": where_to_apply or None,
        "official_link":  official_link or None,
        "status":         scheme_status or "active",
        "image_url":      image_url,
        "created_at":     datetime.utcnow(),
        "updated_at":     None  # set when the announcement is later edited
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
    benefit: str = Form(""),
    eligibility: str = Form(""),
    where_to_apply: str = Form(""),
    official_link: str = Form(""),
    scheme_status: str = Form("active"),
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
        "title":          title,
        "content":        content,
        "benefit":        benefit or None,
        "eligibility":    eligibility or None,
        "where_to_apply": where_to_apply or None,
        "official_link":  official_link or None,
        "status":         scheme_status or "active",
        "updated_at":     datetime.utcnow()
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