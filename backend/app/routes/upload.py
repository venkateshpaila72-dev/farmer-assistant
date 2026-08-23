from fastapi import APIRouter, UploadFile, File, HTTPException, Form, Depends
from app.utils.cloudinary_utils import upload_image
from app.core.security import get_current_user
from app.core.config import settings

router = APIRouter()

# ── Safe folder allowlist ─────────────────────────────────────────────────────
ALLOWED_FOLDERS = {
    "farmer_assistant",
    "soil_images",
    "disease_images",
    "documents",
    "announcements",
}

# ── Allowed MIME types ────────────────────────────────────────────────────────
ALLOWED_TYPES = [
    "image/jpeg", "image/png", "image/jpg",
    "image/webp", "application/pdf"
]


async def validate_upload(file: UploadFile, folder: str) -> bytes:
    """Reusable upload validation — checks file type, folder, and size.
    Returns the file bytes if all checks pass.
    """
    # 1. File type check
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"File type '{file.content_type}' not allowed. Use JPEG, PNG, WEBP, or PDF."
        )

    # 2. Folder allowlist check
    if folder not in ALLOWED_FOLDERS:
        raise HTTPException(
            status_code=400,
            detail=f"Folder '{folder}' is not allowed. Allowed: {', '.join(sorted(ALLOWED_FOLDERS))}"
        )

    # 3. Read file bytes
    file_bytes = await file.read()

    # 4. Size limit check
    max_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
    if len(file_bytes) > max_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"File too large ({len(file_bytes) / (1024*1024):.1f} MB). Maximum allowed: {settings.MAX_UPLOAD_SIZE_MB} MB."
        )

    return file_bytes


@router.post("/file")
async def upload_file(
    file: UploadFile = File(...),
    folder: str = Form(default="farmer_assistant"),
    current_user: dict = Depends(get_current_user),
):
    """
    Upload any image or PDF to Cloudinary.
    Requires authentication. Only allowed folders are accepted.
    Maximum file size is controlled by MAX_UPLOAD_SIZE_MB setting.
    """
    # Validate type, folder, and size
    file_bytes = await validate_upload(file, folder)

    # Upload to Cloudinary
    result = await upload_image(file_bytes, folder=folder)

    return {
        "success": True,
        "url": result["url"],
        "public_id": result["public_id"],
        "filename": file.filename,
        "folder": folder
    }