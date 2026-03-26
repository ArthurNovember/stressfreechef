import { apiFetch } from "./client";

export async function getProfile() {
  const res = await apiFetch("/api/profile");
  if (!res.ok) throw new Error("Unauthorized");
  const data = await res.json();
  return data?.user ?? null;
}

export async function login(email, password) {
  const res = await apiFetch("/api/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Login error");
  return data;
}

export async function register(username, email, password) {
  const res = await apiFetch("/api/register", {
    method: "POST",
    body: JSON.stringify({ username, email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Registration error");
  return data;
}
