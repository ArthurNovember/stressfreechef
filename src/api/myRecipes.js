import { apiFetch } from "./client";

export async function createMyRecipe(payload) {
  const res = await apiFetch("/api/my-recipes", {
    method: "POST",
    body: JSON.stringify({ ...payload, isPublic: false }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function updateMyRecipe(recipeId, payload) {
  const res = await apiFetch(`/api/my-recipes/${recipeId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function publishMyRecipe(recipeId) {
  const res = await apiFetch(`/api/my-recipes/${recipeId}`, {
    method: "PATCH",
    body: JSON.stringify({ isPublic: true }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function deleteMyRecipe(recipeId) {
  const res = await apiFetch(`/api/my-recipes/${recipeId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function uploadRecipeMedia(recipeId, file) {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("recipeId", recipeId);
  const res = await apiFetch("/api/uploads/recipe-media", {
    method: "POST",
    body: fd,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function deleteRecipeMedia(recipeId) {
  const res = await apiFetch(`/api/uploads/recipe-media/${recipeId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function uploadStepMedia(recipeId, stepIndex, file) {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("recipeId", recipeId);
  fd.append("stepIndex", String(stepIndex));
  const res = await apiFetch("/api/uploads/recipe-step-media", {
    method: "POST",
    body: fd,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function deleteStepMedia(recipeId, stepIndex) {
  const res = await apiFetch(
    `/api/uploads/recipe-step-media/${recipeId}/${stepIndex}`,
    { method: "DELETE" },
  );
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
