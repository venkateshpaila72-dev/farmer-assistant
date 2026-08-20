from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException, Depends, status, UploadFile, File
from fastapi.responses import Response
from pydantic import BaseModel
from starlette.websockets import WebSocketState
from datetime import datetime
from app.db.database import get_db
from app.db.models import (
    FARMER_PROFILES_COLLECTION,
    CHAT_HISTORY_COLLECTION,
    MARKET_PRICES_COLLECTION
)
from app.utils.weather_utils import get_current_weather, get_season_from_month
from app.utils.news_utils import get_farming_news
from app.utils.groq_utils import (
    build_system_prompt,
    transcribe_audio_with_rotation
)
from app.utils.lang_detect import detect_lang_code, LANGUAGE_DISPLAY_NAMES
from app.utils.tts_utils import synthesize_speech
from app.utils.chat_history import save_message, load_history
from app.utils.langgraph_chat_agent import run_chat_agent
from app.utils.memory_utils import load_user_memories, load_chat_summary, run_memory_tasks
from app.core.security import get_current_user, decode_token

router = APIRouter()


async def safe_send_json(websocket: WebSocket, payload: dict) -> bool:
    """
    Send JSON to the client, swallowing the failure if it's already gone.
    A dropped connection (page navigation, a dev-only React StrictMode
    double-connect, a flaky network) is normal, not a server error —
    without this guard, a send on a dead socket raises WebSocketDisconnect,
    and if that happens *inside our own error-handling send*, the second
    failure goes unhandled and crashes with the ugly nested traceback.
    """
    if websocket.client_state != WebSocketState.CONNECTED:
        return False
    try:
        await websocket.send_json(payload)
        return True
    except Exception:
        return False


async def safe_close(websocket: WebSocket, code: int = 1000, reason: str = "") -> None:
    """Close without raising if the socket is already gone."""
    if websocket.client_state == WebSocketState.CONNECTED:
        try:
            await websocket.close(code=code, reason=reason)
        except Exception:
            pass


async def load_farmer_context(username: str, db) -> dict:
    """Load complete farmer context. (unchanged)"""
    profile = await db[FARMER_PROFILES_COLLECTION].find_one({"username": username})
    if not profile:
        return {}

    location = profile.get("current_location", profile.get("home_location", {}))
    state    = location.get("state", "India")

    try:
        weather = await get_current_weather(
            lat=location.get("lat", 17.97),
            lng=location.get("lng", 79.59)
        )
    except Exception:
        weather = {}

    prices = {}
    try:
        for crop in profile.get("preferred_crops", [])[:3]:
            records = await db[MARKET_PRICES_COLLECTION].find(
                {
                    "state":     {"$regex": state, "$options": "i"},
                    "commodity": {"$regex": crop,  "$options": "i"}
                },
                {"_id": 0, "modal_price": 1, "arrival_date": 1}
            ).sort("arrival_date", -1).limit(3).to_list(length=3)
            if records:
                prices[crop] = records
    except Exception:
        prices = {}

    try:
        news = await get_farming_news(state=state, max_results=3)
    except Exception:
        news = []

    return {
        "profile":  profile,
        "location": location,
        "weather":  weather,
        "prices":   prices,
        "news":     news,
        "season":   get_season_from_month(datetime.now().month)
    }


# save_message / load_history now live in app/utils/chat_history.py so that
# routes/vision.py can also append photo-analysis results into the same
# conversation (see the chat-photo-analysis feature).


