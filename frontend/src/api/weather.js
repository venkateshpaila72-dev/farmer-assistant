import client from "./client";

/**
 * Public live weather + 5-day forecast + farming alerts for any lat/lng.
 * Backed by GET /weather/current — no auth required, used on the landing page.
 */
export async function getCurrentWeather(lat, lng) {
  const { data } = await client.get("/weather/current", { params: { lat, lng } });
  return data;
}

/**
 * Weather for a logged-in farmer's saved location (home or current, whichever
 * is active). Backed by GET /weather/farmer/{username} — requires auth.
 */
export async function getFarmerWeather(username) {
  const { data } = await client.get(`/weather/farmer/${username}`);
  return data;
}

/** Current Indian farming season (Kharif / Rabi / Zaid) — GET /weather/season. */
export async function getCurrentSeason() {
  const { data } = await client.get("/weather/season");
  return data;
}