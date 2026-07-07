"""
Supervisor Agent — the ONLY file in Phase 6 that calls Groq.

Produces TWO separate outputs per farmer, both from one run of the 4
deterministic agents:

1. DAILY REPORT — always generated and sent, every day, regardless of
   findings. Calm, informational tone. Uses "notable" tier findings
   (and mentions if everything is fine when there are none).

2. ALERT — only generated/sent if any agent returned a "dangerous" tier
   finding (flood-level rain, extreme heat, high-severity disease, sharp
   price crash/spike). Urgent, direct tone. Sent as a SEPARATE WhatsApp
   message from the daily report, even though both come from this same run.

Both messages cost one Groq call each — so a "calm" day costs 1 call
(report only), a "dangerous" day costs 2 calls (report + alert).
"""

from app.utils.groq_utils import groq_completion_with_rotation
from app.core.config import settings
from app.db.database import get_db
from app.db.models import FARMER_PROFILES_COLLECTION, USERS_COLLECTION
from app.agents.weather_agent import check_weather
from app.agents.soil_agent import check_soil_suitability
from app.agents.disease_agent import check_disease_status
from app.agents.market_agent import check_market_signal


# Fixed, code-guaranteed labels prefixing every message — never left to the
# LLM's discretion, so daily reports and alerts are always visually distinct
# the instant a farmer opens WhatsApp, regardless of what Groq generates.
_DAILY_REPORT_LABEL = {
    "English": "🌾 Daily Farm Update",
    "Telugu":  "🌾 రోజువారీ వ్యవసాయ నివేదిక",
    "Hindi":   "🌾 दैनिक खेत रिपोर्ट",
    "Tamil":   "🌾 தினசரி பண்ணை அறிக்கை",
}

_ALERT_LABEL = {
    "English": "🚨 URGENT ALERT",
    "Telugu":  "🚨 అత్యవసర హెచ్చరిక",
    "Hindi":   "🚨 तत्काल चेतावनी",
    "Tamil":   "🚨 அவசர எச்சரிக்கை",
}


def _strip_empty_section_lines(text: str) -> str:
    """
    Remove any line that is just an emoji + bold section label
    (e.g. '🌱 *Crops:*') with nothing meaningful after it. The model is
    instructed to omit these itself, but that instruction isn't always
    followed reliably — this guarantees it in code instead, same approach
    as the fixed message-type labels above.

    A line is considered "empty" if, after stripping the leading
    'emoji *Label:*' pattern, what remains is blank or just whitespace.
    The emoji prefix is optional in the match so this still works even
    if the model omits it.
    """
    import re

    lines = text.split("\n")
    cleaned_lines = []

    for line in lines:
        # Match an optional leading emoji/symbol, then "*Something:*"
        match = re.match(r"^\s*[^\w\s*]{0,2}\s*\*[^*]+:\*\s*(.*)$", line)
        if match:
            remainder = match.group(1).strip()
            if not remainder:
                continue  # skip this line entirely — label with no content
        cleaned_lines.append(line)

    # Collapse any resulting consecutive blank lines down to one
    result_lines = []
    prev_blank = False
    for line in cleaned_lines:
        is_blank = (line.strip() == "")
        if is_blank and prev_blank:
            continue
        result_lines.append(line)
        prev_blank = is_blank

    return "\n".join(result_lines).strip()


def _collect(results: list, key: str) -> list:
    """Flatten findings/danger_findings from all 4 agent results, tagged with source agent."""
    out = []
    for result in results:
        for finding in result.get(key, []):
            out.append({**finding, "source_agent": result["agent"]})
    return out


async def _run_all_agents(profile: dict, username: str) -> dict:
    """Run all 4 deterministic agents once and return their raw results."""
    location        = profile.get("current_location", profile.get("home_location", {}))
    state           = location.get("state", "India")
    lat             = location.get("lat", 17.97)
    lng             = location.get("lng", 79.59)
    soil_type       = profile.get("soil_type")
    preferred_crops = profile.get("preferred_crops", [])

    weather_result = await check_weather(lat=lat, lng=lng)
    soil_result    = check_soil_suitability(soil_type=soil_type, preferred_crops=preferred_crops)
    disease_result = await check_disease_status(username=username)
    market_result  = await check_market_signal(preferred_crops=preferred_crops, state=state)

    return {
        "weather": weather_result,
        "soil":    soil_result,
        "disease": disease_result,
        "market":  market_result,
        "state":   state,
        "language": profile.get("chat_language", "English")
    }


