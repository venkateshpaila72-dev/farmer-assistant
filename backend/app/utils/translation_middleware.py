"""
ASGI middleware that adds the translation layer AROUND existing routes.

For GET requests to the configured paths that carry `?lang=<code>` (code
other than "en"), the JSON response is intercepted, the human-readable fields
are translated, and the translated JSON is returned. The routes themselves are
not modified and know nothing about translation.

Any problem -> the original, untranslated response is sent unchanged.
"""
import asyncio
import json
from urllib.parse import parse_qs

from app.utils.translator import SUPPORTED_LANGS, translate_payload

# Only these URL prefixes are translated.
TRANSLATE_PATH_PREFIXES = ("/news", "/admins/announcements")

# Only these JSON field names (anywhere in the response) are translated.
TRANSLATE_FIELDS = {
    "title",
    "description",
    "content",
    "benefit",
    "eligibility",
    "where_to_apply",
}

_TOTAL_TIMEOUT_SECONDS = 25


class TranslationMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or scope["method"] != "GET":
            return await self.app(scope, receive, send)

        path = scope.get("path", "")
        if not path.startswith(TRANSLATE_PATH_PREFIXES):
            return await self.app(scope, receive, send)

        query = parse_qs(scope.get("query_string", b"").decode("latin-1"))
        lang = (query.get("lang", ["en"])[0] or "en").lower()
        if lang == "en" or lang not in SUPPORTED_LANGS:
            return await self.app(scope, receive, send)

        start_message = None
        chunks = []
        passthrough = False

        async def finish():
            body = b"".join(chunks)
            try:
                payload = json.loads(body)
                payload = await asyncio.wait_for(
                    translate_payload(payload, lang, TRANSLATE_FIELDS),
                    timeout=_TOTAL_TIMEOUT_SECONDS,
                )
                new_body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
            except Exception as e:
                print(f"⚠️ translation skipped, sending original response: {e}")
                new_body = body

            headers = [
                (k, v) for k, v in start_message["headers"]
                if k.lower() != b"content-length"
            ]
            headers.append((b"content-length", str(len(new_body)).encode()))
            await send({**start_message, "headers": headers})
            await send({"type": "http.response.body", "body": new_body})

        async def send_wrapper(message):
            nonlocal start_message, passthrough
            if message["type"] == "http.response.start":
                content_type = dict(message.get("headers", [])).get(b"content-type", b"")
                if message["status"] != 200 or b"application/json" not in content_type:
                    passthrough = True
                    await send(message)
                else:
                    start_message = message
            elif message["type"] == "http.response.body":
                if passthrough:
                    await send(message)
                    return
                chunks.append(message.get("body", b""))
                if not message.get("more_body", False):
                    await finish()
            else:
                await send(message)

        await self.app(scope, receive, send_wrapper)