import client from "./client";

export async function getPrices({ state, commodity, district, limit = 50 }) {
  const { data } = await client.get("/market/prices", {
    params: { state, commodity, district, limit },
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