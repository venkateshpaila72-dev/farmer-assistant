import client from "./client";

export async function getChatHistory(username, limit = 20) {
  const { data } = await client.get(`/chat/history/${username}`, {
    params: { limit },
  });
  return data;
}

export async function clearChatHistory(username) {
  const { data } = await client.delete(`/chat/history/${username}`);
  return data;
}

// Speech-to-text for the chat mic button — sends a recorded audio blob to
// the backend (Groq Whisper) and gets back the transcript + detected
// language. Used instead of the browser's native SpeechRecognition, which
// has inconsistent support for Indian languages across devices.
export async function transcribeAudio(audioBlob) {
  const form = new FormData();
  form.append("file", audioBlob, "voice.webm");
  const { data } = await client.post(`/chat/transcribe`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

// Text-to-speech for the chat's read-aloud button — sends reply text to the
// backend (edge-tts) and gets back real MP3 audio in a matching voice for
// whatever language the text is in, instead of relying on the browser's
// speechSynthesis (which depends on voices installed on the device).
export async function synthesizeSpeech(text) {
  const response = await client.post(
    `/chat/speak`,
    { text },
    { responseType: "blob" }
  );
  return response.data; // audio/mpeg Blob
}