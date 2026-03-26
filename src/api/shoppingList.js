import { apiFetch } from "./client";

export async function getShoppingList() {
  const res = await apiFetch("/api/shopping-list");
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function addShoppingItem(item) {
  const res = await apiFetch("/api/shopping-list", {
    method: "POST",
    body: JSON.stringify(item),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function updateShoppingItem(itemId, updates) {
  const res = await apiFetch(`/api/shopping-list/${itemId}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function deleteShoppingItem(itemId) {
  const res = await apiFetch(`/api/shopping-list/${itemId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getShopOptions() {
  const res = await apiFetch("/api/shopping-list/shop-options");
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function addShopOption(name) {
  const res = await apiFetch("/api/shopping-list/shop-options", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function deleteShopOption(shopId) {
  const res = await apiFetch(`/api/shopping-list/shop-options/${shopId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(await res.text());
}

export async function getItemSuggestions() {
  const res = await apiFetch("/api/item-suggestions");
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
