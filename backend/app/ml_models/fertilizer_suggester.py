import pickle
import json
import numpy as np
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent.parent / "saved_models"

with open(BASE / "fertilizer_metadata.json") as f:
    metadata = json.load(f)

model      = pickle.load(open(BASE / "fertilizer_model.pkl", "rb"))
scaler     = pickle.load(open(BASE / "fertilizer_scaler.pkl", "rb"))
le_soil    = pickle.load(open(BASE / "fertilizer_le_soil.pkl", "rb"))
le_crop    = pickle.load(open(BASE / "fertilizer_le_crop.pkl", "rb"))
le_output  = pickle.load(open(BASE / "fertilizer_le_output.pkl", "rb"))

CROP_NPK_REQUIREMENTS = metadata["crop_npk_requirements"]
CROP_TYPES = metadata["crops"]
SOIL_TYPES = metadata["soils"]
DEFAULT_TOP_N = metadata.get("default_top_n", 5)

print(f"✅ Fertilizer Suggester v2 loaded — {metadata['n_classes']} classes, "
      f"{len(CROP_TYPES)} crops, deficit-based features "
      f"(cv accuracy {metadata['cv_accuracy_mean']:.2f} ± {metadata['cv_accuracy_std']:.2f})")

if metadata.get("low_sample_classes"):
    print(f"   ⚠️  Low-sample classes (fewer training examples, less reliable): {metadata['low_sample_classes']}")


def suggest_fertilizer(
    temperature: float,
    humidity: float,
    moisture: float,
    soil_type: str,
    crop_type: str,
    nitrogen: float,
    potassium: float,
    phosphorous: float,
    top_n: int = None
) -> dict:
    """
    Ranked fertilizer recommendations using NPK-deficit features (crop
    requirement minus actual soil reading) rather than raw NPK + crop
    category — this is what actually makes crop_type influence the
    prediction, instead of it being a near-ignored categorical alongside
    six other features like the v1 model.
    """
    if crop_type not in CROP_NPK_REQUIREMENTS:
        raise ValueError(f"Crop '{crop_type}' not recognized. Available: {CROP_TYPES}")
    if soil_type not in SOIL_TYPES:
        raise ValueError(f"Soil '{soil_type}' not recognized. Available: {SOIL_TYPES}")

    req = CROP_NPK_REQUIREMENTS[crop_type]
    n_deficit = req["N"] - nitrogen
    p_deficit = req["P"] - phosphorous
    k_deficit = req["K"] - potassium

    soil_enc = le_soil.transform([soil_type])[0]

    # Order must exactly match metadata["features"]:
    # ["Temparature", "Humidity ", "Moisture", "Soil_enc", "N_deficit", "P_deficit", "K_deficit"]
    features = np.array([[temperature, humidity, moisture, soil_enc, n_deficit, p_deficit, k_deficit]])
    features_scaled = scaler.transform(features)

    proba = model.predict_proba(features_scaled)[0]
    n = top_n or DEFAULT_TOP_N
    n = min(n, len(proba))  # can't return more than the model actually has classes
    ranked_idx = proba.argsort()[::-1][:n]

    recommendations = [
        {
            "fertilizer": le_output.inverse_transform([idx])[0],
            "confidence": round(float(proba[idx]) * 100, 2),
            "low_sample": le_output.inverse_transform([idx])[0] in metadata.get("low_sample_classes", []),
        }
        for idx in ranked_idx
    ]

    return {
        "recommendations": recommendations,
        "soil_type": soil_type,
        "crop_type": crop_type,
        "deficits": {"N": n_deficit, "P": p_deficit, "K": k_deficit},
    }


def get_available_types() -> dict:
    """Returns available soil and crop types the model was trained on."""
    return {
        "soil_types": SOIL_TYPES,
        "crop_types": CROP_TYPES,
    }