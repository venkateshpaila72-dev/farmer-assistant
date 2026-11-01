import client from "./client";

export async function getTrendingCropsAI(state) {
  const { data } = await client.get("/ai/suggest-trending", {
    params: { state },
    timeout: 120000,
  });
  return data;
}

export async function getCropAdvisory(username) {
  const { data } = await client.get(`/ai/advisory/${username}`, {
    timeout: 120000,
  });
  return data;
}

export async function getFarmingAdvice(question) {
  const { data } = await client.post(
    "/ai/advice",
    null,
    {
      params: { question },
      timeout: 120000,
    }
  );
  return data;
}
