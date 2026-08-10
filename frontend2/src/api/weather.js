import client from "./client";

export async function getCurrentWeather(lat, lng) {
    const { data } = await client.get("/weather/current", { params: { lat, lng } });
    return data;
}

export async function getFarmerWeather(username) {
    const { data } = await client.get(`/weather/farmer/${username}`);
    return data;
}

export async function getCurrentSeason() {
    const { data } = await client.get("/weather/season");
    return data;
}
