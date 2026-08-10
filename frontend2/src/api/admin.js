import client from "./client";

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

export async function postAnnouncement({ title, content, posted_by, benefit, eligibility, where_to_apply, official_link, scheme_status, imageFile }) {
    const formData = new FormData();
    formData.append("title", title);
    formData.append("content", content);
    formData.append("posted_by", posted_by);
    formData.append("benefit", benefit || "");
    formData.append("eligibility", eligibility || "");
    formData.append("where_to_apply", where_to_apply || "");
    formData.append("official_link", official_link || "");
    formData.append("scheme_status", scheme_status || "active");
    if (imageFile) formData.append("image", imageFile);

    const { data } = await client.post("/admins/announcement", formData, {
        headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
}

export async function editAnnouncement(id, { title, content, benefit, eligibility, where_to_apply, official_link, scheme_status, imageFile }) {
    const formData = new FormData();
    formData.append("title", title);
    formData.append("content", content);
    formData.append("benefit", benefit || "");
    formData.append("eligibility", eligibility || "");
    formData.append("where_to_apply", where_to_apply || "");
    formData.append("official_link", official_link || "");
    formData.append("scheme_status", scheme_status || "active");
    if (imageFile) formData.append("image", imageFile);

    const { data } = await client.put(`/admins/announcement/${id}`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
}

export async function draftAnnouncementFromNews({ title, source_text, url }) {
    const { data } = await client.post("/admins/announcement/draft-from-news", {
        title,
        source_text: source_text || "",
        url: url || "",
    });
    return data;
}
