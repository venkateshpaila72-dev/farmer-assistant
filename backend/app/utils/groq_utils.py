import json
from groq import Groq
from app.core.config import settings
from app.utils.agent_tools import TOOL_SCHEMAS, TOOL_FUNCTIONS

MAX_TOOL_ITERATIONS = 3  # safety cap so the agent can't loop forever


def _recover_malformed_tool_call(error_str: str):
    """
    Known Llama/Groq quirk: instead of returning a proper structured tool
    call, the model sometimes glues the function name and its JSON
    arguments into one invalid string, e.g. it tries to call a tool
    literally named:
        search_farming_documents{"query": "treatment for leaf scorch"}
    Groq's API rejects this with a 400 validation error — but critically,
    that error message echoes the exact mangled string back, which means
    the model's actual intent (which tool, which arguments) is sitting
    right there in the error text. Recovering and running it directly is
    far better than just dropping tool access for the whole turn.

    Returns (tool_name, args_dict), or (None, None) if nothing recoverable
    was found — callers should fall back to the old plain-text behavior
    in that case, so this is a strictly additive improvement, never a
    regression risk.
    """
    for name in TOOL_FUNCTIONS:
        idx = error_str.find(name + "{")
        if idx == -1:
            continue
        json_start = idx + len(name)
        try:
            args, _ = json.JSONDecoder().raw_decode(error_str[json_start:])
        except (json.JSONDecodeError, ValueError):
            continue
        if isinstance(args, dict):
            return name, args
    return None, None


# ── Groq key rotation ────────────────────────────────────────────────────
# Groq's free tier rate-limits per API key (tokens/day). With 4 keys, any
# single call that hits a rate limit on one key automatically retries on
# the next key instead of failing the farmer's request. This benefits
# BOTH the chatbot (chat_with_groq below) and supervisor.py's direct
# Groq calls, since both import groq_client_with_rotation from here.

_GROQ_KEYS = [
    k for k in [
        settings.GROQ_API_KEY,
        settings.GROQ_API_KEY_2,
        settings.GROQ_API_KEY_3,
        settings.GROQ_API_KEY_4,
    ] if k  # skip any that weren't set in .env
]

_clients = [Groq(api_key=k) for k in _GROQ_KEYS]
_current_key_index = 0


def _is_rate_limit_error(e: Exception) -> bool:
    error_str = str(e).lower()
    return "rate_limit" in error_str or "429" in error_str or "rate limit" in error_str


def groq_completion_with_rotation(**kwargs):
    """
    Drop-in replacement for groq_client.chat.completions.create(**kwargs)
    that automatically rotates to the next API key if the current one hits
    a rate limit, instead of failing the request outright.

    Tries each available key once per call. If ALL keys are rate-limited,
    the last error is raised (caller's existing error handling applies).
    """
    global _current_key_index

    last_error = None
    attempts   = len(_clients)

    for _ in range(attempts):
        client = _clients[_current_key_index]
        try:
            return client.chat.completions.create(**kwargs)
        except Exception as e:
            last_error = e
            if _is_rate_limit_error(e):
                print(f"⚠️ Groq key #{_current_key_index + 1} rate-limited, rotating to next key...")
                _current_key_index = (_current_key_index + 1) % len(_clients)
                continue
            else:
                # Not a rate-limit error — don't rotate, just raise immediately
                raise

    # All keys exhausted
    raise last_error


# Backward-compatible alias — groq_client.chat.completions.create(...) calls
# elsewhere in this file are replaced with groq_completion_with_rotation(...)
# but kept as a simple object here in case anything else imports groq_client
# directly (uses only the first available key, no rotation).
groq_client = _clients[0] if _clients else None


# Whisper's `prompt` param biases its vocabulary recognition toward words
# that appear in it — it doesn't force these exact words into the output,
# it just makes Whisper more likely to recognize them correctly when they
# actually occur in the audio. This targets a specific, observed failure
# mode: farmers code-switching into English mid-sentence for domain terms
# and place names (e.g. "...crops recommend చేయు" or "...Andhra Pradesh
# లో..."), which Whisper was mangling into nonsense syllables (seen in
# testing: "recommend" -> "రిటమెంట్", "Andhra Pradesh" -> "అందర్ ప్రదేశ్").
_TRANSCRIPTION_VOCAB_HINT = (
    "Farmer Assistant app. Indian farmer speaking about crops, farming, "
    "and prices. Common words: recommend, crop, fertilizer, disease, "
    "pesticide, irrigation, quintal, mandi, yield, soil, weather, market "
    "price, Andhra Pradesh, Telangana, Karnataka, Tamil Nadu, Maharashtra, "
    "Punjab, Gujarat, West Bengal, rice, wheat, cotton, maize, soybean, "
    "tomato, chilli, groundnut, sugarcane."
)


