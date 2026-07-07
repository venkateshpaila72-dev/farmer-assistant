"""
Market Agent — deterministic, no Groq calls.

Reuses get_price_trend() from agent_tools.py directly as a plain function
call (no Groq tool-calling involved here — checks run on schedule for
every preferred crop, not decided by an LLM).

Tiers:
- "notable"   -> price change of +-10% or more  -> goes in daily report
- "dangerous" -> price change of +-25% or more  -> triggers an alert
"""

from app.utils.agent_tools import get_price_trend

PRICE_CHANGE_NOTABLE_PCT    = 10
PRICE_CHANGE_DANGEROUS_PCT  = 25


async def check_market_signal(preferred_crops: list, state: str) -> dict:
    """
    Check price trend for each of the farmer's preferred crops.

    Returns THREE things:
    - current_prices: ALWAYS populated for every crop with data, regardless
      of how much the price moved — this is what the daily report uses to
      always show "current price + rising/falling", not just big swings.
    - findings: only crops with >=10% movement — used for the notable
      tier in reports (kept for backward compatibility / detail in findings)
    - danger_findings: only crops with >=25% movement — used for alerts
    """
    if not preferred_crops:
        return {
            "agent":           "market",
            "risk_found":      False,
            "danger_found":    False,
            "findings":        [],
            "danger_findings": [],
            "current_prices":  []
        }

    findings        = []
    danger_findings = []
    current_prices  = []

    for crop in preferred_crops:
        try:
            trend = await get_price_trend(crop=crop, state=state, days=30)
        except Exception:
            continue  # skip this crop on error, don't fail the whole agent

        if not trend.get("found"):
            continue

        change_pct = trend.get("change_percent", 0)
        abs_change = abs(change_pct)

        # Always record the current price + direction, regardless of magnitude
        current_prices.append({
            "crop":           crop,
            "current_price":  trend.get("latest_price"),
            "earlier_price":  trend.get("earliest_price"),
            "change_percent": change_pct,
            "direction":      "up" if change_pct > 0 else ("down" if change_pct < 0 else "steady")
        })

        if abs_change < PRICE_CHANGE_NOTABLE_PCT:
            continue  # not significant enough for the findings/alert tiers

        direction = "up" if change_pct > 0 else "down"
        action    = "consider selling" if change_pct > 0 else "may be better to hold if possible"

        finding = {
            "type":     "sell_signal" if change_pct > 0 else "hold_signal",
            "tier":     "dangerous" if abs_change >= PRICE_CHANGE_DANGEROUS_PCT else "notable",
            "severity": "high" if abs_change >= PRICE_CHANGE_DANGEROUS_PCT else "medium",
            "crop":     crop,
            "detail":   f"{crop} price {direction} {abs_change}% — earliest ₹{trend.get('earliest_price')}, "
                        f"now ₹{trend.get('latest_price')}. {action.capitalize()}."
        }

        if abs_change >= PRICE_CHANGE_DANGEROUS_PCT:
            danger_findings.append(finding)
        else:
            findings.append(finding)

    return {
        "agent":           "market",
        "risk_found":      len(findings) > 0,
        "danger_found":    len(danger_findings) > 0,
        "findings":        findings,
        "danger_findings": danger_findings,
        "current_prices":  current_prices
    }