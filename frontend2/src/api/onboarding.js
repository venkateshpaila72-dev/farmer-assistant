import client from "./client";

export async function saveOnboarding(payload) {
    const { data } = await client.post("/onboarding/save", payload);
    return data;
}

export async function getOnboardingProfile(username) {
    const { data } = await client.get(`/onboarding/profile/${username}`);
    return data;
}

export async function getOnboardingStatus(username) {
    const { data } = await client.get(`/users/onboarding-status/${username}`);
    return data;
}