def transcribe_audio_with_rotation(audio_bytes: bytes, filename: str = "voice.webm") -> dict:
    """
    Speech-to-text via Groq's hosted Whisper, with the same key-rotation
    fallback as groq_completion_with_rotation — if one key is rate-limited,
    try the next rather than failing the farmer's voice message outright.

    No `language` parameter is passed to Whisper on purpose: leaving it
    unset makes Whisper auto-detect from the audio itself, which is what
    lets a farmer speak in ANY supported language (not just a fixed list)
    and still get an accurate transcript.

    A `prompt` IS passed — see _TRANSCRIPTION_VOCAB_HINT above — to reduce
    (not eliminate) mis-transcription of code-switched English terms and
    place names that are common in how Indian farmers actually speak.

    Returns {"text": str, "language": str} — `language` is whatever ISO
    code/name Whisper reports back (e.g. "english", "telugu", "hindi").
    """
    global _current_key_index

    last_error = None
    attempts   = len(_clients)

    for _ in range(attempts):
        client = _clients[_current_key_index]
        try:
            transcript = client.audio.transcriptions.create(
                file=(filename, audio_bytes),
                model="whisper-large-v3",
                response_format="verbose_json",
                prompt=_TRANSCRIPTION_VOCAB_HINT
            )
            return {
                "text":     (transcript.text or "").strip(),
                "language": getattr(transcript, "language", None) or "unknown"
            }
        except Exception as e:
            last_error = e
            if _is_rate_limit_error(e):
                print(f"⚠️ Groq key #{_current_key_index + 1} rate-limited (whisper), rotating...")
                _current_key_index = (_current_key_index + 1) % len(_clients)
                continue
            else:
                raise

    raise last_error


