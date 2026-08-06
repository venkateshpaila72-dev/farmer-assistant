"""
Shared chat history read/write helpers.

Originally these lived inline in routes/ws.py. Pulled out here so that
routes/vision.py can ALSO append messages to the same conversation when a
farmer analyzes a soil or crop photo from inside the chat UI — without
vision.py having to import from ws.py (which would be a route-module ->
route-module import, awkward and easy to turn circular later).
"""

from datetime import datetime
from app.db.models import CHAT_HISTORY_COLLECTION


async def save_message(username: str, role: str, content: str, db):
    """Save one message to MongoDB chat_history collection."""
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
    """Load last N messages from MongoDB for conversation continuity."""
    doc = await db[CHAT_HISTORY_COLLECTION].find_one({"username": username})
    if not doc:
        return []

    messages = doc.get("messages", [])
    return [
        {"role": m["role"], "content": m["content"]}
        for m in messages[-limit:]
    ]