def _build_daily_report_prompt(username: str, state: str, language: str,
                                  notable_findings: list, weather_raw: dict,
                                  current_prices: list, disease_raw: dict) -> str:

    temp     = weather_raw.get("temperature", "N/A")
    humidity = weather_raw.get("humidity", "N/A")
    rainfall = weather_raw.get("max_rainfall_today", 0)
    max_temp = weather_raw.get("max_temp_today", temp)

    weather_body = (
        f"Current temperature: {temp}°C. Expected max temperature today: {max_temp}°C. "
        f"Humidity: {humidity}%. Rain expected today: {rainfall}mm."
    )

    if current_prices:
        price_lines = []
        for p in current_prices:
            direction_word = {"up": "rising", "down": "falling", "steady": "steady"}[p["direction"]]
            price_lines.append(
                f"- {p['crop']}: current price ₹{p['current_price']}, {direction_word} "
                f"({p['change_percent']}% change from ₹{p['earlier_price']})"
            )
        market_body = "Market prices for farmer's crops:\n" + "\n".join(price_lines)
    else:
        market_body = "No market price data available for farmer's crops."

    if disease_raw and disease_raw.get("disease"):
        disease_body = (
            f"Disease detected: {disease_raw.get('disease')}. "
            f"Severity: {disease_raw.get('severity', 'unknown')}. "
            f"Recommended treatment/fertilizer: {disease_raw.get('treatment', 'not specified')}. "
            f"Prevention: {disease_raw.get('prevention', 'not specified')}."
        )
    else:
        disease_body = "No disease detected — crop appears healthy."

    soil_findings = [f for f in notable_findings if f["source_agent"] == "soil"]
    soil_body = ("\n".join(f"- {f['detail']}" for f in soil_findings)
                 if soil_findings else "No soil/crop suitability issues found.")

    return f"""You are writing a detailed daily farm REPORT for {username}, a farmer in {state}.
This is a structured update the farmer will read carefully, not a quick chat reply.
Write it in {language}.

WEATHER DATA:
{weather_body}

CROPS DATA:
{soil_body}

MARKET DATA:
{market_body}

DISEASE/HEALTH DATA:
{disease_body}

Format REQUIRED — write all 4 sections below, in this order, ALWAYS, using the
data given above for each one:

🌤️ *Weather:* State the current temperature and today's expected max temperature
   (both as exact numbers with °C), the humidity percentage, and the rainfall
   expected in mm. Then add ONE short sentence on what this means for farming
   today (e.g. good for irrigation, risk of fungal disease, fine to spray).

🌱 *Crops:* State the soil/crop suitability finding using the data given, or say
   crops are well suited to the soil if no issue was found.

💰 *Market:* For EACH crop in the market data, state the crop name, the exact
   current price in ₹, and whether it is rising or falling (with the percentage).
   Do not give a sell/hold recommendation — just state the price and direction
   clearly. If multiple crops, list each one separately.

🩺 *Health:* State the exact disease name if one was detected, then give the
   recommended treatment AND fertilizer recommendation from the data above as
   clear, actionable advice. If no disease was detected, state that the crop
   is healthy.

Rules:
- Use the exact emoji + *asterisk* bold label format shown above for all 4 sections
- ALWAYS include all 4 sections — do not skip any, since there is data for every
  section above (even if it's "no issues found" for that section)
- Use the SPECIFIC numbers/facts from the data given above, never vague restatements
  or invented numbers
- Do not mention "agents" or "automated checks"
- Do NOT add your own header, label, or emoji prefix at the very top of the whole
  message — that is added separately
- End with a brief, warm sign-off, e.g. "- Farmer Assistant" """


def _build_alert_prompt(username: str, state: str, language: str, danger_findings: list) -> str:
    findings_text = "\n".join(f"- [{f['source_agent']}] {f['detail']}" for f in danger_findings)

    return f"""You are writing an URGENT, detailed alert for {username}, a farmer in {state}.
This is a structured warning the farmer needs to act on immediately, not a quick chat reply.
Write it in {language}.

Dangerous conditions detected:
{findings_text}

Format REQUIRED — use these two labeled sections:

⚠️ *What's happening:* Explain the exact danger using the SPECIFIC number from the
   data above in every sentence (e.g. "120mm of rain is expected today" not
   "heavy rain is expected" — always include the real number). Explain briefly
   why this number is dangerous for the farm.

✅ *What to do:* 2-3 concrete, specific actions the farmer should take immediately,
   in order of priority.

Rules:
- Use the exact emoji + *asterisk* bold label format shown above for each section
- EVERY sentence describing the danger must include a specific number/percentage/
  measurement from the data above — never describe the danger without its number
- Each section should be 2-3 full sentences — enough detail to actually act on,
  while staying urgent and direct in tone
- Do not mention "agents" or "automated checks"
- Do NOT add your own header, label, or emoji prefix at the very top of the whole
  message — that is added separately
- End with a brief sign-off, e.g. "- Farmer Assistant" """


