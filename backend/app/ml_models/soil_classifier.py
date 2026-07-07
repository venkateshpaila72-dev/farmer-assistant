import numpy as np
import json
from pathlib import Path
from PIL import Image
import io

# ── Load model once at startup ────────────────────────────────────────────────
BASE = Path("saved_models")

# Load class info
with open(BASE / "soil_classes.json", "r") as f:
    soil_info = json.load(f)

CLASS_NAMES = soil_info["classes"]
IMG_SIZE    = soil_info.get("img_size", 224)
NUM_CLASSES = soil_info["num_classes"]

# Load Keras model — imported here to avoid slow startup if tensorflow not needed
try:
    from tensorflow.keras.models import load_model
    soil_model = load_model(str(BASE / "soil_model.h5"))
    print(f"✅ Soil Classifier model loaded — {NUM_CLASSES} soil types")
except Exception as e:
    soil_model = None
    print(f"⚠️ Soil model load failed: {e}")


def classify_soil(image_bytes: bytes) -> dict:
    """
    Classify soil type from image bytes.
    Returns soil type, confidence, and all class probabilities.
    """
    if soil_model is None:
        raise RuntimeError("Soil classification model not loaded")

    # Load and preprocess image
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    img = img.resize((IMG_SIZE, IMG_SIZE))

    img_array = np.array(img) / 255.0
    img_array = np.expand_dims(img_array, axis=0)

    # Predict
    predictions = soil_model.predict(img_array, verbose=0)
    pred_idx    = int(np.argmax(predictions[0]))
    confidence  = float(predictions[0][pred_idx]) * 100
    soil_type   = CLASS_NAMES[pred_idx]

    # All probabilities
    all_probs = {
        CLASS_NAMES[i]: round(float(predictions[0][i]) * 100, 2)
        for i in range(len(CLASS_NAMES))
    }

    return {
        "soil_type":          soil_type,
        "confidence":         round(confidence, 2),
        "all_probabilities":  all_probs
    }