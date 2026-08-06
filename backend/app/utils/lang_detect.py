"""
Shared script/word-based language detection — a lightweight, non-LLM way to
tell which of the app's languages a piece of text is written in.

Used for:
- Picking a text-to-speech voice for read-aloud (tts_utils.py)
- Tracking the chat's "current session language" turn-by-turn (ws.py), so a
  short/ambiguous farmer message ("ok", "thanks") has a sensible fallback —
  whatever language the conversation was actually in most recently, instead
  of a fragile hardcoded keyword matcher for explicit "switch to X" phrases.

Deliberately NOT used to decide what language the agent replies in — that's
the LLM's job (see the LANGUAGE block in build_system_prompt). The model can
read actual meaning and intent (e.g. "give me the answer in English" written
in Telugu, or any of the app's languages) in a way pure script-matching
never can. This module only answers the mechanical "what script is this
text in" question, as a support signal, not the decision-maker.
"""

import re

# Unicode script ranges. Covers all 8 of the app's i18n locale languages
# (en, hi, te, ta, kn, mr, bn, pa) plus two bonus scripts (Malayalam,
# Gujarati) that cost nothing extra to detect even though they aren't full
# UI-translation locales yet — a farmer typing in either still gets a
# same-language chat reply.
_SCRIPT_RANGES = [
    ("te", re.compile(r"[\u0C00-\u0C7F]")),  # Telugu
    ("ta", re.compile(r"[\u0B80-\u0BFF]")),  # Tamil
    ("kn", re.compile(r"[\u0C80-\u0CFF]")),  # Kannada
    ("ml", re.compile(r"[\u0D00-\u0D7F]")),  # Malayalam
    ("bn", re.compile(r"[\u0980-\u09FF]")),  # Bengali
    ("gu", re.compile(r"[\u0A80-\u0AFF]")),  # Gujarati
    ("pa", re.compile(r"[\u0A00-\u0A7F]")),  # Punjabi (Gurmukhi script)
    ("hi", re.compile(r"[\u0900-\u097F]")),  # Devanagari — Hindi or Marathi, disambiguated below
]

# Devanagari script is shared by Hindi and Marathi, so script alone can't
# tell them apart. These are common function words used distinctly in
# Marathi (not standard Hindi) — if any appear, it's a solid signal the
# text is Marathi. Not linguistically exhaustive, just enough to catch the
# common case without needing an LLM call just to pick a voice/fallback.
_MARATHI_MARKERS = ["आहे", "आहेत", "मला", "तुम्ही", "करायचं", "कसं", "म्हणून", "नाही का"]


def detect_lang_code(text: str) -> str:
    """
    Best-effort detection of which app language `text` is written in.
    Returns a code matching the app's i18n locale files: en, hi, te, ta,
    kn, mr, bn, pa (plus ml/gu as a bonus). Falls back to "en" when no
    non-Latin script is found (covers actual English and any text with no
    reliable script signal, e.g. pure numbers).
    """
    for code, pattern in _SCRIPT_RANGES:
        if pattern.search(text):
            if code == "hi" and any(marker in text for marker in _MARATHI_MARKERS):
                return "mr"
            return code
    return "en"


LANGUAGE_DISPLAY_NAMES = {
    "en": "English",
    "hi": "Hindi",
    "te": "Telugu",
    "ta": "Tamil",
    "kn": "Kannada",
    "mr": "Marathi",
    "bn": "Bengali",
    "pa": "Punjabi",
    "ml": "Malayalam",
    "gu": "Gujarati",
}