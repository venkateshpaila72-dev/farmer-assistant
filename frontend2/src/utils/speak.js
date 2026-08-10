import { synthesizeSpeech } from "../api/chat";

let currentAudio = null;

export async function speakText(text) {
    if (!text) return;
    try {
        if (currentAudio) {
            currentAudio.pause();
            currentAudio = null;
        }
        const blob = await synthesizeSpeech(text);
        const audioUrl = URL.createObjectURL(blob);
        currentAudio = new Audio(audioUrl);
        await currentAudio.play();
    } catch (error) {
        console.error("Speech synthesis failed:", error);
    }
}

export function stopSpeaking() {
    if (currentAudio) {
        currentAudio.pause();
        currentAudio = null;
    }
}
