import numpy as np
import json
from pathlib import Path
from PIL import Image
import io

# ── Load model once at startup ────────────────────────────────────────────────
BASE = Path("saved_models")

# Load class info + treatments
with open(BASE / "disease_classes.json", "r") as f:
    disease_info = json.load(f)

CLASS_NAMES = disease_info["classes"]
IMG_SIZE    = disease_info.get("img_size", 224)
TREATMENTS  = disease_info.get("treatments", {})

# Load Keras model
try:
    from tensorflow.keras.models import load_model
    disease_model = load_model(str(BASE / "disease_model.h5"))
    print(f"✅ Disease Detector model loaded — {len(CLASS_NAMES)} disease classes")
except Exception as e:
    disease_model = None
    print(f"⚠️ Disease model load failed: {e}")


def get_treatment(class_name: str) -> dict:
    """Get treatment info for a disease class name."""
    # Try exact match first
    if class_name in TREATMENTS:
        return TREATMENTS[class_name]

    # Try partial match
    class_lower = class_name.lower()
    for key, treatment in TREATMENTS.items():
        if key.lower() in class_lower or class_lower in key.lower():
            return treatment

    # Default fallback
    return {
        "status":     class_name.replace("___", " — ").replace("_", " ").title(),
        "severity":   "Unknown",
        "treatment":  "Consult your local agricultural officer for diagnosis.",
        "prevention": "Monitor crops regularly and maintain good field hygiene."
    }


def detect_disease(image_bytes: bytes) -> dict:
    """
    Detect crop disease from leaf image bytes.
    Returns disease name, severity, confidence, treatment and prevention.
    """
    if disease_model is None:
        raise RuntimeError("Disease detection model not loaded")

    # Load and preprocess image
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    img = img.resize((IMG_SIZE, IMG_SIZE))

    img_array = np.array(img) / 255.0
    img_array = np.expand_dims(img_array, axis=0)

    # Predict
    predictions = disease_model.predict(img_array, verbose=0)
    pred_idx    = int(np.argmax(predictions[0]))
    confidence  = float(predictions[0][pred_idx]) * 100
    class_name  = CLASS_NAMES[pred_idx]

    # Get treatment info
    treatment_info = get_treatment(class_name)

    # Top 3 predictions
    top3_idx = np.argsort(predictions[0])[::-1][:3]
    top3 = [
        {
            "class":      CLASS_NAMES[i],
            "confidence": round(float(predictions[0][i]) * 100, 2)
        }
        for i in top3_idx
    ]

    return {
        "disease":     treatment_info.get("status", class_name),
        "class_name":  class_name,
        "severity":    treatment_info.get("severity", "Unknown"),
        "confidence":  round(confidence, 2),
        "treatment":   treatment_info.get("treatment", ""),
        "prevention":  treatment_info.get("prevention", ""),
        "top3":        top3,
        "is_healthy":  "healthy" in class_name.lower()
    }