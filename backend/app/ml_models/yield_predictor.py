import pickle
import numpy as np
import json
from pathlib import Path

# ── Load all three unit-group models once at startup ─────────────────────────
BASE = Path("saved_models")

with open(BASE / "yield_metadata.json", "r") as f:
    metadata = json.load(f)

CROP_UNIT_MAP = metadata["crop_unit_map"]
GROUPS_META = metadata["groups"]

_GROUP_FILE_PREFIX = {"weight": "yield_weight", "count": "yield_count", "bale": "yield_bale"}


def _load_group(group: str) -> dict:
    prefix = _GROUP_FILE_PREFIX[group]
    return {
        "model":     pickle.load(open(BASE / f"{prefix}_model.pkl", "rb")),
        "scaler_X":  pickle.load(open(BASE / f"{prefix}_scaler_X.pkl", "rb")),
        "scaler_y":  pickle.load(open(BASE / f"{prefix}_scaler_y.pkl", "rb")),
        "le_state":  pickle.load(open(BASE / f"{prefix}_le_state.pkl", "rb")),
        "le_crop":   pickle.load(open(BASE / f"{prefix}_le_crop.pkl", "rb")),
        "le_season": pickle.load(open(BASE / f"{prefix}_le_season.pkl", "rb")),
        "y_min":     GROUPS_META[group]["y_min"],
        "y_max":     GROUPS_META[group]["y_max"],
    }


GROUP_MODELS = {group: _load_group(group) for group in _GROUP_FILE_PREFIX}

print(f"✅ Yield Predictor models loaded — {len(CROP_UNIT_MAP)} crops across {len(GROUP_MODELS)} unit groups")

# Combined list across all groups, for a single "what crops exist at all" check.
AVAILABLE_CROPS = sorted(CROP_UNIT_MAP.keys())
# Seasons/states shown to the frontend are the union across groups — the
# per-group encoder still enforces which are actually valid for that crop's
# specific model at predict time.
AVAILABLE_SEASONS = sorted({s for g in GROUPS_META.values() for s in g["seasons"]})
AVAILABLE_STATES = sorted({s for g in GROUPS_META.values() for s in g["states"]})


def get_crop_unit(crop: str) -> str:
    """Returns 'weight' | 'count' | 'bale' for a given crop, or raises ValueError."""
    unit = CROP_UNIT_MAP.get(crop)
    if unit is None:
        raise ValueError(f"Crop '{crop}' not recognized. Available: {AVAILABLE_CROPS[:5]}...")
    return {"tonnes_per_hectare": "weight", "nuts_per_hectare": "count", "bales_per_hectare": "bale"}[unit]


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
    Routes to the correct unit-group model (weight/count/bale) for the crop,
    and returns a response shape matching that group's real-world unit —
    a single blended "yield_per_hectare" number would be meaningless across
    groups with genuinely different measurement bases.
    """
    group = get_crop_unit(crop)
    g = GROUP_MODELS[group]

    try:
        state_enc = g["le_state"].transform([state])[0]
    except ValueError:
        raise ValueError(f"State '{state}' not in training data for {crop} ({group} model).")

    try:
        crop_enc = g["le_crop"].transform([crop])[0]
    except ValueError:
        raise ValueError(f"Crop '{crop}' not in training data for the {group} model.")

    try:
        season_enc = g["le_season"].transform([season])[0]
    except ValueError:
        raise ValueError(f"Season '{season}' not valid for {crop} ({group} model).")

    input_data = np.array([[
        state_enc, crop_enc, season_enc,
        year, area_hectares,
        rainfall, fertilizer, pesticide
    ]])

    input_scaled = g["scaler_X"].transform(input_data)
    pred_scaled = g["model"].predict(input_scaled)
    raw_predicted_value = float(g["scaler_y"].inverse_transform(pred_scaled.reshape(-1, 1))[0][0])

    # Sanity-check against the training range *before* clipping — a raw
    # prediction outside what the model ever saw (including negative, which
    # is physically impossible for a yield) usually means a bad/unusual
    # input combination more than a bad model, worth surfacing rather than
    # silently returning a number that looks plausible but isn't.
    out_of_range = raw_predicted_value < g["y_min"] or raw_predicted_value > g["y_max"] * 1.5

    # Yield can never be negative in reality — clip after the check above so
    # the warning still reflects what the model actually produced.
    predicted_value = max(0.0, raw_predicted_value)

    base = {
        "state": state,
        "crop": crop,
        "season": season,
        "year": year,
        "area_hectares": area_hectares,
        "unit_group": group,
        "out_of_range_warning": out_of_range,
    }

    if group == "weight":
        yield_tonnes_per_ha = predicted_value
        yield_kg_per_ha = yield_tonnes_per_ha * 1000
        total_kg = yield_kg_per_ha * area_hectares
        base.update({
            "yield_tonnes_per_ha": round(yield_tonnes_per_ha, 3),
            "yield_kg_per_ha": round(yield_kg_per_ha, 2),
            "total_quintals": round(total_kg / 100, 2),
            "total_kg": round(total_kg, 2),
        })
    elif group == "count":
        yield_nuts_per_ha = predicted_value
        base.update({
            "yield_nuts_per_ha": round(yield_nuts_per_ha, 0),
            "total_nuts": round(yield_nuts_per_ha * area_hectares, 0),
        })
    elif group == "bale":
        yield_bales_per_ha = predicted_value
        base.update({
            "yield_bales_per_ha": round(yield_bales_per_ha, 3),
            "total_bales": round(yield_bales_per_ha * area_hectares, 2),
        })

    return base


def get_available_options() -> dict:
    """Returns available crops, seasons and states for yield prediction."""
    return {
        "crops": AVAILABLE_CROPS,
        "seasons": AVAILABLE_SEASONS,
        "states": AVAILABLE_STATES,
        "crop_unit_map": CROP_UNIT_MAP,
    }