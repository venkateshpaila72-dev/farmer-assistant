import client from "./client";

// POST /auth/verifyuser {username, password} -> {access_token, token_type, role, username}
export async function loginFarmer(username, password) {
  const { data } = await client.post("/auth/verifyuser", { username, password });
  return data;
}

// POST /auth/verifyadmin {email, password} -> {access_token, token_type, role, username}
export async function loginAdmin(email, password) {
  const { data } = await client.post("/auth/verifyadmin", { email, password });
  return data;
}

// GET /users/verifynewuser/{username} -> {available, message}
export async function checkUsernameAvailable(username) {
  const { data } = await client.get(`/users/verifynewuser/${username}`);
  return data;
}

// POST /users/addnewuser {username, password, phone, door_no, village, city, state}
export async function registerFarmer(payload) {
  const { data } = await client.post("/users/addnewuser", payload);
  return data;
}