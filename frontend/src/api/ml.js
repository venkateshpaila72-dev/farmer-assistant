import client from "./client";

// Crop recommendation is auto-loaded from the farmer's profile + live
// weather — normally the frontend only sends username. An optional
// soilType override lets a caller preview a recommendation for a
// just-detected soil photo without that soil having been saved to the
// profile (see the Soil tab in vision).
export async function recommendCrop(username, soilType) {
  const payload = { username };
  if (soilType) payload.soil_type = soilType;
  const { data } = await client.post("/ml/recommend-crop", payload, { timeout: 120000 });
  return data;
}

export async function recommendFertilizer(username, cropType) {
  const { data } = await client.post("/ml/recommend-fertilizer", { username, crop_type: cropType }, { timeout: 120000 });
  return data;
}

export async function getFertilizerTypes() {
  const { data } = await client.get("/ml/fertilizer-types", { timeout: 120000 });
  return data; // { soil_types: [...], crop_types: [...] }
}

export async function predictYield({ username, crop, season, year, area_hectares, rainfall }) {
  const { data } = await client.post("/ml/predict-yield", {
    username, crop, season, year, area_hectares, rainfall,
  }, { timeout: 120000 });
  return data;
}

export async function getYieldOptions() {
  const { data } = await client.get("/ml/yield-options", { timeout: 120000 });
  return data; // { crops: [...], seasons: [...], states: [...] }
}