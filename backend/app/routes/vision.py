from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from datetime import datetime
from app.db.database import get_db
from app.db.models import FARMER_PROFILES_COLLECTION, DISEASE_LOGS_COLLECTION
from app.utils.cloudinary_utils import upload_image
from app.ml_models import soil_classifier, disease_detector
from app.core.security import get_current_user
from app.utils.chat_history import save_message

router = APIRouter()


def _format_soil_chat_summary(result: dict) -> str:
    """Plain-language summary saved into chat history when a soil photo is
    analyzed from inside the chat UI — written as if the assistant itself
    had just looked at the photo and answered, so it reads naturally in
    the conversation and gives the agent context for later questions."""
    return (
        f"[Soil photo analyzed] This soil looks like **{result['soil_type']}** "
        f"({result['confidence']*100:.0f}% confidence). I've noted this as your soil type."
    )


def _format_fertilizer(fert: dict) -> str:
    """The ML model's fertilizer field is a structured object
    ({applicable, name, method, related_fertilizers: [{name, reason}]} when
    applicable, or {applicable: False, note} when not) — never a plain
    string. Stringifying it directly (as the first version of this file
    did) produces literal '[object Object]'/dict-repr text. This turns it
    into a readable sentence instead."""
    if not fert or not fert.get("applicable"):
        return (fert or {}).get("note") or "No fertilizer recommendation for this condition."

    parts = [fert.get("name", "")]
    if fert.get("method"):
        parts.append(fert["method"])

    related = fert.get("related_fertilizers") or []
    options = "; ".join(
        f"{r.get('name')} ({r['reason']})" if r.get("reason") else r.get("name", "")
        for r in related if r.get("name")
    )
    if options:
        parts.append(f"Options: {options}")

    return " ".join(p for p in parts if p)


def _format_disease_chat_summary(result: dict) -> str:
    """Same idea for disease detection — includes treatment, prevention and
    fertilizer so the full recommendation shows up in the chat thread, not
    just in the one-off API response."""
    if result.get("is_healthy"):
        return "[Crop photo analyzed] Good news — this plant looks healthy, no disease detected."

    lines = [
        f"[Crop photo analyzed] I found {result['disease']} "
        f"({result['confidence']*100:.0f}% confidence, severity: {result['severity']}).",
        f"\nTreatment: {result['treatment']}",
        f"\nFertilizer recommendation: {_format_fertilizer(result.get('fertilizer'))}",
        f"\nPrevention tips: {result['prevention']}",
    ]
    return "".join(lines)


# ── Soil Classification ────────────────────────────────────────────────────────

@router.post("/classify-soil")
async def classify_soil(
    username: str,
    file: UploadFile = File(...),
    update_profile: bool = True,
    log_to_chat: bool = False,
    current_user: dict = Depends(get_current_user)
):
    """
    Classify soil type from uploaded photo.
    By default saves the result to the farmer's profile in MongoDB — pass
    update_profile=false to just get the classification back (e.g. for a
    "preview crop recommendations for this soil" flow that shouldn't
    silently overwrite the farmer's actual saved soil type).
    Supported: JPEG, PNG, JPG, WEBP
    """
    if current_user["role"] != "admin" and current_user["username"] != username:
        raise HTTPException(status_code=403, detail="Not your account")

    allowed = ["image/jpeg", "image/png", "image/jpg", "image/webp"]
    if file.content_type not in allowed:
        raise HTTPException(status_code=400, detail="Only image files allowed")

    # Read image bytes
    image_bytes = await file.read()

    # Classify soil
    try:
        result = soil_classifier.classify_soil(image_bytes)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Soil classification failed: {str(e)}")

    # Upload to Cloudinary
    try:
        uploaded = await upload_image(image_bytes, folder="soil_images")
        image_url = uploaded["url"]
    except Exception:
        image_url = None

    db = get_db()

    # Update farmer profile with soil type — only if requested
    if update_profile:
        await db[FARMER_PROFILES_COLLECTION].update_one(
            {"username": username},
            {"$set": {
                "soil_type":      result["soil_type"].lower().replace(" ", "_"),
                "soil_image_url": image_url,
                "updated_at":     datetime.utcnow()
            }}
        )

    # Log into chat history when this photo was uploaded from inside the
    # chat UI, so it shows up in the conversation thread on reload and the
    # agent has it as context for follow-up questions in the same session.
    if log_to_chat:
        await save_message(username, "assistant", _format_soil_chat_summary(result), db)

    return {
        "username":          username,
        "soil_type":         result["soil_type"],
        "confidence":        result["confidence"],
        "all_probabilities": result["all_probabilities"],
        "image_url":         image_url,
        "profile_updated":   update_profile,
        "message":           (
            f"Soil classified as {result['soil_type']} — profile updated!"
            if update_profile
            else f"Soil classified as {result['soil_type']}."
        )
    }


# ── Disease Detection ──────────────────────────────────────────────────────────

@router.post("/detect-disease")
async def detect_disease(
    username: str,
    file: UploadFile = File(...),
    log_to_chat: bool = False,
    current_user: dict = Depends(get_current_user)
):
    """
    Detect crop disease from leaf photo.
    Saves detection log to MongoDB for agent to reference.
    Returns disease name, severity, treatment and prevention.
    """
    if current_user["role"] != "admin" and current_user["username"] != username:
        raise HTTPException(status_code=403, detail="Not your account")

    allowed = ["image/jpeg", "image/png", "image/jpg", "image/webp"]
    if file.content_type not in allowed:
        raise HTTPException(status_code=400, detail="Only image files allowed")

    # Read image bytes
    image_bytes = await file.read()

    # Detect disease
    try:
        result = disease_detector.detect_disease(image_bytes)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Disease detection failed: {str(e)}")

    # Upload to Cloudinary
    try:
        uploaded  = await upload_image(image_bytes, folder="disease_images")
        image_url = uploaded["url"]
    except Exception:
        image_url = None

    # Save disease log to MongoDB
    # Agent reads this every morning to check farmer's disease history
    db = get_db()
    await db[DISEASE_LOGS_COLLECTION].insert_one({
        "username":    username,
        "disease":     result["disease"],
        "class_name":  result["class_name"],
        "severity":    result["severity"],
        "confidence":  result["confidence"],
        "treatment":   result["treatment"],
        "prevention":  result["prevention"],
        "is_healthy":  result["is_healthy"],
        "image_url":   image_url,
        "detected_at": datetime.utcnow()
    })

    if log_to_chat:
        await save_message(username, "assistant", _format_disease_chat_summary(result), db)

    return {
        "username":   username,
        "disease":    result["disease"],
        "severity":   result["severity"],
        "confidence": result["confidence"],
        "treatment":  result["treatment"],
        "prevention": result["prevention"],
        "fertilizer": result["fertilizer"],
        "is_healthy": result["is_healthy"],
        "top3":       result["top3"],
        "image_url":  image_url
    }


@router.get("/disease-history/{username}")
async def get_disease_history(username: str, limit: int = 10, current_user: dict = Depends(get_current_user)):
    """
    Get farmer's past disease detections.
    Used by disease agent to track crop health over time.
    """
    if current_user["role"] != "admin" and current_user["username"] != username:
        raise HTTPException(status_code=403, detail="Not your account")

    db = get_db()

    logs = await db[DISEASE_LOGS_COLLECTION].find(
        {"username": username},
        {"_id": 0}
    ).sort("detected_at", -1).limit(limit).to_list(length=limit)

    return {
        "username": username,
        "total":    len(logs),
        "history":  logs
    }