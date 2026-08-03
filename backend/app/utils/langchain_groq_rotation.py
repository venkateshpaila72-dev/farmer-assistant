"""
Rotating multi-key ChatGroq — the LangChain-native replacement for
groq_completion_with_rotation() in groq_utils.py, used by both the chat
agent (langgraph_chat_agent.py) and the supervisor (agents/supervisor.py).

Groq's free tier rate-limits per API key/day. With N keys configured,
a call that hits a limit on one key automatically retries on the next
instead of failing the farmer's request — same behavior as before, just
implemented against LangChain's ChatGroq instead of the raw Groq SDK.
"""

from langchain_groq import ChatGroq
from app.core.config import settings

_KEYS = [
    k for k in [
        settings.GROQ_API_KEY,
        settings.GROQ_API_KEY_2,
        settings.GROQ_API_KEY_3,
        settings.GROQ_API_KEY_4,
    ] if k  # skip any not set in .env
]


def _is_rate_limit_error(e: Exception) -> bool:
    s = str(e).lower()
    return "rate_limit" in s or "429" in s or "rate limit" in s


class RotatingChatGroq:
    """
    Wraps several ChatGroq instances (one per API key, identical config
    otherwise) behind the same .bind_tools() / .ainvoke() surface a single
    ChatGroq exposes, so it's a drop-in for any LangChain/LangGraph code
    that expects a chat model. Rotates to the next key on a rate-limit
    error; any other error is raised immediately (rotating wouldn't help).
    """

    def __init__(self, models: list, start_index: int = 0):
        if not models:
            raise RuntimeError("No Groq API keys configured (GROQ_API_KEY is required).")
        self._models = models
        self._index = start_index % len(models)

    def bind_tools(self, tools, **kwargs) -> "RotatingChatGroq":
        return RotatingChatGroq(
            [m.bind_tools(tools, **kwargs) for m in self._models],
            start_index=self._index,
        )

    async def ainvoke(self, *args, **kwargs):
        last_error = None
        for _ in range(len(self._models)):
            model = self._models[self._index]
            try:
                return await model.ainvoke(*args, **kwargs)
            except Exception as e:
                last_error = e
                if _is_rate_limit_error(e):
                    print(f"⚠️ Groq key #{self._index + 1} rate-limited, rotating to next key...")
                    self._index = (self._index + 1) % len(self._models)
                    continue
                raise
        raise last_error


def get_rotating_chat_groq(
    model: str = None,
    temperature: float = 0.7,
    max_tokens: int = 600,
) -> RotatingChatGroq:
    """Build a fresh rotation-aware ChatGroq for one request/session."""
    model = model or settings.GROQ_MODEL
    instances = [
        ChatGroq(model=model, api_key=k, temperature=temperature, max_tokens=max_tokens)
        for k in _KEYS
    ]
    return RotatingChatGroq(instances)