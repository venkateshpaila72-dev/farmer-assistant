import pickle
import numpy as np
import pandas as pd
from pathlib import Path

# ── Load models once at startup ───────────────────────────────────────────────
BASE = Path("saved_models")

model   = pickle.load(open(BASE / "crop_model.pkl",         "rb"))
scaler  = pickle.load(open(BASE / "crop_scaler.pkl",        "rb"))
encoder = pickle.load(open(BASE / "crop_label_encoder.pkl", "rb"))

print("✅ Crop Recommender model loaded")


def recommend_crop(
    N: float,
    P: float,
    K: float,
    temperature: float,
    humidity: float,
    ph: float,
    rainfall: float
) -> dict:
    """
    Predict best crop based on soil + weather inputs.
    Returns top 3 crops with confidence percentages.
    """
    input_df = pd.DataFrame([{
        "N":           N,
        "P":           P,
        "K":           K,
        "temperature": temperature,
        "humidity":    humidity,
        "ph":          ph,
        "rainfall":    rainfall
    }])

    # Scale inputs
    scaled = scaler.transform(input_df)

    # Predict
    pred_idx   = model.predict(scaled)[0]
    proba      = model.predict_proba(scaled)[0]

    # Top 3 crops
    top3_idx   = np.argsort(proba)[::-1][:3]
    top3_crops = [
        {
            "crop":       encoder.inverse_transform([i])[0],
            "confidence": round(float(proba[i]) * 100, 2)
        }
        for i in top3_idx
    ]

    return {
        "top_crops":    top3_crops,
        "best_crop":    top3_crops[0]["crop"],
        "confidence":   top3_crops[0]["confidence"],
        "inputs_used": {
            "N": N, "P": P, "K": K,
            "temperature": temperature,
            "humidity": humidity,
            "ph": ph,
            "rainfall": rainfall
        }
    }