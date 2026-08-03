import client from "./client";

// Backend mounts this router at /admins (plural) — see main.py:
// app.include_router(admin.router, prefix="/admins", tags=["Admin"])

export async function getAllFarmers() {
  const { data } = await client.get("/admins/all-farmers");
  return data;
}

export async function getAnalytics() {
  const { data } = await client.get("/admins/analytics");
  return data;
}

export async function getAnnouncements() {
  const { data } = await client.get("/admins/announcements");
  return data;
}

// Multipart, not JSON — the image is optional, so this is always a
// FormData post even when no image is attached (backend expects Form
// fields + an optional UploadFile, not a JSON body).
export async function postAnnouncement({ title, content, posted_by, imageFile }) {
  const formData = new FormData();
  formData.append("title", title);
  formData.append("content", content);
  formData.append("posted_by", posted_by);
  if (imageFile) formData.append("image", imageFile);

  const { data } = await client.post("/admins/announcement", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

// New image is optional here too — omitting it keeps whatever image the
// announcement already had (see PUT /admins/announcement/{id} on the backend).
export async function editAnnouncement(id, { title, content, imageFile }) {
  const formData = new FormData();
  formData.append("title", title);
  formData.append("content", content);
  if (imageFile) formData.append("image", imageFile);

  const { data } = await client.put(`/admins/announcement/${id}`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}