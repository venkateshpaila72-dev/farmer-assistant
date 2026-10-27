"""
Centralized translation layer.

Azure AI Translator + MongoDB translation cache.

Flow:

    API response
          ↓
    extract unique text
          ↓
    MongoDB translation cache
          ↓
    Azure Translator for cache misses
          ↓
    save translations
          ↓
    return translations

Important:

    Numeric values are never translated.

    Prices, IDs, dates, URLs, etc. remain unchanged.
"""

import asyncio
import hashlib
import re
import time

from datetime import datetime

from typing import (
    Any,
    Dict,
    Iterable,
    List,
    Optional,
)

import httpx

from pymongo import UpdateOne

from app.core.config import settings
from app.db.database import get_db
from app.db.models import TRANSLATIONS_COLLECTION


# ============================================================
# Supported languages
# ============================================================

SUPPORTED_LANGS = {
    "en",
    "hi",
    "te",
    "ta",
    "kn",
    "mr",
    "bn",
    "pa",
}


# ============================================================
# Azure limits
# ============================================================

_MAX_ITEMS_PER_REQUEST = 100

_MAX_CHARS_PER_REQUEST = 40_000


# ============================================================
# Azure failure cooldown
# ============================================================

_COOLDOWN_SECONDS = 300

_disabled_until = 0.0


# ============================================================
# Avoid duplicate simultaneous translations
# ============================================================

_inflight: Dict[
    str,
    "asyncio.Future"
] = {}


# ============================================================
# Text detection
# ============================================================

_has_letters = re.compile(
    r"[^\W\d_]",
    re.UNICODE,
)

_is_url = re.compile(
    r"^\s*https?://\S+\s*$",
    re.IGNORECASE,
)


# ============================================================
# Translation cache key
# ============================================================

def _key(
    text: str,
    target: str,
    source: str = "auto",
) -> str:

    return hashlib.sha256(
        f"{source}|{target}|{text}".encode(
            "utf-8"
        )
    ).hexdigest()


# ============================================================
# Is text translatable?
# ============================================================

def _translatable(
    text: Any,
) -> bool:

    if not isinstance(text, str):
        return False

    text = text.strip()

    if not text:
        return False

    if len(text) > settings.TRANSLATION_MAX_CHARS:
        return False

    if _is_url.match(text):
        return False

    if not _has_letters.search(text):
        return False

    return True


# ============================================================
# Azure configured?
# ============================================================

def azure_configured() -> bool:

    return bool(
        settings.AZURE_TRANSLATOR_KEY
    )


# ============================================================
# Azure request
# ============================================================

async def _call_azure(
    texts: List[str],
    target: str,
) -> Optional[List[str]]:

    headers = {
        "Ocp-Apim-Subscription-Key":
            settings.AZURE_TRANSLATOR_KEY,

        "Content-Type":
            "application/json",
    }

    if settings.AZURE_TRANSLATOR_REGION:

        headers[
            "Ocp-Apim-Subscription-Region"
        ] = settings.AZURE_TRANSLATOR_REGION

    endpoint = (
        settings.AZURE_TRANSLATOR_ENDPOINT
        .rstrip("/")
    )

    async with httpx.AsyncClient(
        timeout=15
    ) as client:

        response = await client.post(
            f"{endpoint}/translate",

            params={
                "api-version": "3.0",
                "to": target,
            },

            headers=headers,

            json=[
                {
                    "text": text
                }
                for text in texts
            ],
        )

    response.raise_for_status()

    data = response.json()

    return [
        item["translations"][0]["text"]
        for item in data
    ]


# ============================================================
# Batch helper
# ============================================================

def _chunks(
    texts: List[str],
) -> Iterable[List[str]]:

    batch = []

    chars = 0

    for text in texts:

        if batch and (
            len(batch)
            >= _MAX_ITEMS_PER_REQUEST
            or
            chars + len(text)
            > _MAX_CHARS_PER_REQUEST
        ):

            yield batch

            batch = []

            chars = 0

        batch.append(text)

        chars += len(text)

    if batch:
        yield batch


# ============================================================
# Translate texts
# ============================================================

