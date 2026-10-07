"""
Centralized translation layer (Azure AI Translator + MongoDB translation cache).

Flow for every text:
    1. Look it up in the `translations` collection (key = hash of
       source-lang + target-lang + exact text).
    2. Only the texts NOT found are sent to Azure, in batches.
    3. New translations are saved, so the same text is never paid for twice.

Design rules:
    * No time-based expiry — if the original text is unchanged, its translation
      is reused forever. Changed text = new hash = translated as new content.
    * Never raises to the caller. Any failure (missing key, quota exhausted,
      network error) returns the ORIGINAL text, so pages never break.
    * Credentials come from backend settings only.
"""
import asyncio
import hashlib
import re
import time
from datetime import datetime
from typing import Any, Dict, Iterable, List, Optional

import httpx
from pymongo import UpdateOne

from app.core.config import settings
from app.db.database import get_db
from app.db.models import TRANSLATIONS_COLLECTION

# The 8 site languages (en = original, never translated).
SUPPORTED_LANGS = {"en", "hi", "te", "ta", "kn", "mr", "bn", "pa"}

# Azure limits: max 100 elements and 50,000 characters per request.
_MAX_ITEMS_PER_REQUEST = 100
_MAX_CHARS_PER_REQUEST = 40_000

# If Azure fails (bad key / free quota used up / outage), stop calling it for
# a few minutes instead of slowing down every single request.
_COOLDOWN_SECONDS = 300
_disabled_until = 0.0

# Texts currently being translated by another request -> avoid double calls.
_inflight: Dict[str, "asyncio.Future"] = {}

_has_letters = re.compile(r"[^\W\d_]", re.UNICODE)
_is_url = re.compile(r"^\s*https?://\S+\s*$", re.IGNORECASE)


def _key(text: str, target: str, source: str = "auto") -> str:
    return hashlib.sha256(f"{source}|{target}|{text}".encode("utf-8")).hexdigest()


def _translatable(text: Any) -> bool:
    """Only translate real human-readable text, within a sane length."""
    if not isinstance(text, str):
        return False
    t = text.strip()
    if not t or len(t) > settings.TRANSLATION_MAX_CHARS:
        return False
    if _is_url.match(t) or not _has_letters.search(t):
        return False
    return True


def azure_configured() -> bool:
    return bool(settings.AZURE_TRANSLATOR_KEY)


async def _call_azure(texts: List[str], target: str) -> Optional[List[str]]:
    """One batched Azure call. Returns translations in the same order, or None."""
    headers = {
        "Ocp-Apim-Subscription-Key": settings.AZURE_TRANSLATOR_KEY,
        "Content-Type": "application/json",
    }
    if settings.AZURE_TRANSLATOR_REGION:
        headers["Ocp-Apim-Subscription-Region"] = settings.AZURE_TRANSLATOR_REGION

    endpoint = settings.AZURE_TRANSLATOR_ENDPOINT.rstrip("/")
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(
            f"{endpoint}/translate",
            params={"api-version": "3.0", "to": target},
            headers=headers,
            json=[{"text": t} for t in texts],
        )
    resp.raise_for_status()
    data = resp.json()
    return [item["translations"][0]["text"] for item in data]


def _chunks(texts: List[str]) -> Iterable[List[str]]:
    batch, chars = [], 0
    for t in texts:
        if batch and (len(batch) >= _MAX_ITEMS_PER_REQUEST or chars + len(t) > _MAX_CHARS_PER_REQUEST):
            yield batch
            batch, chars = [], 0
        batch.append(t)
        chars += len(t)
    if batch:
        yield batch


async def translate_texts(texts: Iterable[str], target: str) -> Dict[str, str]:
    """
    Returns {original_text: translated_text} for every translatable text.
    Texts that could not be translated are simply missing from the result
    (callers keep the original).
    """
    global _disabled_until

    target = (target or "en").lower()
    if target == "en" or target not in SUPPORTED_LANGS:
        return {}

    unique = list(dict.fromkeys(t for t in texts if _translatable(t)))
    if not unique:
        return {}

    result: Dict[str, str] = {}
    db = get_db()
    if db is None:
        return {}
    coll = db[TRANSLATIONS_COLLECTION]

    # 1) Cache lookup — one query for all texts.
    keys = {t: _key(t, target) for t in unique}
    try:
        by_key = {k: t for t, k in keys.items()}
        async for doc in coll.find({"_id": {"$in": list(by_key)}}, {"translation": 1}):
            result[by_key[doc["_id"]]] = doc["translation"]
    except Exception as e:  # cache failure must never break the page
        print(f"⚠️ translation cache read failed: {e}")

    misses = [t for t in unique if t not in result]
    if not misses or not azure_configured() or time.time() < _disabled_until:
        return result

    # 2) Texts another request is already translating: wait for them instead
    #    of calling Azure again.
    waiting = {t: _inflight[keys[t]] for t in misses if keys[t] in _inflight}
    mine = [t for t in misses if keys[t] not in _inflight]
    my_futures = {}
    loop = asyncio.get_running_loop()
    for t in mine:
        fut = loop.create_future()
        _inflight[keys[t]] = fut
        my_futures[t] = fut

    translated: Dict[str, str] = {}
    try:
        # 3) Azure call(s) for the genuinely new texts only.
        for batch in _chunks(mine):
            try:
                out = await _call_azure(batch, target)
            except Exception as e:
                print(f"⚠️ Azure Translator failed ({e}); falling back to original text")
                _disabled_until = time.time() + _COOLDOWN_SECONDS
                break
            if not out or len(out) != len(batch):
                continue
            for original, tr in zip(batch, out):
                if tr and tr.strip():
                    translated[original] = tr

        # 4) Save new translations to the cache.
        if translated:
            now = datetime.utcnow()
            ops = [
                UpdateOne(
                    {"_id": keys[o]},
                    {"$setOnInsert": {
                        "src": "auto", "tgt": target, "text": o,
                        "translation": tr, "created_at": now,
                    }},
                    upsert=True,
                )
                for o, tr in translated.items()
            ]
            try:
                await coll.bulk_write(ops, ordered=False)
            except Exception as e:
                print(f"⚠️ translation cache write failed: {e}")
            print(f"🌐 Azure translated {len(translated)} new text(s) -> {target} "
                  f"({sum(len(o) for o in translated)} chars)")
    finally:
        for t, fut in my_futures.items():
            _inflight.pop(keys[t], None)
            if not fut.done():
                fut.set_result(translated.get(t))

    result.update(translated)

    for t, fut in waiting.items():
        try:
            val = await asyncio.wait_for(asyncio.shield(fut), timeout=20)
            if val:
                result[t] = val
        except Exception:
            pass

    return result


async def translate_payload(data: Any, target: str, fields: Iterable[str]) -> Any:
    """
    Translates, in place, the string values of the given field names anywhere
    inside a JSON-like structure (dicts/lists). Everything else (numbers,
    ids, urls, names, dates, keys) is left exactly as it is.
    """
    fields = set(fields)
    slots: List[tuple] = []  # (container, key)

    def walk(node: Any):
        if isinstance(node, dict):
            for k, v in node.items():
                if k in fields and isinstance(v, str):
                    slots.append((node, k))
                else:
                    walk(v)
        elif isinstance(node, list):
            for item in node:
                walk(item)

    walk(data)
    if not slots:
        return data

    mapping = await translate_texts([c[k] for c, k in slots], target)
    for container, key in slots:
        container[key] = mapping.get(container[key], container[key])
    return data