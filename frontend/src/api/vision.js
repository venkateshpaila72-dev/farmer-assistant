import client from "./client";
import i18n from "../i18n";

export async function classifySoil(username, file, updateProfile = true, logToChat = false) {
  const form = new FormData();
  form.append("file", file);
  const { data } = await client.post(
    `/vision/classify-soil?username=${encodeURIComponent(username)}&update_profile=${updateProfile}&log_to_chat=${logToChat}`,
    form,
    { headers: { "Content-Type": "multipart/form-data" } }
  );
  return data;
}

// Sends the farmer's currently-selected site language so the backend can
// return treatment/prevention/fertilizer text in that language when a
// translated version of the disease dataset is available (see
// backend/scripts/translate_disease_dataset.py) — falls back to English
// automatically on the backend if no translation exists for that class/
// language yet, so this is always safe to send.
export async function detectDisease(username, file, logToChat = false) {
  const form = new FormData();
  form.append("file", file);
  const { data } = await client.post(
    `/vision/detect-disease?username=${encodeURIComponent(username)}&log_to_chat=${logToChat}&lang=${i18n.language || "en"}`,
    form,
    { headers: { "Content-Type": "multipart/form-data" } }
  );
  return data;
}

export async function getDiseaseHistory(username, limit = 10) {
  const { data } = await client.get(`/vision/disease-history/${username}`, { params: { limit } });
  return data;
}