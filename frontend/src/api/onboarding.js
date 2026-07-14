import client from "./client";

// POST /onboarding/save (requires auth, username must match logged-in user)
export async function saveOnboarding(payload) {
  const { data } = await client.post("/onboarding/save", payload);
  return data;
}

// GET /onboarding/profile/{username}
export async function getOnboardingProfile(username) {
  const { data } = await client.get(`/onboarding/profile/${username}`);
  return data;
}

// GET /users/onboarding-status/{username} -> {username, onboarding_complete}
export async function getOnboardingStatus(username) {
  const { data } = await client.get(`/users/onboarding-status/${username}`);
  return data;
}