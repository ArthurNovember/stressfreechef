// src/api.js
export const BASE = "https://stressfreecheff-backend.onrender.com";

function authHeaders() {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// CREATE (vždy jako private; public řešíme až po uploadu médií)
export async function createMyRecipe(payload) {
  const res = await fetch(`${BASE}/api/my-recipes`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ ...payload, isPublic: false }), // 🔒 vždy private
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// PUBLISH (přepnout private -> public => vznikne Community kopie s image)
export async function publishMyRecipe(recipeId) {
  const res = await fetch(`${BASE}/api/my-recipes/${recipeId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ isPublic: true }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// THUMBNAIL upload (uloží do UserRecipe.image)
export async function uploadRecipeMedia(recipeId, file) {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("recipeId", recipeId);
  const res = await fetch(`${BASE}/api/uploads/recipe-media`, {
    method: "POST",
    headers: { ...authHeaders() },
    body: fd,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// Smazání coveru
export async function deleteRecipeMedia(recipeId) {
  const res = await fetch(`${BASE}/api/uploads/recipe-media/${recipeId}`, {
    method: "DELETE",
    headers: { ...authHeaders() },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// Upload média ke kroku (uloží do UserRecipe.steps[stepIndex])
export async function uploadStepMedia(recipeId, stepIndex, file) {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("recipeId", recipeId);
  fd.append("stepIndex", String(stepIndex));
  const res = await fetch(`${BASE}/api/uploads/recipe-step-media`, {
    method: "POST",
    headers: { ...authHeaders() },
    body: fd,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// Smazání média ze kroku
export async function deleteStepMedia(recipeId, stepIndex) {
  const res = await fetch(
    `${BASE}/api/uploads/recipe-step-media/${recipeId}/${stepIndex}`,
    {
      method: "DELETE",
      headers: { ...authHeaders() },
    }
  );
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function deleteMyRecipe(recipeId) {
  const res = await fetch(`${BASE}/api/my-recipes/${recipeId}`, {
    method: "DELETE",
    headers: { ...authHeaders() },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json(); // { message: "Recept smazán." }
}
