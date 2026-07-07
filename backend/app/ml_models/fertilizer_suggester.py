import pickle
import numpy as np
import pandas as pd
from pathlib import Path

# ── Load models once at startup ───────────────────────────────────────────────
BASE = Path("saved_models")

model      = pickle.load(open(BASE / "fertilizer_model.pkl",     "rb"))
scaler     = pickle.load(open(BASE / "fertilizer_scaler.pkl",    "rb"))
le_soil    = pickle.load(open(BASE / "fertilizer_le_soil.pkl",   "rb"))
le_crop    = pickle.load(open(BASE / "fertilizer_le_crop.pkl",   "rb"))
le_output  = pickle.load(open(BASE / "fertilizer_le_output.pkl", "rb"))

print("✅ Fertilizer Suggester model loaded")

# Available soil and crop types from training data
SOIL_TYPES = list(le_soil.classes_)
CROP_TYPES = list(le_crop.classes_)


def suggest_fertilizer(
    temperature: float,
    humidity: float,
    moisture: float,
    soil_type: str,
    crop_type: str,
    nitrogen: float,
    potassium: float,
    phosphorous: float
) -> dict:
    """
    Predict best fertilizer based on soil + crop + nutrient inputs.
    Returns fertilizer name with confidence.
    """
    # Encode categorical inputs
    try:
        soil_enc = le_soil.transform([soil_type])[0]
    except ValueError:
        # If soil type not in training data — use closest match
        soil_enc = 0

    try:
        crop_enc = le_crop.transform([crop_type])[0]
    except ValueError:
        crop_enc = 0

    input_df = pd.DataFrame([{
        "Temparature":        temperature,
        "Humidity ":          humidity,
        "Moisture":           moisture,
        "Soil Type Encoded":  soil_enc,
        "Crop Type Encoded":  crop_enc,
        "Nitrogen":           nitrogen,
        "Potassium":          potassium,
        "Phosphorous":        phosphorous
    }])

    # Scale
    scaled = scaler.transform(input_df)

    # Predict
    pred_idx   = model.predict(scaled)[0]
    proba      = model.predict_proba(scaled)[0]
    fertilizer = le_output.inverse_transform([pred_idx])[0]
    confidence = round(float(proba[pred_idx]) * 100, 2)

    return {
        "fertilizer":   fertilizer,
        "confidence":   confidence,
        "soil_type":    soil_type,
        "crop_type":    crop_type,
        "inputs_used": {
            "nitrogen":    nitrogen,
            "potassium":   potassium,
            "phosphorous": phosphorous,
            "temperature": temperature,
            "humidity":    humidity,
            "moisture":    moisture
        }
    }


def get_available_types() -> dict:
    """Returns available soil and crop types the model was trained on."""
    return {
        "soil_types": SOIL_TYPES,
        "crop_types": CROP_TYPES
    }