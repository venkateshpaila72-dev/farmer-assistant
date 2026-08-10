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

export async function transcribeAudio(audioBlob) {
    const form = new FormData();
    form.append("file", audioBlob, "voice.webm");
    const { data } = await client.post(`/chat/transcribe`, form, {
        headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
}

export async function synthesizeSpeech(text) {
    const response = await client.post(
        `/chat/speak`,
        { text },
        { responseType: "blob" }
    );
    return response.data;
}
