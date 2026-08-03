"""
Supervisor Agent — LangGraph implementation.

Rebuilt from a plain async function into an actual LangGraph StateGraph,
matching the intended architecture: Think (load profile) -> parallel
fan-out to the 4 deterministic sub-agents (weather / soil / disease /
market) -> Observe (collect findings) -> Synthesize (Groq generates the
report, and a separate alert if anything dangerous was found).

Everything about WHAT gets generated is unchanged from before: same
prompts, same fixed labels, same two-tier notable/dangerous findings
system, same independent error handling per message. Only HOW it's
orchestrated changed — a real graph instead of a linear function, and
LangChain's ChatGroq (via a rotating multi-key wrapper) instead of the
raw Groq SDK.

NOTE on scope: the reference architecture diagram this was built from also
shows "Soil + RAG" and "News + ML" as report inputs. The actual daily
report — both before this rewrite and now — only ever used weather, soil,
disease, and market data; RAG document search and the news feed were never
part of this flow. This rewrite preserves that as-is ("same work as of
now"), so the diagram is aspirational in that respect — ask if you want
RAG/news genuinely folded into the daily report next.

Public entrypoint: generate_daily_report(username) -> dict
Same return shape as before (success, phone, agent_summary, daily_report,
daily_report_truncated, alert, alert_truncated, alert_needed, and the
*_error keys on failure) — routes/agent.py and utils/scheduler.py both
import this function and need no changes.
"""

import re
from typing import Optional, TypedDict

from langgraph.graph import StateGraph, START, END

from app.utils.langchain_groq_rotation import get_rotating_chat_groq
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
    lines = text.split("\n")
    cleaned_lines = []

    for line in lines:
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
    """LangChain equivalent of the old raw-SDK _call_groq — same rotation
    behavior (via RotatingChatGroq), same truncation detection."""
    model = get_rotating_chat_groq(max_tokens=max_tokens, temperature=0.6)
    ai_msg = await model.ainvoke(prompt)

    truncated = ai_msg.response_metadata.get("finish_reason") == "length"

    # Groq reports finish_reason="length" when the response was cut off by
    # max_tokens rather than the model finishing naturally. Log this clearly
    # so a truncated message is immediately diagnosable instead of silently
    # shipping cut-off text — this is exactly what caused the earlier bug
    # where Telugu reports ran out of room mid-sentence.
    if truncated:
        print(f"⚠️ Groq response TRUNCATED at max_tokens={max_tokens} — "
              f"consider raising the limit further for this language/content length")

    return {
        "text":      (ai_msg.content or "").strip(),
        "truncated": truncated
    }


# ── LangGraph state + nodes ─────────────────────────────────────────────

class SupervisorState(TypedDict, total=False):
    username:          str
    profile_found:     bool
    phone:             Optional[str]
    state:             str
    lat:               float
    lng:               float
    soil_type:         Optional[str]
    preferred_crops:   list
    language:          str
    weather_result:    dict
    soil_result:       dict
    disease_result:    dict
    market_result:     dict
    notable_findings:  list
    danger_findings:   list
    daily_report:            Optional[str]
    daily_report_truncated:  bool
    daily_report_error:      Optional[str]
    alert:                   Optional[str]
    alert_truncated:         bool
    alert_error:              Optional[str]
    alert_needed:             bool


async def _think_node(state: SupervisorState) -> dict:
    """Load the farmer's profile + phone from MongoDB — the graph's
    'Think' step (load profile). A missing profile short-circuits the
    whole run via _route_after_think below, rather than every downstream
    node having to defensively check for it."""
    db = get_db()
    username = state["username"]

    profile = await db[FARMER_PROFILES_COLLECTION].find_one({"username": username})
    if not profile:
        return {"profile_found": False}

    user_doc = await db[USERS_COLLECTION].find_one({"username": username})
    phone    = user_doc.get("phone") if user_doc else None
    location = profile.get("current_location", profile.get("home_location", {}))

    return {
        "profile_found":   True,
        "phone":           phone,
        "state":           location.get("state", "India"),
        "lat":             location.get("lat", 17.97),
        "lng":             location.get("lng", 79.59),
        "soil_type":       profile.get("soil_type"),
        "preferred_crops": profile.get("preferred_crops", []),
        "language":        profile.get("chat_language", "English"),
    }


def _route_after_think(state: SupervisorState):
    if not state.get("profile_found"):
        return END
    # Fan out to all 4 deterministic sub-agents in parallel — the "Decide
    # dynamically" step in the reference diagram is, in practice, "run
    # all four every time" (none of them are LLM-gated), matching the
    # actual behavior of the original implementation.
    return ["weather", "soil", "disease", "market"]


async def _weather_node(state: SupervisorState) -> dict:
    return {"weather_result": await check_weather(lat=state["lat"], lng=state["lng"])}


async def _soil_node(state: SupervisorState) -> dict:
    return {"soil_result": check_soil_suitability(
        soil_type=state.get("soil_type"), preferred_crops=state.get("preferred_crops", [])
    )}


