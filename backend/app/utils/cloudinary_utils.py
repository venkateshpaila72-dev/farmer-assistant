import cloudinary
import cloudinary.uploader
from app.core.config import settings

# Initialize Cloudinary
cloudinary.config(
    cloud_name=settings.CLOUDINARY_CLOUD_NAME,
    api_key=settings.CLOUDINARY_API_KEY,
    api_secret=settings.CLOUDINARY_API_SECRET
)


async def upload_image(file_bytes: bytes, folder: str = "farmer_assistant") -> dict:
    """
    Upload an image to Cloudinary.
    Returns public URL and public_id.
    folder: 'soil_images' / 'disease_images' / 'documents'
    """
    result = cloudinary.uploader.upload(
        file_bytes,
        folder=folder,
        resource_type="auto"
    )
    return {
        "url": result["secure_url"],
        "public_id": result["public_id"]
    }


async def delete_image(public_id: str) -> bool:
    """Delete an image from Cloudinary by public_id."""
    result = cloudinary.uploader.destroy(public_id)
    return result.get("result") == "ok"