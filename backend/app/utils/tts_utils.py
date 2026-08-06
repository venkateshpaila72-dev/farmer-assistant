"""
Server-side text-to-speech using edge-tts — Microsoft Edge's free online
neural voice service (no API key, no per-request cost).

This replaces the earlier approach of using the browser's built-in
speechSynthesis for the chat's auto-read-aloud / speaker button. That
approach depends entirely on which voices happen to be installed on each
individual farmer's phone: if a language has no matching voice installed,
the browser silently substitutes its default (usually English) voice and
reads the text anyway — which is what produced badly mispronounced,
hard-to-understand audio for languages like Telugu on devices without a
Telugu voice pack. Generating the audio here means every farmer gets the
same real neural-quality voice for their language, regardless of device.

Known limitation: edge-tts is an unofficial wrapper around the same online
service Microsoft Edge's browser "Read aloud" feature uses. It needs no API
key and has no published rate limit, but it's not a documented/supported
public API — if Microsoft changes something on their end this could break
without warning. Low risk in practice (the project has been stable for
years), but worth knowing if this ever needs a hard reliability guarantee.
"""

import edge_tts
from app.utils.lang_detect import detect_lang_code

# One natural-sounding neural voice per language the app supports.
VOICE_MAP = {
    "en": "en-IN-NeerjaNeural",
    "hi": "hi-IN-SwaraNeural",
    "te": "te-IN-ShrutiNeural",
    "ta": "ta-IN-PallaviNeural",
    "kn": "kn-IN-SapnaNeural",
    "ml": "ml-IN-SobhanaNeural",
    "bn": "bn-IN-TanishaaNeural",
    "gu": "gu-IN-DhwaniNeural",
    "mr": "mr-IN-AarohiNeural",
    # Edge/Azure's neural voice set has no dedicated Punjabi voice at the
    # time of writing. Hindi is the closest available script/phonetic
    # match, so it's used instead of falling all the way back to English.
    "pa": "hi-IN-SwaraNeural",
}

_FALLBACK_VOICE = "en-IN-NeerjaNeural"


async def _generate(text: str, voice: str) -> bytes:
    communicate = edge_tts.Communicate(text, voice)
    chunks = bytearray()
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            chunks.extend(chunk["data"])
    return bytes(chunks)


async def synthesize_speech(text: str) -> bytes:
    """Generate MP3 audio for `text`, auto-picking the voice from the
    script it's written in. If that specific voice fails for any reason
    (e.g. Microsoft renames/retires it), retries once with the default
    English voice rather than failing the read-aloud request outright."""
    voice = VOICE_MAP.get(detect_lang_code(text), _FALLBACK_VOICE)

    try:
        audio = await _generate(text, voice)
        if not audio:
            raise RuntimeError("edge-tts returned empty audio")
        return audio
    except Exception:
        if voice == _FALLBACK_VOICE:
            raise
        return await _generate(text, _FALLBACK_VOICE)