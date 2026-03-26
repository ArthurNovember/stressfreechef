export const API_BASE = String(
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE) ||
    "https://stressfreecheff-backend.onrender.com",
).replace(/\/+$/, "");

export function getToken() {
  return localStorage.getItem("token");
}

export function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function apiFetch(path, options = {}) {
  const isFormData = options.body instanceof FormData;
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...authHeaders(),
      ...(!isFormData ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  return res;
}
