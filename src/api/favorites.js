import { apiFetch } from "./client";

export async function getFavorites() {
  const res = await apiFetch("/api/favorites");
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function addFavorite(item) {
  const res = await apiFetch("/api/favorites", {
    method: "POST",
    body: JSON.stringify(item),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function updateFavorite(itemId, updates) {
  const res = await apiFetch(`/api/favorites/${itemId}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function deleteFavorite(itemId) {
  const res = await apiFetch(`/api/favorites/${itemId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
