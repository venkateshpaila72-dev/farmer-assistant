"""
Simple memory system for the AI chat assistant.

SHORT-TERM MEMORY
  - The last 20 messages stay in chat_history (full text).
  - Older messages are compressed into a running summary stored in
    chat_summaries, then removed from chat_history.

Summarization runs as a fire-and-forget background task
(asyncio.create_task) — it never blocks the chat response.
"""

import asyncio
from datetime import datetime
from app.core.config import settings
from app.db.models import CHAT_SUMMARIES_COLLECTION, CHAT_HISTORY_COLLECTION
from app.utils.groq_utils import groq_completion_with_rotation

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
MAX_MESSAGES_KEPT = 20        # keep only last N full messages in chat_history
SUMMARY_BATCH_SIZE = 10       # summarize this many oldest messages at a time


# ---------------------------------------------------------------------------
# Chat history summarization
# ---------------------------------------------------------------------------

_SUMMARIZE_PROMPT = """Summarize the following conversation messages between a farmer and an AI farming assistant into 2-3 concise paragraphs. Preserve key topics discussed, any decisions made, and important context. Write in third person ("The farmer asked about...").

MESSAGES:
{messages}

Summary:"""


async def summarize_and_trim_history(username: str, db) -> None:
    """If chat_history has >MAX_MESSAGES_KEPT messages, summarize the oldest
    batch, store the summary, and trim the history.

    Designed to run as a background task — catches all exceptions internally.
    """
    try:
        doc = await db[CHAT_HISTORY_COLLECTION].find_one({"username": username})
        if not doc:
            return

        messages = doc.get("messages", [])
        if len(messages) <= MAX_MESSAGES_KEPT:
            return  # nothing to trim

        # Messages to summarize (everything beyond the last MAX_MESSAGES_KEPT)
        overflow_count = len(messages) - MAX_MESSAGES_KEPT
        to_summarize = messages[:overflow_count]
        to_keep = messages[overflow_count:]

        # Build a text block from the messages to summarize
        msg_lines = []
        for m in to_summarize:
            role = m.get("role", "unknown").capitalize()
            content = m.get("content", "")[:300]  # cap per-message to keep prompt reasonable
            msg_lines.append(f"{role}: {content}")
        messages_text = "\n".join(msg_lines)

        prompt = _SUMMARIZE_PROMPT.format(messages=messages_text)

        result = groq_completion_with_rotation(
            model=settings.GROQ_MODEL,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=400,
            temperature=0.3,
        )
        summary_text = (result.choices[0].message.content or "").strip()

        if not summary_text:
            return

        # Append to existing summary (accumulative)
        existing_summary_doc = await db[CHAT_SUMMARIES_COLLECTION].find_one({"username": username})
        existing_summary = existing_summary_doc.get("summary", "") if existing_summary_doc else ""
        if existing_summary:
            combined_summary = f"{existing_summary}\n\n---\n\n{summary_text}"
        else:
            combined_summary = summary_text

        # Cap the combined summary to prevent unbounded growth (~3000 chars)
        if len(combined_summary) > 3000:
            # Re-summarize the combined summary to keep it compact
            re_prompt = f"Condense the following conversation history summary into 2-3 concise paragraphs, preserving only the most important facts and context:\n\n{combined_summary}"
            re_result = groq_completion_with_rotation(
                model=settings.GROQ_MODEL,
                messages=[{"role": "user", "content": re_prompt}],
                max_tokens=400,
                temperature=0.3,
            )
            combined_summary = (re_result.choices[0].message.content or "").strip() or combined_summary[:3000]

        # Store the summary
        await db[CHAT_SUMMARIES_COLLECTION].update_one(
            {"username": username},
            {
                "$set": {
                    "summary": combined_summary,
                    "message_count": (existing_summary_doc or {}).get("message_count", 0) + overflow_count,
                    "last_summarized_at": datetime.utcnow(),
                    "updated_at": datetime.utcnow(),
                },
                "$setOnInsert": {"username": username, "created_at": datetime.utcnow()},
            },
            upsert=True,
        )

        # Trim the chat history to only the kept messages
        await db[CHAT_HISTORY_COLLECTION].update_one(
            {"username": username},
            {"$set": {"messages": to_keep, "updated_at": datetime.utcnow()}},
        )
        print(f"📝 Summarized {overflow_count} old messages for {username}, keeping last {len(to_keep)}")

    except Exception as e:
        # Never crash — this is a background task
        print(f"⚠️ Summarization failed for {username}: {type(e).__name__}: {e}")


# ---------------------------------------------------------------------------
# Past conversation summary — loading
# ---------------------------------------------------------------------------

async def load_chat_summary(username: str, db) -> str:
    """Load the compressed summary of past conversations for a user."""
    doc = await db[CHAT_SUMMARIES_COLLECTION].find_one({"username": username})
    if not doc:
        return ""
    return doc.get("summary", "")


# ---------------------------------------------------------------------------
# Background task launcher — called from ws.py after each turn
# ---------------------------------------------------------------------------

def run_memory_tasks(username: str, user_msg: str, assistant_msg: str, db) -> None:
    """Fire-and-forget background task for summarization.

    Called after every chat turn. Summarizes old messages beyond the last 20
    and never blocks the chat response.
    """
    asyncio.create_task(summarize_and_trim_history(username, db))
