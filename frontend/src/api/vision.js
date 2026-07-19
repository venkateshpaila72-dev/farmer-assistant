import client from "./client";

export async function classifySoil(username, file, updateProfile = true) {
  const form = new FormData();
  form.append("file", file);
  const { data } = await client.post(
    `/vision/classify-soil?username=${encodeURIComponent(username)}&update_profile=${updateProfile}`,
    form,
    { headers: { "Content-Type": "multipart/form-data" } }
  );
  return data;
}

export async function detectDisease(username, file) {
  const form = new FormData();
  form.append("file", file);
  const { data } = await client.post(
    `/vision/detect-disease?username=${encodeURIComponent(username)}`,
    form,
    { headers: { "Content-Type": "multipart/form-data" } }
  );
  return data;
}

export async function getDiseaseHistory(username, limit = 10) {
  const { data } = await client.get(`/vision/disease-history/${username}`, { params: { limit } });
  return data;
}