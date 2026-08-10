import client from "./client";

export async function getNewsFeed({ state, maxResults = 10 } = {}) {
    const { data } = await client.get("/news/feed", {
        params: { state, max_results: maxResults },
    });
    return data;
}

export async function getFarmerNews(username) {
    const { data } = await client.get(`/news/farmer/${username}`);
    return data;
}

export async function getPestAlerts(state) {
    const { data } = await client.get("/news/alerts", { params: { state } });
    return data;
}

export async function getSchemeNews(state) {
    const { data } = await client.get("/news/schemes", { params: { state } });
    return data;
}

export async function getPublicAnnouncements() {
    const { data } = await client.get("/admins/announcements");
    return data;
}
