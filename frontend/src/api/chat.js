import client from "./client";

export async function getChatHistory(username, limit = 20) {
  const { data } = await client.get(`/chat/history/${username}`, {
    params: { limit },
  });
  return data;
}

export async function clearChatHistory(username) {
  const { data } = await client.delete(`/chat/history/${username}`);
  return data;
}