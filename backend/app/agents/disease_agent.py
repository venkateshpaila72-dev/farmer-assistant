"""
Disease Agent — deterministic, no Groq calls.

Checks if the farmer has an unresolved disease detection (is_healthy=False)
within the last N days.

Tiers:
- "notable"   -> any unresolved detection, any severity -> goes in daily report
- "dangerous" -> severity explicitly high/severe -> triggers an alert
"""

from datetime import datetime, timedelta
from app.db.database import get_db
from app.db.models import DISEASE_LOGS_COLLECTION

UNRESOLVED_WINDOW_DAYS = 7
DANGEROUS_SEVERITIES   = ("high", "severe")


async def check_disease_status(username: str) -> dict:
    """
    Check the farmer's most recent disease detection (if any) and flag it
    if unresolved and within the recent window. Severity decides whether
    it's notable (daily report) or dangerous (alert).
    """
    db = get_db()
    cutoff = datetime.utcnow() - timedelta(days=UNRESOLVED_WINDOW_DAYS)

    log = await db[DISEASE_LOGS_COLLECTION].find_one(
        {
            "username":    username,
            "detected_at": {"$gte": cutoff}
        },
        sort=[("detected_at", -1)]
    )

    empty_result = {
        "agent":         "disease",
        "risk_found":    False,
        "danger_found":  False,
        "findings":      [],
        "danger_findings": []
    }

    if not log:
        return empty_result

    is_healthy = log.get("is_healthy", True)
    if is_healthy:
        return empty_result

    days_ago  = (datetime.utcnow() - log.get("detected_at")).days if log.get("detected_at") else None
    severity  = (log.get("severity") or "medium").lower()
    is_danger = severity in DANGEROUS_SEVERITIES

    finding = {
        "type":     "unresolved_disease",
        "tier":     "dangerous" if is_danger else "notable",
        "severity": severity,
        "detail":   f"{log.get('disease')} detected {days_ago if days_ago is not None else 'recently'} day(s) ago, "
                    f"still unresolved. Recommended treatment: {log.get('treatment', 'not specified')}"
    }

    raw = {
        "disease":     log.get("disease"),
        "severity":    log.get("severity"),
        "confidence":  log.get("confidence"),
        "treatment":   log.get("treatment"),
        "prevention":  log.get("prevention"),
        "detected_at": log.get("detected_at").isoformat() if log.get("detected_at") else None
    }

    return {
        "agent":           "disease",
        "risk_found":      not is_danger,   # notable list gets it if NOT dangerous
        "danger_found":    is_danger,
        "findings":        [] if is_danger else [finding],
        "danger_findings": [finding] if is_danger else [],
        "raw":             raw
    }