@router.websocket("/ws/chat/{username}")
async def websocket_chat(websocket: WebSocket, username: str, token: str = None):
    """
    WebSocket chatbot — now agentic:
    ✅ Full farmer profile context (always injected — cheap, almost always relevant)
    ✅ Chat memory (MongoDB)
    ✅ Tool-calling agent: market price (ANY crop, not just preferred_crops),
       price trend, RAG document search, last disease detection — agent
       decides which to call based on the actual question, not a fixed list
    ✅ Language preference from profile, with per-message override detected
       from the farmer's own message script, plus explicit switch requests
    ✅ Live weather + news (injected); market prices for preferred crops shown
       as a quick snapshot, but agent can look up ANY crop on demand via tools

    Auth: browsers can't send custom headers on a WebSocket handshake, so the
    JWT is passed as a query param instead: /ws/chat/{username}?token=<jwt>.
    We verify it decodes to this same username before accepting anything.
    """
    # Verify the token BEFORE accepting the connection — reject bad/missing
    # tokens or a mismatched username with a clean close instead of a crash.
    if not token:
        await websocket.close(code=4401, reason="Missing auth token")
        return
    try:
        payload = decode_token(token)
    except HTTPException:
        await websocket.close(code=4401, reason="Invalid or expired token")
        return
    if payload.get("sub") != username and payload.get("role") != "admin":
        await websocket.close(code=4403, reason="Token does not match this account")
        return

    await websocket.accept()
    db = get_db()

    # Load farmer context
    try:
        ctx = await load_farmer_context(username, db)
        if not ctx:
            await safe_send_json(websocket, {
                "type":    "error",
                "message": f"Farmer '{username}' profile not found. Complete onboarding first."
            })
            await safe_close(websocket)
            return

        profile = ctx.get("profile", {})
        state   = ctx.get("location", {}).get("state", "India")

        # Session language starts as whatever is saved on the profile.
        # This can change mid-conversation if farmer says "reply in English" etc.
        session_language = profile.get("chat_language", "English")

        # Load long-term memory + past conversation summary for personalization
        user_memories = await load_user_memories(username, db)
        past_summary  = await load_chat_summary(username, db)

    except Exception as e:
        await safe_send_json(websocket, {"type": "error", "message": str(e)})
        await safe_close(websocket)
        return

    # Welcome message — if this fails the client is already gone (e.g. a
    # dev-only double-connect that got superseded), nothing more to do.
    if not await safe_send_json(websocket, {
        "type":     "connected",
        "message":  f"Hello {username}! I know your farm in {state}. Ask me anything!",
        "language": session_language,
        "season":   ctx.get("season", "Kharif")
    }):
        return

    try:
        while True:
            data    = await websocket.receive_json()
            message = data.get("message", "").strip()

            if not message:
                continue

            # 1. Save farmer message to MongoDB
            await save_message(username, "user", message, db)
            print(f"💬 [{username}]: {message}")

            # 2. Load full conversation history (includes the message just saved)
            history = await load_history(username, db, limit=10)

            # 3. Rebuild system prompt with the language of THIS message +
            #    explicit username.
            #
            #    FIX: this used to pass session_language — the *previous*
            #    turn's language, or the profile default (often "English")
            #    on the very first message — as the prompt's stated
            #    default, and relied entirely on the LLM to notice the
            #    CURRENT message's script and override that default on its
            #    own. In practice, smaller/fast Groq models frequently
            #    anchor on the stated default instead of overriding it —
            #    e.g. a farmer's very first message of the session, spoken
            #    in Telugu, would still see "Default language: English" in
            #    the prompt and often got an English reply back regardless
            #    of the LANGUAGE block's instructions.
            #
            #    We already have a script detector (detect_lang_code) —
            #    use it on the incoming message itself so the prompt states
            #    the CORRECT language up front instead of leaving it to the
            #    model to catch and resolve a contradiction. Falls back to
            #    session_language when the message has no reliable script
            #    signal (numbers only, a single ambiguous word, romanized
            #    text, etc. — detect_lang_code returns "en" for all of
            #    these, same as genuine English), same as before.
            incoming_code = detect_lang_code(message)
            turn_language = (
                LANGUAGE_DISPLAY_NAMES.get(incoming_code, session_language)
                if incoming_code != "en"
                else session_language
            )
            system_prompt = build_system_prompt(
                ctx, username=username, language=turn_language,
                memories=user_memories, past_summary=past_summary,
            )

            # 4. Generate response — the agent decides internally whether it needs
            #    to call any tools (market price lookup for ANY crop, price trend,
            #    RAG document search, or last disease detection) based on what
            #    was actually asked. No manual keyword gating needed anymore.
            had_error = False
            try:
                result   = await run_chat_agent(
                    messages=history,
                    system_prompt=system_prompt,
                    max_tokens=600,
                    username=username
                )
                response    = result["response"]
                used_tools  = result["used_tools"]
                rag_sources = result["sources"]
                used_rag    = "search_farming_documents" in used_tools
                if used_tools:
                    print(f"🛠️  Tools used: {used_tools}")
            except Exception as e:
                response    = f"Sorry, error: {str(e)}"
                rag_sources = []
                used_rag    = False
                had_error   = True

            # 5. Save bot response to MongoDB
            await save_message(username, "assistant", response, db)
            print(f"🤖 Bot: {response[:100]}...")

            # 5b. Fire background memory tasks (extraction + summarization)
            #     These never block the chat response.
            if not had_error:
                run_memory_tasks(username, message, response, db)

            # 6. Keep session_language in sync with the language the agent
            #    actually just replied in (detected from the reply's own
            #    script) — this is what step 3's fallback uses for the NEXT
            #    ambiguous/short message, so it stays continuous with the
            #    real conversation instead of drifting back to whatever was
            #    saved on the profile at connection time. Skipped on error
            #    responses (always plain English) so a transient failure
            #    doesn't wrongly reset the farmer's actual session language.
            if not had_error:
                detected_code = detect_lang_code(response)
                session_language = LANGUAGE_DISPLAY_NAMES.get(detected_code, session_language)

            # 7. Send to farmer
            if not await safe_send_json(websocket, {
                "type":     "message",
                "response": response,
                "sources":  rag_sources,
                "used_rag": used_rag
            }):
                break  # client's already gone — nothing left to do here

    except WebSocketDisconnect:
        print(f"🔌 Disconnected: {username}")
    except Exception as e:
        print(f"❌ WS error for {username}: {e}")
        try:
            await websocket.close()
        except Exception:
            pass


