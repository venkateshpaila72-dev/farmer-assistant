from fastapi import APIRouter, UploadFile, File, HTTPException, Form
from app.utils.cloudinary_utils import upload_image

router = APIRouter()


@router.post("/file")
async def upload_file(
    file: UploadFile = File(...),
    folder: str = Form(default="farmer_assistant")
):
    """
    Upload any image or PDF to Cloudinary.
    folder options:
      - soil_images     → soil classification photos
      - disease_images  → leaf disease detection photos
      - documents       → ICAR PDFs for RAG
    Returns public Cloudinary URL.
    """
    # Validate file type
    allowed_types = [
        "image/jpeg", "image/png", "image/jpg",
        "image/webp", "application/pdf"
    ]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=f"File type '{file.content_type}' not allowed. Use JPEG, PNG, or PDF."
        )

    # Read file bytes
    file_bytes = await file.read()

    # Upload to Cloudinary
    result = await upload_image(file_bytes, folder=folder)

    return {
        "success": True,
        "url": result["url"],
        "public_id": result["public_id"],
        "filename": file.filename,
        "folder": folder
    }