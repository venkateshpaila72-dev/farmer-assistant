import client from "./client";

export async function loginFarmer(username, password) {
    const { data } = await client.post("/auth/verifyuser", { username, password });
    return data;
}

export async function loginAdmin(email, password) {
    const { data } = await client.post("/auth/verifyadmin", { email, password });
    return data;
}

export async function checkUsernameAvailable(username) {
    const { data } = await client.get(`/users/verifynewuser/${username}`);
    return data;
}

export async function registerFarmer(payload) {
    const { data } = await client.post("/users/addnewuser", payload);
    return data;
}
