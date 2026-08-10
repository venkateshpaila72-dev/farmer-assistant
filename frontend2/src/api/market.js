import client from "./client";

export async function getPrices({ state, commodity, district, limit = 50, skip = 0 }) {
    const { data } = await client.get("/market/prices", {
        params: { state, commodity, district, limit, skip },
    });
    return data;
}

export async function getFarmerPrices(username) {
    const { data } = await client.get(`/market/farmer/${username}`);
    return data;
}

export async function getTrendingCrops(state, limit = 5) {
    const { data } = await client.get("/market/trending", { params: { state, limit } });
    return data;
}

export async function getPriceTrend(state, commodity) {
    const { data } = await client.get("/market/trend", { params: { state, commodity } });
    return data;
}

export async function getAvailableStates() {
    const { data } = await client.get("/market/states");
    return data;
}

export async function uploadMarketDataset(file, uploadedBy = "admin") {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("uploaded_by", uploadedBy);
    const { data } = await client.post("/market/upload-dataset", formData, {
        headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
}

export async function getUploadStatus() {
    const { data } = await client.get("/market/upload-status");
    return data;
}

export async function addMarketPrice(data) {
    const { data: result } = await client.post("/market/add-price", data);
    return result;
}

export async function getMarketRecords({ state, limit = 20, skip = 0 } = {}) {
    const { data } = await client.get("/market/records", { params: { state, limit, skip } });
    return data;
}

export async function runMarketSync() {
    const { data } = await client.post("/agent/run-market-sync");
    return data;
}