@router.post("/chat/transcribe")
async def transcribe_voice_message(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """
    Speech-to-text for the chat mic button.

    Uses Groq Whisper (already-configured API keys, same rotation-on-rate-
    limit pattern as the text chat) instead of the browser's native
    SpeechRecognition — that API is Chrome/webkit-only and its accuracy for
    Indian languages (Telugu, Kannada, Marathi, etc.) varies a lot across
    budget Android devices. Whisper gives consistent quality regardless of
    device, and needs no language hint — it auto-detects from the audio,
    which is what lets a farmer speak in ANY language and have it work.

    Returns the transcript plus Whisper's detected language, so the frontend
    can show it and (optionally) use it to pick a matching text-to-speech
    voice for the reply without guessing from the reply text alone.
    """
    allowed_types = ["audio/webm", "audio/wav", "audio/mp3", "audio/mpeg", "audio/mp4", "audio/ogg", "audio/x-m4a"]
    if file.content_type and file.content_type not in allowed_types:
        # Some browsers send an empty or unusual content_type for recorded
        # blobs — don't hard-reject, Whisper will just error out itself if
        # the bytes truly aren't audio.
        pass

    audio_bytes = await file.read()
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Empty audio file")

    try:
        result = transcribe_audio_with_rotation(audio_bytes, filename=file.filename or "voice.webm")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Transcription failed: {str(e)}")

    return {
        "text":     result["text"],
        "language": result["language"]
    }


class SpeakRequest(BaseModel):
    text: str


@router.post("/chat/speak")
async def speak_chat_reply(
    body: SpeakRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Text-to-speech for the chat's auto-read-aloud / speaker button.

    Generates audio server-side via edge-tts (free, no API key, Microsoft's
    online neural voice service) instead of the browser's built-in
    speechSynthesis. Browser TTS depends entirely on which voices happen to
    be installed on the farmer's own phone — with no matching voice
    installed, it silently substitutes its default English voice and reads
    the text anyway, producing badly mispronounced audio. Generating audio
    here means every farmer gets the same real neural-quality voice for
    their language, regardless of device.
    """
    text = (body.text or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="No text to speak")
    # Keep individual TTS calls reasonably sized — a farmer reading this
    # much text wouldn't want to wait for it all to synthesize anyway.
    text = text[:2000]

    try:
        audio_bytes = await synthesize_speech(text)
    except Exception as e:
        # FIX: this was previously only ever sent back as an HTTP 502
        # detail, which the frontend's catch-and-hide error handling
        # never surfaced anywhere — a broken edge-tts call (stale
        # install, blocked outbound network to Microsoft's TTS service,
        # a retired voice name, etc.) was failing completely silently
        # end to end. Logging server-side makes a "read aloud does
        # nothing" report actually diagnosable from the server logs.
        print(f"❌ TTS failed for {current_user.get('username')}: {e}")
        raise HTTPException(status_code=502, detail=f"Speech synthesis failed: {str(e)}")

    return Response(content=audio_bytes, media_type="audio/mpeg")


@router.get("/chat/history/{username}")
async def get_chat_history(username: str, limit: int = 20, current_user: dict = Depends(get_current_user)):
    """Get farmer's chat history."""
    if current_user["role"] != "admin" and current_user["username"] != username:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your account")

    db  = get_db()
    doc = await db[CHAT_HISTORY_COLLECTION].find_one(
        {"username": username}, {"_id": 0}
    )
    if not doc:
        return {"username": username, "messages": [], "total": 0}

    messages = doc.get("messages", [])
    return {
        "username": username,
        "total":    len(messages),
        "messages": messages[-limit:]
    }


@router.delete("/chat/history/{username}")
async def clear_chat_history(username: str, current_user: dict = Depends(get_current_user)):
    """Clear farmer's chat history."""
    if current_user["role"] != "admin" and current_user["username"] != username:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your account")

    db = get_db()
    await db[CHAT_HISTORY_COLLECTION].update_one(
        {"username": username},
        {"$set": {"messages": [], "updated_at": datetime.utcnow()}}
    )
    return {"message": f"Chat history cleared for {username}"}