async def _call_groq(prompt: str, max_tokens: int = 200) -> dict:
    response = groq_completion_with_rotation(
        model=settings.GROQ_MODEL,
        messages=[{"role": "user", "content": prompt}],
        max_tokens=max_tokens,
        temperature=0.6
    )

    choice    = response.choices[0]
    truncated = (choice.finish_reason == "length")

    # Groq reports finish_reason="length" when the response was cut off by
    # max_tokens rather than the model finishing naturally. Log this clearly
    # so a truncated message is immediately diagnosable instead of silently
    # shipping cut-off text — this is exactly what caused the earlier bug
    # where Telugu reports ran out of room mid-sentence.
    if truncated:
        print(f"⚠️ Groq response TRUNCATED at max_tokens={max_tokens} — "
              f"consider raising the limit further for this language/content length")

    return {
        "text":      choice.message.content.strip(),
        "truncated": truncated
    }


async def generate_daily_report(username: str) -> dict:
    """
    Generate both the daily report (always) and an alert (only if
    dangerous findings exist) for one farmer.

    Returns a dict with both messages — caller (scheduler / agent.py
    routes) decides how to send each one.
    """
    db = get_db()
    profile = await db[FARMER_PROFILES_COLLECTION].find_one({"username": username})

    if not profile:
        return {"username": username, "success": False, "error": "Farmer profile not found"}

    # Phone number lives on the users collection (set at registration),
    # not on farmer_profiles (which only has onboarding data) — fixed
    # after confirming the actual document shape in MongoDB.
    user_doc = await db[USERS_COLLECTION].find_one({"username": username})
    phone    = user_doc.get("phone") if user_doc else None

    agents = await _run_all_agents(profile, username)
    agent_results = [agents["weather"], agents["soil"], agents["disease"], agents["market"]]

    notable_findings = _collect(agent_results, "findings")
    danger_findings  = _collect(agent_results, "danger_findings")

    state    = agents["state"]
    language = agents["language"]

    agent_summary = {
        "weather": agents["weather"],
        "soil":    agents["soil"],
        "disease": agents["disease"],
        "market":  agents["market"]
    }

    result = {
        "username":               username,
        "success":                True,
        "phone":                  phone,
        "agent_summary":          agent_summary,
        "daily_report":           None,
        "daily_report_truncated": False,
        "alert":                  None,
        "alert_truncated":        False,
        "alert_needed":           len(danger_findings) > 0
    }

    # Daily report — ALWAYS generated, one Groq call
    try:
        weather_raw    = agents["weather"].get("raw", {})
        current_prices = agents["market"].get("current_prices", [])
        disease_raw    = agents["disease"].get("raw", {})

        report_prompt = _build_daily_report_prompt(
            username, state, language, notable_findings,
            weather_raw, current_prices, disease_raw
        )
        report_result = await _call_groq(report_prompt, max_tokens=900)
        report_text   = _strip_empty_section_lines(report_result["text"])
        result["daily_report"]           = f"{_DAILY_REPORT_LABEL.get(language, _DAILY_REPORT_LABEL['English'])}\n\n{report_text}"
        result["daily_report_truncated"] = report_result["truncated"]
    except Exception as e:
        result["daily_report_error"] = f"Groq error generating daily report: {str(e)}"

    # Alert — only generated if dangerous findings exist, separate Groq call
    if danger_findings:
        try:
            alert_prompt  = _build_alert_prompt(username, state, language, danger_findings)
            alert_result  = await _call_groq(alert_prompt, max_tokens=500)
            alert_text    = _strip_empty_section_lines(alert_result["text"])
            result["alert"]           = f"{_ALERT_LABEL.get(language, _ALERT_LABEL['English'])}\n\n{alert_text}"
            result["alert_truncated"] = alert_result["truncated"]
        except Exception as e:
            result["alert_error"] = f"Groq error generating alert: {str(e)}"

    return result