async def translate_texts(
    texts: Iterable[str],
    target: str,
) -> Dict[str, str]:

    global _disabled_until

    target = (
        target
        or "en"
    ).lower()

    if (
        target == "en"
        or target not in SUPPORTED_LANGS
    ):
        return {}

    unique = list(
        dict.fromkeys(
            text
            for text in texts
            if _translatable(text)
        )
    )

    if not unique:
        return {}

    result: Dict[str, str] = {}

    db = get_db()

    if db is None:
        return {}

    collection = db[
        TRANSLATIONS_COLLECTION
    ]

    # ========================================================
    # 1. MongoDB cache
    # ========================================================

    keys = {
        text: _key(
            text,
            target,
        )
        for text in unique
    }

    try:

        by_key = {
            key: text
            for text, key in keys.items()
        }

        async for doc in collection.find(
            {
                "_id": {
                    "$in": list(
                        by_key
                    )
                }
            },
            {
                "translation": 1
            },
        ):

            result[
                by_key[
                    doc["_id"]
                ]
            ] = doc[
                "translation"
            ]

    except Exception as exc:

        print(
            "⚠️ translation cache "
            f"read failed: {exc}"
        )

    # ========================================================
    # Cache misses
    # ========================================================

    misses = [
        text
        for text in unique
        if text not in result
    ]

    if (
        not misses
        or not azure_configured()
        or time.time()
        < _disabled_until
    ):
        return result

    # ========================================================
    # 2. Avoid duplicate Azure calls
    # ========================================================

    waiting = {
        text: _inflight[keys[text]]
        for text in misses
        if keys[text] in _inflight
    }

    mine = [
        text
        for text in misses
        if keys[text] not in _inflight
    ]

    my_futures = {}

    loop = asyncio.get_running_loop()

    for text in mine:

        future = loop.create_future()

        _inflight[
            keys[text]
        ] = future

        my_futures[text] = future

    translated: Dict[str, str] = {}

    try:

        # ====================================================
        # 3. Azure translation
        # ====================================================

        for batch in _chunks(mine):

            try:

                output = await _call_azure(
                    batch,
                    target,
                )

            except Exception as exc:

                print(
                    "⚠️ Azure Translator "
                    f"failed ({exc}); "
                    "falling back to original text"
                )

                _disabled_until = (
                    time.time()
                    + _COOLDOWN_SECONDS
                )

                break

            if (
                not output
                or len(output)
                != len(batch)
            ):
                continue

            for original, translation in zip(
                batch,
                output,
            ):

                if (
                    translation
                    and translation.strip()
                ):

                    translated[
                        original
                    ] = translation

        # ====================================================
        # 4. Save translations
        # ====================================================

        if translated:

            now = datetime.utcnow()

            operations = [
                UpdateOne(
                    {
                        "_id": keys[text]
                    },

                    {
                        "$setOnInsert": {
                            "src": "auto",
                            "tgt": target,
                            "text": text,
                            "translation": translation,
                            "created_at": now,
                        }
                    },

                    upsert=True,
                )

                for text, translation
                in translated.items()
            ]

            try:

                await collection.bulk_write(
                    operations,
                    ordered=False,
                )

            except Exception as exc:

                print(
                    "⚠️ translation cache "
                    f"write failed: {exc}"
                )

            print(
                f"🌐 Azure translated "
                f"{len(translated)} new text(s) "
                f"-> {target}"
            )

    finally:

        for text, future in my_futures.items():

            _inflight.pop(
                keys[text],
                None,
            )

            if not future.done():

                future.set_result(
                    translated.get(text)
                )

    result.update(
        translated
    )

    # ========================================================
    # Wait for translations started by another request
    # ========================================================

    for text, future in waiting.items():

        try:

            value = await asyncio.wait_for(
                asyncio.shield(future),
                timeout=20,
            )

            if value:
                result[text] = value

        except Exception:
            pass

    return result


# ============================================================
# Generic payload translator
# ============================================================

async def translate_payload(
    data: Any,
    target: str,
    fields: Iterable[str],
) -> Any:

    """
    Existing news/announcement translation.

    Only fields listed in `fields` are translated.
    """

    fields = set(fields)

    slots: List[
        tuple
    ] = []

    def walk(node: Any):

        if isinstance(node, dict):

            for key, value in node.items():

                if (
                    key in fields
                    and isinstance(value, str)
                ):

                    slots.append(
                        (
                            node,
                            key,
                        )
                    )

                else:

                    walk(value)

        elif isinstance(node, list):

            for item in node:

                walk(item)

    walk(data)

    if not slots:
        return data

    mapping = await translate_texts(
        [
            container[key]
            for container, key
            in slots
        ],
        target,
    )

    for container, key in slots:

        original = container[key]

        container[key] = mapping.get(
            original,
            original,
        )

    return data