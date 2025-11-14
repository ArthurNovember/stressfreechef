// lib/api.ts

// Výchozí backend – pojede i kdyby build neviděl .env
const DEFAULT_API_BASE = "https://stressfreecheff-backend.onrender.com";

// V dev i v buildu se to přeloží na string nebo spadne na DEFAULT_API_BASE
const RAW =
  (typeof process !== "undefined" && process.env?.EXPO_PUBLIC_API_BASE) ||
  DEFAULT_API_BASE;

// Ořežeme koncové lomítko, aby se dobře skládaly URL
export const API_BASE = String(RAW || "").replace(/\/+$/, "");

export async function fetchJSON<T>(
  url: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
