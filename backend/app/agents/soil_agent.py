"""
Soil Agent — deterministic, no Groq calls.

Checks whether the farmer's saved soil type is well-suited to their
preferred crops, using a simple lookup table of common Indian soil-crop
pairings. Intentionally simple — no real soil moisture sensor data
available, anything more elaborate would be guessing.

No "dangerous" tier here — a soil/crop mismatch is suboptimal, not urgent,
so it only ever appears in the calm daily report, never as an alert.
danger_findings is always empty but present for a consistent shape across
all 4 agents, so supervisor.py doesn't need agent-specific handling.
"""

SOIL_CROP_SUITABILITY = {
    "red_loamy":  ["rice", "wheat", "cotton", "groundnut", "millets", "pulses"],
    "black":      ["cotton", "wheat", "soybean", "sugarcane", "jowar", "tobacco"],
    "alluvial":   ["rice", "wheat", "sugarcane", "maize", "tomato", "vegetables"],
    "clayey":     ["rice", "wheat", "sugarcane"],
    "sandy":      ["groundnut", "millets", "bajra", "watermelon", "vegetables"],
    "loamy":      ["rice", "wheat", "tomato", "maize", "vegetables", "cotton"],
    "laterite":   ["tea", "coffee", "cashew", "rubber", "tapioca"],
}


def check_soil_suitability(soil_type: str, preferred_crops: list) -> dict:
    """
    Run soil suitability check for a farmer's saved profile.
    Pure lookup — no API calls, no LLM, instant.
    """
    base = {
        "agent":           "soil",
        "risk_found":      False,
        "danger_found":    False,
        "findings":        [],
        "danger_findings": []
    }

    if not soil_type:
        base["findings"] = [{
            "type":   "missing_soil_data", "tier": "notable",
            "detail": "No soil type on file — recommend farmer upload a soil photo or update profile"
        }]
        base["risk_found"] = True
        return base

    normalized_soil = soil_type.lower().replace(" ", "_")
    suitable_crops  = SOIL_CROP_SUITABILITY.get(normalized_soil, [])

    if not suitable_crops:
        base["findings"] = [{
            "type":   "unrecognized_soil_type", "tier": "notable",
            "detail": f"Soil type '{soil_type}' not in suitability table — cannot assess"
        }]
        base["risk_found"] = True
        return base

    findings = []
    for crop in preferred_crops or []:
        crop_lower = crop.lower().strip()
        if crop_lower not in suitable_crops:
            findings.append({
                "type":     "soil_crop_mismatch", "tier": "notable",
                "severity": "medium",
                "detail":   f"'{crop}' is not typically well-suited to {soil_type} soil. "
                            f"Better suited crops for this soil: {', '.join(suitable_crops[:4])}"
            })

    base["findings"]   = findings
    base["risk_found"] = len(findings) > 0
    base["raw"] = {
        "soil_type":       soil_type,
        "preferred_crops": preferred_crops,
        "suitable_crops":  suitable_crops
    }
    return base