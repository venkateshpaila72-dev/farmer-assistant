import os, sys, uuid, requests, tempfile
from dotenv import load_dotenv

import pygame
from gtts import gTTS

pygame.mixer.init()

load_dotenv()

KEY      = os.getenv("AZURE_TRANSLATOR_KEY")
REGION   = os.getenv("AZURE_TRANSLATOR_REGION")
ENDPOINT = (os.getenv("AZURE_TRANSLATOR_ENDPOINT") or "https://api.cognitive.microsofttranslator.com").rstrip("/")

missing = [n for n, v in [("AZURE_TRANSLATOR_KEY", KEY), ("AZURE_TRANSLATOR_REGION", REGION)] if not v]
if missing:
    sys.exit(f"Missing in .env: {', '.join(missing)}")

print("--- Azure Translator ---")
while True:
    print("\nAvailable languages: hi, te, ta, kn, mr, bn, pa, es, fr, etc.")
    target_lang = input("Enter target language code (e.g. 'hi') or 'q' to quit: ").strip()
    
    if target_lang.lower() == 'q':
        print("Exiting...")
        break
        
    if not target_lang:
        print("Language code cannot be empty.")
        continue
        
    text = input("Enter the sentence to translate: ").strip()
    if not text:
        print("Sentence cannot be empty.")
        continue
        
    print(f"Translating...")
    
    try:
        r = requests.post(
            f"{ENDPOINT}/translate",
            params={"api-version": "3.0", "to": target_lang.split(",")},
            headers={
                "Ocp-Apim-Subscription-Key": KEY,
                "Ocp-Apim-Subscription-Region": REGION,
                "Content-Type": "application/json",
                "X-ClientTraceId": str(uuid.uuid4()),
            },
            json=[{"text": text}],
            timeout=20,
        )

        if r.status_code != 200:
            print(f"FAILED {r.status_code}: {r.text}")
        else:
            for t in r.json()[0].get("translations", []):
                out_lang = t['to']
                out_text = t['text']
                print(f"[{out_lang}]: {out_text}")
                
                try:
                    tts = gTTS(text=out_text, lang=out_lang)
                    with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3") as f:
                        tmp_name = f.name
                        
                    tts.save(tmp_name)
                    pygame.mixer.music.load(tmp_name)
                    pygame.mixer.music.play()
                    
                    while pygame.mixer.music.get_busy():
                        pygame.time.Clock().tick(10)
                        
                    pygame.mixer.music.unload()
                    try:
                        os.remove(tmp_name)
                    except OSError:
                        pass
                except Exception as tts_e:
                    print(f"Audio Error: {tts_e}")
    except Exception as e:
        print(f"Error: {e}")