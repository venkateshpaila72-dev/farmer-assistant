"""
One-time translation of the disease-treatment dataset (34 classes) into
all 8 app languages, using Groq — the same LLM this project already has
API access to.

WHY THIS IS A SCRIPT, NOT LIVE TRANSLATION:
The 34 disease classes and their treatment/prevention/fertilizer text are
FIXED — they come from the trained ML model's class list, not from a live,
ever-changing source (unlike news, which genuinely needs live translation).
Translating this bounded dataset once and storing the result is strictly
better than translating on every request: no added latency for farmers,
no repeated API cost, and — critically — it creates a fixed artifact an
admin can actually review before it reaches real farmers, rather than raw
LLM output going straight to production untouched.

WHY YOU SHOULD REVIEW THE OUTPUT BEFORE TRUSTING IT:
This is agricultural treatment advice — fungicide names, dosages, methods.
A wrong translation here isn't a cosmetic bug, it could lead a farmer to
mistreat a real crop. The prompt below explicitly tells the model to leave
chemical/product names (e.g. "captan", "Potassium sulfate (SOP)") UNCHANGED
rather than translate them, since these are typically standardized names
without a meaningful local-language equivalent — but please still spot-check
a sample of the output (ideally with someone who reads the target language)
before wiring the localized file into production.

USAGE (run from the backend/ directory, needs GROQ_API_KEY set — this
can't be run from a sandboxed environment without outbound access to
api.groq.com, which is why this is a script for YOU to run, not something
already executed for you):
    python -m scripts.translate_disease_dataset

Produces: saved_models/disease_classes_i18n.json
Safe to re-run — always regenerates the full file from scratch.
Takes a while: 34 classes x 8 languages = 272 Groq calls.
"""

import json
import time
from pathlib import Path
from app.utils.groq_utils import groq_completion_with_rotation
from app.core.config import settings

BASE_DIR = Path(__file__).resolve().parent.parent
SOURCE_PATH = BASE_DIR / "saved_models" / "disease_classes.json"
OUTPUT_PATH = BASE_DIR / "saved_models" / "disease_classes_i18n.json"

LANGUAGES = {
    "hi": "Hindi",
    "te": "Telugu",
    "ta": "Tamil",
    "kn": "Kannada",
    "mr": "Marathi",
    "bn": "Bengali",
    "pa": "Punjabi",
}  # "en" isn't translated — the source file already IS English, used as-is


def translate_disease_entry(entry: dict, language_name: str) -> dict:
    """Translate one disease class's text fields into one language, via a
    single Groq call. Chemical/product names are explicitly preserved."""
    prompt = f"""Translate the following agricultural disease information into {language_name}, for a farmer-facing app. This is real advice a farmer may act on, so accuracy matters more than fluency.

Source (English):
{json.dumps(entry, ensure_ascii=False, indent=2)}

Rules:
- Translate: status (disease name), treatment, severity, prevention, fertilizer.method, fertilizer.note (if present), and each related_fertilizers[].reason.
- DO NOT translate chemical/product/fertilizer names themselves (e.g. "captan", "myclobutanil", "Potassium sulfate (SOP)", "10-26-26") — keep these exactly as written in English, since they're standardized names without a reliable local-language equivalent. Only translate the surrounding descriptive/instructional text.
- Keep the exact same JSON structure and keys as the source — only translate the text VALUES that this prompt says to translate.
- severity should be translated as a short word/phrase matching Low/Medium/High in meaning, in {language_name}.
- Return ONLY the translated JSON object — no markdown, no code fences, no commentary."""

    result = groq_completion_with_rotation(
        model=settings.GROQ_MODEL,
        messages=[{"role": "user", "content": prompt}],
        max_tokens=800,
        temperature=0.2
    )
    raw = (result.choices[0].message.content or "").strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()
    return json.loads(raw)


def main():
    with open(SOURCE_PATH, encoding="utf-8") as f:
        source = json.load(f)

    treatments = source["treatments"]
    total = len(treatments) * len(LANGUAGES)
    done = 0

    output = {lang_code: {} for lang_code in LANGUAGES}

    for disease_key, entry in treatments.items():
        for lang_code, lang_name in LANGUAGES.items():
            done += 1
            print(f"[{done}/{total}] Translating {disease_key} -> {lang_name}...")
            try:
                translated = translate_disease_entry(entry, lang_name)
                output[lang_code][disease_key] = translated
            except Exception as e:
                print(f"  ⚠️  Failed ({type(e).__name__}: {e}) — leaving this entry untranslated (English fallback)")
                output[lang_code][disease_key] = entry  # fall back to English rather than drop it entirely
            # Light pacing — avoids hammering the API needlessly across 272 calls.
            time.sleep(0.3)

    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"\nDone. Wrote {OUTPUT_PATH}")
    print("IMPORTANT: spot-check a sample of the translations (ideally with a native")
    print("speaker of the target language) before treating this as production-ready —")
    print("see the module docstring at the top of this script for why that matters.")


if __name__ == "__main__":
    main()