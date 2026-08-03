from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException, Depends, status
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
    detect_language_override
)
from app.utils.langgraph_chat_agent import run_chat_agent
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


async def save_message(username: str, role: str, content: str, db):
    """Save message to MongoDB chat_history collection. (unchanged)"""
    message = {
        "role":      role,
        "content":   content,
        "timestamp": datetime.utcnow().isoformat()
    }

    result = await db[CHAT_HISTORY_COLLECTION].update_one(
        {"username": username},
        {
            "$push":        {"messages": message},
            "$set":         {"updated_at": datetime.utcnow()},
            "$setOnInsert": {
                "username":   username,
                "created_at": datetime.utcnow()
            }
        },
        upsert=True
    )
    return result


async def load_history(username: str, db, limit: int = 10) -> list:
    """Load last N messages from MongoDB for conversation continuity. (unchanged)"""
    doc = await db[CHAT_HISTORY_COLLECTION].find_one({"username": username})
    if not doc:
        return []

    messages = doc.get("messages", [])
    return [
        {"role": m["role"], "content": m["content"]}
        for m in messages[-limit:]
    ]


@router.websocket("/ws/chat/{username}")
async def websocket_chat(websocket: WebSocket, username: str, token: str = None):
    """
    WebSocket chatbot — now agentic:
    ✅ Full farmer profile context (always injected — cheap, almost always relevant)
    ✅ Chat memory (MongoDB)
    ✅ Tool-calling agent: market price (ANY crop, not just preferred_crops),
       price trend, RAG document search, last disease detection — agent
       decides which to call based on the actual question, not a fixed list
    ✅ Language preference from profile, with session override if farmer asks to switch
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

            # 2. Check if farmer is asking to switch language THIS message.
            #    If so, update session_language — it stays in effect for all
            #    future messages on this connection until changed again.
            lang_override = detect_language_override(message)
            if lang_override:
                session_language = lang_override
                print(f"🌐 Language switched to {session_language} for {username}")

            # 3. Load full conversation history (includes the message just saved)
            history = await load_history(username, db, limit=10)

            # 4. Rebuild system prompt with CURRENT session language + explicit username
            system_prompt = build_system_prompt(ctx, username=username, language=session_language)

            # 5. Generate response — the agent decides internally whether it needs
            #    to call any tools (market price lookup for ANY crop, price trend,
            #    RAG document search, or last disease detection) based on what
            #    was actually asked. No manual keyword gating needed anymore.
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

            # 6. Save bot response to MongoDB
            await save_message(username, "assistant", response, db)
            print(f"🤖 Bot: {response[:100]}...")

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