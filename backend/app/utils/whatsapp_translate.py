"""
WhatsApp message localization (Azure AI Translator).

Strict rule: a farmer's WhatsApp messages are delivered ONLY in the language
saved in their profile (`chat_language`). Pipeline for any non-English
language:

    English draft  ->  Azure Translator (line by line)  ->  WhatsApp formatting

Why line by line: the message has a fixed layout (emoji + *bold label:* +
body). Sending the whole thing to a translator can mangle the asterisks, so
the structure is split off first, only the human-readable text is translated,
and the WhatsApp formatting (single-asterisk bold, emoji, bullets) is put
back by code afterwards — guaranteed valid, never left to the translator.

Unlike the website's dynamic-content layer (utils/translator.py), report text
is NOT cached: every report is unique (today's numbers), so caching it would
only fill the database.

All functions here RAISE on failure — callers decide what to do (the
supervisor falls back to the LLM writing directly in the language, and if
even that isn't in the right language, the message is not sent at all).
"""
import re
from typing import Dict, List

from app.utils.translator import _call_azure, _chunks, azure_configured

# Profile value (language name, as stored in `chat_language`) <-> Azure code.
LANG_CODES = {
    "English": "en",
    "Hindi":   "hi",
    "Telugu":  "te",
    "Tamil":   "ta",
    "Kannada": "kn",
    "Marathi": "mr",
    "Bengali": "bn",
    "Punjabi": "pa",
}
_CODE_TO_NAME = {code: name for name, code in LANG_CODES.items()}


def canonical_language(value) -> str:
    """
    Normalizes whatever is stored in the profile ("Telugu", "telugu", "te",
    None, an unsupported language...) to one of the 8 supported language
    names. Anything unknown/missing becomes "English".
    """
    if not value:
        return "English"
    v = str(value).strip()
    if v.lower() in _CODE_TO_NAME:
        return _CODE_TO_NAME[v.lower()]
    for name in LANG_CODES:
        if name.lower() == v.lower():
            return name
    return "English"


def language_code(value) -> str:
    return LANG_CODES[canonical_language(value)]


# "<emoji> *Label:* body"  — the emoji is optional.
_LABELED = re.compile(r"^(\s*)([^\w\s*]{1,3}\s*)?\*([^*\n]+?)\*\s*(.*)$")
# leading bullet / dash marker we keep as-is
_BULLET = re.compile(r"^(\s*(?:[-•]\s+)?)(.*)$")


def _plain(s: str) -> str:
    """Remove any WhatsApp bold/italic markers so the translator sees clean text."""
    return s.replace("*", "").replace("_", " ").strip()


def _parse(line: str):
    """
    Splits one line into (kind, parts):
      ("blank", None)
      ("labeled", (indent, emoji, label_text, had_colon, body))
      ("plain",   (prefix, text))
    """
    if not line.strip():
        return "blank", None

    m = _LABELED.match(line)
    if m:
        indent, emoji, label, body = m.group(1), m.group(2) or "", m.group(3), m.group(4)
        label = label.strip()
        had_colon = label.endswith(":")
        label_text = label[:-1].strip() if had_colon else label
        return "labeled", (indent, emoji, label_text, had_colon, _plain(body))

    m = _BULLET.match(line)
    prefix, text = m.group(1), m.group(2)
    return "plain", (prefix, _plain(text))


async def _translate_many(texts: List[str], target: str) -> Dict[str, str]:
    """Strict batched Azure call. Raises on any problem."""
    if not azure_configured():
        raise RuntimeError("Azure Translator is not configured (AZURE_TRANSLATOR_KEY missing)")

    unique = list(dict.fromkeys(t for t in texts if t and t.strip()))
    result: Dict[str, str] = {}
    for batch in _chunks(unique):
        out = await _call_azure(batch, target)
        if not out or len(out) != len(batch):
            raise RuntimeError("Azure Translator returned an unexpected response")
        for original, translated in zip(batch, out):
            if not translated or not translated.strip():
                raise RuntimeError("Azure Translator returned an empty translation")
            result[original] = translated.strip()
    return result


async def translate_whatsapp_text(text: str, target_language) -> str:
    """
    Translates a WhatsApp message (English draft) into the farmer's language,
    keeping its layout and re-applying valid WhatsApp formatting.
    Returns the text unchanged for English. Raises on failure.
    """
    code = language_code(target_language)
    if code == "en":
        return text

    parsed = [_parse(line) for line in text.split("\n")]

    to_translate: List[str] = []
    for kind, parts in parsed:
        if kind == "labeled":
            _, _, label_text, _, body = parts
            to_translate += [label_text, body]
        elif kind == "plain":
            to_translate.append(parts[1])

    mapping = await _translate_many(to_translate, code)

    out_lines: List[str] = []
    for kind, parts in parsed:
        if kind == "blank":
            out_lines.append("")
        elif kind == "labeled":
            indent, emoji, label_text, had_colon, body = parts
            label = mapping.get(label_text, label_text).rstrip(":：").strip()
            label = f"*{label}{':' if had_colon else ''}*"
            line = f"{indent}{emoji}{label}"
            if body:
                line += f" {mapping.get(body, body)}"
            out_lines.append(line)
        else:
            prefix, body = parts
            out_lines.append(f"{prefix}{mapping.get(body, body)}" if body else prefix.rstrip())

    return "\n".join(out_lines)