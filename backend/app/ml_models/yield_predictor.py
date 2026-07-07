import pickle
import numpy as np
import json
from pathlib import Path

# ── Load models once at startup ───────────────────────────────────────────────
BASE = Path("saved_models")

model     = pickle.load(open(BASE / "yield_model.pkl",     "rb"))
scaler_X  = pickle.load(open(BASE / "yield_scaler_X.pkl", "rb"))
scaler_y  = pickle.load(open(BASE / "yield_scaler_y.pkl", "rb"))
le_state  = pickle.load(open(BASE / "yield_le_state.pkl", "rb"))
le_crop   = pickle.load(open(BASE / "yield_le_crop.pkl",  "rb"))
le_season = pickle.load(open(BASE / "yield_le_season.pkl","rb"))

# Load metadata
with open(BASE / "yield_metadata.json", "r") as f:
    metadata = json.load(f)

print("✅ Yield Predictor model loaded")

AVAILABLE_CROPS   = metadata.get("crops", [])
AVAILABLE_SEASONS = metadata.get("seasons", [])
AVAILABLE_STATES  = metadata.get("states", [])


def predict_yield(
    state: str,
    crop: str,
    season: str,
    year: int,
    area_hectares: float,
    rainfall: float = 1000.0,
    fertilizer: float = 100.0,
    pesticide: float = 1.0
) -> dict:
    """
    Predict crop yield based on state, crop, season, area and conditions.
    Returns yield per hectare and total yield in quintals.
    """
    try:
        state_enc  = le_state.transform([state])[0]
    except ValueError:
        raise ValueError(f"State '{state}' not in training data. Available: {AVAILABLE_STATES[:5]}...")

    try:
        crop_enc   = le_crop.transform([crop])[0]
    except ValueError:
        raise ValueError(f"Crop '{crop}' not in training data. Available: {AVAILABLE_CROPS[:5]}...")

    try:
        season_enc = le_season.transform([season])[0]
    except ValueError:
        raise ValueError(f"Season '{season}' not in training data. Available: {AVAILABLE_SEASONS}")

    input_data = np.array([[
        state_enc, crop_enc, season_enc,
        year, area_hectares,
        rainfall, fertilizer, pesticide
    ]])

    # Scale inputs
    input_scaled = scaler_X.transform(input_data)

    # Predict
    pred_scaled        = model.predict(input_scaled)
    yield_per_hectare  = float(scaler_y.inverse_transform(
        pred_scaled.reshape(-1, 1)
    )[0][0])

    # Convert to quintals
    yield_kg_per_ha    = yield_per_hectare * 1000
    total_kg           = yield_kg_per_ha * area_hectares
    total_quintals     = total_kg / 100

    return {
        "state":               state,
        "crop":                crop,
        "season":              season,
        "year":                year,
        "area_hectares":       area_hectares,
        "yield_tonnes_per_ha": round(yield_per_hectare, 3),
        "yield_kg_per_ha":     round(yield_kg_per_ha, 2),
        "total_quintals":      round(total_quintals, 2),
        "total_kg":            round(total_kg, 2)
    }


def get_available_options() -> dict:
    """Returns available crops, seasons and states for yield prediction."""
    return {
        "crops":   AVAILABLE_CROPS,
        "seasons": AVAILABLE_SEASONS,
        "states":  AVAILABLE_STATES
    }