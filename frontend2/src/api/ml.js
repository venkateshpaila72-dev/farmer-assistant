import client from "./client";

export async function recommendCrop(username, soilType) {
    const payload = { username };
    if (soilType) payload.soil_type = soilType;
    const { data } = await client.post("/ml/recommend-crop", payload);
    return data;
}

export async function recommendFertilizer(username, cropType) {
    const { data } = await client.post("/ml/recommend-fertilizer", { username, crop_type: cropType });
    return data;
}

export async function getFertilizerTypes() {
    const { data } = await client.get("/ml/fertilizer-types");
    return data;
}

export async function predictYield({ username, crop, season, year, area_hectares, rainfall }) {
    const { data } = await client.post("/ml/predict-yield", {
        username, crop, season, year, area_hectares, rainfall,
    });
    return data;
}

export async function getYieldOptions() {
    const { data } = await client.get("/ml/yield-options");
    return data;
}