def build_system_prompt(farmer_context: dict, username: str, language: str = None) -> str:
    """
    Build system prompt with full farmer context.

    username  -> passed explicitly from the WebSocket path param, so it is
                 NEVER dependent on whether profile['username'] field exists.
    language  -> optional override for the CURRENT session (e.g. farmer said
                 "reply in English"). Falls back to profile's saved chat_language
                 if not provided.
    """
    profile  = farmer_context.get("profile", {})
    location = farmer_context.get("location", {})
    weather  = farmer_context.get("weather", {})
    prices   = farmer_context.get("prices", {})
    news     = farmer_context.get("news", [])
    season   = farmer_context.get("season", "Kharif")

    # Language: use session override if given, else fall back to saved profile language
    if not language:
        language = profile.get("chat_language", "English")

    location_str = f"{location.get('district', '')}, {location.get('state', 'India')}"
    crops_str    = ", ".join(profile.get("preferred_crops", [])) or "not specified"
    alerts_str   = "\n".join(weather.get("alerts", [])) or "none"

    # Price summary
    price_lines = []
    for crop, records in prices.items():
        if records:
            latest = records[0]
            price_lines.append(f"  - {crop}: ₹{latest.get('modal_price', 'N/A')}/quintal")
    prices_str = "\n".join(price_lines) or "  - No price data available"

    # News summary
    news_lines = [f"  - {a['title']}" for a in news[:3] if a.get("title")]
    news_str   = "\n".join(news_lines) or "  - No recent news"

    system = f"""You are a smart farming assistant talking to {username}, a farmer from {location_str}.

═══════════════════════════════════════════════════════════
LANGUAGE — NON-NEGOTIABLE, APPLIES TO EVERY SINGLE RESPONSE
═══════════════════════════════════════════════════════════
Default/starting language for this session: {language}

Match the language of the farmer's MOST RECENT message, every single turn:
- Detect the language from the SCRIPT the message is written in — Telugu
  script means reply in Telugu, Devanagari means reply in Hindi (or Marathi
  if the farmer has been using Marathi), Tamil script means Tamil, and so on
  for any of the app's languages. This applies to ANY language the farmer
  uses, not just {language} — including languages transcribed from speech,
  which may not match the session default.
- Many messages come from VOICE INPUT transcribed by an automatic speech
  recognizer. These transcripts are frequently imperfect — individual words
  may be garbled, misheard, or nonsensical, especially proper nouns and
  English loanwords spoken mid-sentence (e.g. a farmer saying "recommend"
  or a state name inside an otherwise Hindi/Telugu sentence). This is
  EXPECTED and does not make the language unclear. Judge the language from
  the SCRIPT of the message, not from whether every word makes grammatical
  sense — a Devanagari-script message is Hindi even if parts of it read as
  garbled or don't fully parse; do the same best-effort reading a native
  speaker would when hearing a bad phone connection, and reply in that
  language. Do not fall back to {language} just because the phrasing is
  awkward or a few words seem mistranscribed.
- Only fall back to {language} when the language genuinely cannot be
  determined at all — e.g. the message is only numbers, or only a single
  ambiguous word/name with no other language cue, or literally mixes two
  full scripts within one message. A garbled-but-legible message in a
  single identifiable script is NOT this case.
- This applies with ZERO exceptions, including short replies ("hi", "thanks",
  "ok") — a one-word greeting in the farmer's language is still required,
  even if that language is not English. Do not default to English out of
  habit just because a message is short or simple.
- If the farmer explicitly asks to switch (e.g. "reply in English", "switch
  to Telugu", or the same request phrased in Telugu/Hindi/any other
  language — understand the INTENT, not just these exact English example
  phrases), honor that immediately, even before their next message, and
  even if it means replying in a different language than the message
  itself was written in.
- Never mix two languages within a single response.

═══════════════════════════════════════════════════════════
THE ONE RULE THAT GOVERNS TOOL USE
═══════════════════════════════════════════════════════════
Call a tool ONLY when you cannot answer accurately without fresh, looked-up
data that you don't already have. If you can answer well using the farmer
details, conditions, or your own farming knowledge below, just answer —
do not call a tool "to be helpful" or "to be thorough". An unnecessary
tool call is worse than a slightly shorter answer.

Ask yourself before calling any tool: "Does answering this require data
I do not currently have, that one specific tool below provides?"
- If NO (it's a greeting, thanks, opinion, general knowledge, or something
  answerable from the context already given) → just answer, zero tool calls.
- If YES → call the tool that provides that exact data, with the right
  arguments. Then answer using what it returns.

Some questions genuinely need the SAME tool called more than once with
DIFFERENT arguments — e.g. "which of these 3 crops has the best price"
needs get_market_price called once per crop, not once total. Never guess,
skip a crop, or say data "isn't available" when you could just call the
tool again with different arguments to actually get it.

Do not repeat an IDENTICAL call (same tool, same arguments) more than
once — that's the only kind of repetition to avoid.

Never narrate this process to the farmer. Do not say "I will search...",
"Searching for...", "Let me check...", or anything describing that you are
about to use or have used a tool. The farmer only ever sees your final
answer — go straight to it, as if you already knew the information.

═══════════════════════════════════════════════════════════
FARMER DETAILS (already known to you — never say you don't know this)
═══════════════════════════════════════════════════════════
- Name: {username}
- Location: {location_str}
- Soil type: {profile.get('soil_type', 'unknown')}
- Farm size: {profile.get('farm_acres', 'unknown')} acres
- Preferred crops: {crops_str}
- Irrigation: {profile.get('irrigation_type', 'unknown')}
- Main problem: {profile.get('main_problem', 'unknown')}

CURRENT CONDITIONS:
- Season: {season}
- Temperature: {weather.get('current', {}).get('temperature', 'N/A')}°C
- Humidity: {weather.get('current', {}).get('humidity', 'N/A')}%
- Weather alerts: {alerts_str}

TODAY'S MARKET PRICES (snapshot only — may be stale or incomplete; use
get_market_price below if the farmer asks about a specific/different crop):
{prices_str}

RECENT FARMING NEWS:
{news_str}

The four sections above are BACKGROUND ONLY. Never recite, list, or
summarize them unprompted. Never bring up an item from them (a news
headline, an unrelated price) unless the farmer's question is actually
about that item. Use them silently to inform your answer when relevant.

═══════════════════════════════════════════════════════════
YOUR TOOLS — each does exactly one thing, nothing more
═══════════════════════════════════════════════════════════
1. get_market_price(crop, state, district=None)
   USE FOR: "what's the price of X", "how much is X selling for"
   DOES NOT: predict prices, recommend crops, give trends

2. get_price_trend(crop, state, days=30)
   USE FOR: "is the price rising/falling", "trend", "last week/month's price"
   DOES NOT: predict future prices, recommend crops

3. search_farming_documents(query)
   USE FOR: "how do I treat/manage/control [disease/pest]", fertilizer
   dosage questions, cultivation technique questions needing verified
   ICAR document knowledge
   DOES NOT: give prices, give weather, recommend which crop to grow

4. get_last_disease_detection(username)
   USE FOR: continuing discussion about "my plant", "that disease", a photo
   the farmer uploaded earlier via the disease detection feature
   DOES NOT: detect a NEW disease (farmer must upload a photo via the
   app's photo upload feature for that — you cannot analyze images yourself)

NONE of these 4 tools recommend which crop to grow, predict future yield,
or do anything beyond their one stated job. For "what crop should I grow",
"which crop is best now", or similar — these are NOT covered by any tool.
Answer these directly yourself using the season, soil type, location, and
your own farming knowledge above. Do not call any tool for this.

Never call the same tool twice in one turn with the same or near-identical
arguments — if you already have the answer from one call, use it.

═══════════════════════════════════════════════════════════
RESPONSE STYLE
═══════════════════════════════════════════════════════════
- Match the length of your answer to the question — a greeting gets a
  greeting back, a detailed question gets a detailed answer
- Use real line breaks and bullet points for structure, never the literal
  text "\\n"
- Be direct: answer what was asked, not everything you know
- Default to under 200 words unless the farmer asks for more detail"""

    return system


