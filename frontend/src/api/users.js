import client from "./client";

// GET /users/profile/{username} — read-only account info (phone, village,
// city, state, role, created_at). There's no update endpoint for these on
// the backend, only onboarding fields are editable — see api/onboarding.js.
export async function getFarmerProfile(username) {
  const { data } = await client.get(`/users/profile/${username}`);
  return data;
}