async def _disease_node(state: SupervisorState) -> dict:
    return {"disease_result": await check_disease_status(username=state["username"])}


async def _market_node(state: SupervisorState) -> dict:
    return {"market_result": await check_market_signal(
        preferred_crops=state.get("preferred_crops", []), state=state["state"]
    )}


async def _observe_node(state: SupervisorState) -> dict:
    """Collect all 4 agents' findings into the notable/dangerous tiers."""
    agent_results = [
        state["weather_result"], state["soil_result"],
        state["disease_result"], state["market_result"],
    ]
    notable = _collect(agent_results, "findings")
    danger  = _collect(agent_results, "danger_findings")
    return {
        "notable_findings": notable,
        "danger_findings":  danger,
        "alert_needed":     len(danger) > 0,
    }


async def _synthesize_node(state: SupervisorState) -> dict:
    """
    Groq generates the daily report (always, one call) and the alert
    (only if dangerous findings exist, a separate call) — language is
    baked directly into each prompt ("Write it in {language}"), which is
    also how the original implementation handled translation; there was
    never a separate translate step to preserve.
    """
    out: dict = {}
    username = state["username"]
    st       = state["state"]
    language = state["language"]

    # Daily report — ALWAYS generated, one Groq call
    try:
        weather_raw    = state["weather_result"].get("raw", {})
        current_prices = state["market_result"].get("current_prices", [])
        disease_raw    = state["disease_result"].get("raw", {})

        report_prompt = _build_daily_report_prompt(
            username, st, language, state["notable_findings"],
            weather_raw, current_prices, disease_raw
        )
        report_result = await _call_groq(report_prompt, max_tokens=900)
        report_text   = _strip_empty_section_lines(report_result["text"])
        out["daily_report"]           = f"{_DAILY_REPORT_LABEL.get(language, _DAILY_REPORT_LABEL['English'])}\n\n{report_text}"
        out["daily_report_truncated"] = report_result["truncated"]
    except Exception as e:
        out["daily_report_error"] = f"Groq error generating daily report: {str(e)}"

    # Alert — only generated if dangerous findings exist, separate Groq call
    if state.get("alert_needed"):
        try:
            alert_prompt = _build_alert_prompt(username, st, language, state["danger_findings"])
            alert_result = await _call_groq(alert_prompt, max_tokens=500)
            alert_text   = _strip_empty_section_lines(alert_result["text"])
            out["alert"]           = f"{_ALERT_LABEL.get(language, _ALERT_LABEL['English'])}\n\n{alert_text}"
            out["alert_truncated"] = alert_result["truncated"]
        except Exception as e:
            out["alert_error"] = f"Groq error generating alert: {str(e)}"

    return out


_graph = None


def _build_graph():
    global _graph
    if _graph is not None:
        return _graph

    graph = StateGraph(SupervisorState)
    graph.add_node("think",     _think_node)
    graph.add_node("weather",   _weather_node)
    graph.add_node("soil",      _soil_node)
    graph.add_node("disease",   _disease_node)
    graph.add_node("market",    _market_node)
    graph.add_node("observe",   _observe_node)
    graph.add_node("synthesize", _synthesize_node)

    graph.add_edge(START, "think")
    graph.add_conditional_edges(
        "think", _route_after_think,
        ["weather", "soil", "disease", "market", END]
    )
    for n in ("weather", "soil", "disease", "market"):
        graph.add_edge(n, "observe")
    graph.add_edge("observe", "synthesize")
    graph.add_edge("synthesize", END)

    _graph = graph.compile()
    return _graph


async def generate_daily_report(username: str) -> dict:
    """
    Generate both the daily report (always) and an alert (only if
    dangerous findings exist) for one farmer.

    Returns a dict with both messages — caller (scheduler / agent.py
    routes) decides how to send each one. Same shape as before this
    rewrite; no caller needs to change.
    """
    graph = _build_graph()
    final_state = await graph.ainvoke({"username": username}, config={"recursion_limit": 25})

    if not final_state.get("profile_found"):
        return {"username": username, "success": False, "error": "Farmer profile not found"}

    agent_summary = {
        "weather": final_state.get("weather_result", {}),
        "soil":    final_state.get("soil_result", {}),
        "disease": final_state.get("disease_result", {}),
        "market":  final_state.get("market_result", {}),
    }

    result = {
        "username":               username,
        "success":                True,
        "phone":                  final_state.get("phone"),
        "agent_summary":          agent_summary,
        "daily_report":           final_state.get("daily_report"),
        "daily_report_truncated": final_state.get("daily_report_truncated", False),
        "alert":                  final_state.get("alert"),
        "alert_truncated":        final_state.get("alert_truncated", False),
        "alert_needed":           final_state.get("alert_needed", False),
    }
    if final_state.get("daily_report_error"):
        result["daily_report_error"] = final_state["daily_report_error"]
    if final_state.get("alert_error"):
        result["alert_error"] = final_state["alert_error"]

    return result