def is_farming_question(message: str) -> bool:
    """
    DEPRECATED — kept only so nothing importing this breaks.
    The agent now decides whether to use tools (including RAG) on its own
    via Groq tool-calling, rather than a manual keyword pre-check. This
    fixes both the original bug (RAG never firing on rice/disease questions
    not in a fixed keyword list) and the later bug (RAG firing on generic
    weather/price questions and producing rambling answers).
    """
    return False


async def chat_with_groq(
    messages: list,
    system_prompt: str,
    rag_context: str = None,   # kept for backward compatibility, unused now
    max_tokens: int = 600,
    username: str = None
) -> dict:
    """
    Agentic chat — Groq decides which tools (if any) to call based on the
    farmer's actual question, instead of us pre-guessing what data to load.

    This fixes the original bugs at the root:
    - Rice (or any crop not in preferred_crops) now works, because the
      agent calls get_market_price(crop, state) with whatever crop the
      farmer actually asked about, not a fixed preloaded list of 3.
    - RAG no longer fires on generic weather/price questions, because the
      agent only calls search_farming_documents when it actually decides
      document knowledge is needed — no manual keyword gate required.
    - Date sorting bugs are fixed inside the tools themselves
      (see agent_tools.py — proper datetime parsing, not string sort).

    Returns a dict: {"response": str, "used_tools": list, "sources": list}
    so the caller (ws.py) can still report used_rag / sources accurately.
    """
    processed_messages = [m.copy() for m in messages]
    full_messages = [{"role": "system", "content": system_prompt}] + processed_messages

    used_tools = []
    rag_sources = []

    for _ in range(MAX_TOOL_ITERATIONS):
        try:
            response = groq_completion_with_rotation(
                model=settings.GROQ_MODEL,
                messages=full_messages,
                tools=TOOL_SCHEMAS,
                tool_choice="auto",
                max_tokens=max_tokens,
                temperature=0.7
            )
        except Exception as e:
            # Known Llama/Groq quirk: on ambiguous questions that don't map
            # cleanly to any one tool, the model sometimes emits a malformed
            # pseudo-XML function call (<function=name{args}></function>)
            # instead of a proper structured tool_calls response. Groq's API
            # then rejects it with a 400 "tool_use_failed" error.
            error_str = str(e)
            if "tool_use_failed" in error_str or "tool call validation failed" in error_str:
                print(f"⚠️ Malformed tool call detected: {error_str[:150]}")

                # Try to recover what the model actually meant to call and
                # run it for real, instead of just answering with no tools.
                recovered_name, recovered_args = _recover_malformed_tool_call(error_str)

                if recovered_name and recovered_name in TOOL_FUNCTIONS:
                    print(f"   Recovered: {recovered_name}({recovered_args}) — executing directly")
                    if recovered_name == "get_last_disease_detection" and "username" not in recovered_args and username:
                        recovered_args["username"] = username

                    try:
                        result = await TOOL_FUNCTIONS[recovered_name](**recovered_args)
                    except Exception as tool_err:
                        result = {"found": False, "message": f"Tool error: {str(tool_err)}"}

                    used_tools.append(recovered_name)
                    if recovered_name == "search_farming_documents" and result.get("sources"):
                        for s in result["sources"]:
                            if s not in rag_sources:
                                rag_sources.append(s)

                    # Feed the real tool result back in and ask for a final
                    # answer — no `tools` param this time, so there's nothing
                    # left for the model to malform a call against.
                    full_messages.append({
                        "role": "user",
                        "content": (
                            f"[Tool result for {recovered_name}]: {json.dumps(result)}\n\n"
                            "Use this to answer the farmer's question."
                        )
                    })
                else:
                    print("   Could not recover a specific tool call — answering without tools")

                try:
                    fallback = groq_completion_with_rotation(
                        model=settings.GROQ_MODEL,
                        messages=full_messages,
                        max_tokens=max_tokens,
                        temperature=0.7
                    )
                    text = (fallback.choices[0].message.content or "").strip().replace("\\n", "\n")
                except Exception as e2:
                    text = f"Sorry, I had trouble answering that. ({str(e2)})"
                return {
                    "response":   text,
                    "used_tools": used_tools,
                    "sources":    rag_sources
                }
            else:
                raise

        choice = response.choices[0]
        msg    = choice.message

        # If the model didn't ask for a tool, we have our final answer
        if not msg.tool_calls:
            text = (msg.content or "").strip()
            text = text.replace("\\n", "\n")
            return {
                "response":   text,
                "used_tools": used_tools,
                "sources":    rag_sources
            }

        # Model wants to call one or more tools — append its tool-call message
        full_messages.append({
            "role":       "assistant",
            "content":    msg.content or "",
            "tool_calls": [
                {
                    "id":   tc.id,
                    "type": "function",
                    "function": {
                        "name":      tc.function.name,
                        "arguments": tc.function.arguments
                    }
                }
                for tc in msg.tool_calls
            ]
        })

        # Execute each requested tool call (deduplicated — if the model asks
        # for the exact same tool+args twice in one turn, only run it once
        # and reuse the result, as a safety net on top of the prompt instruction)
        seen_calls = {}
        for tc in msg.tool_calls:
            tool_name = tc.function.name
            try:
                tool_args = json.loads(tc.function.arguments or "{}")
            except json.JSONDecodeError:
                tool_args = {}

            # Auto-inject username for tools that need it but the model didn't pass it
            if tool_name == "get_last_disease_detection" and "username" not in tool_args and username:
                tool_args["username"] = username

            call_key = (tool_name, json.dumps(tool_args, sort_keys=True))

            if call_key in seen_calls:
                result = seen_calls[call_key]
            else:
                tool_fn = TOOL_FUNCTIONS.get(tool_name)
                if tool_fn is None:
                    result = {"found": False, "message": f"Unknown tool: {tool_name}"}
                else:
                    try:
                        result = await tool_fn(**tool_args)
                    except Exception as e:
                        result = {"found": False, "message": f"Tool error: {str(e)}"}
                seen_calls[call_key] = result

                used_tools.append(tool_name)
                if tool_name == "search_farming_documents" and result.get("sources"):
                    for s in result["sources"]:
                        if s not in rag_sources:
                            rag_sources.append(s)

            full_messages.append({
                "role":         "tool",
                "tool_call_id": tc.id,
                "name":         tool_name,
                "content":      json.dumps(result)
            })

    # Safety fallback if the loop hit MAX_TOOL_ITERATIONS without a final answer
    try:
        final = groq_completion_with_rotation(
            model=settings.GROQ_MODEL,
            messages=full_messages,
            max_tokens=max_tokens,
            temperature=0.7
        )
        text = (final.choices[0].message.content or "").strip().replace("\\n", "\n")
    except Exception as e:
        text = f"Sorry, I had trouble completing that request: {str(e)}"

    return {
        "response":   text,
        "used_tools": used_tools,
        "sources":    rag_sources
    }