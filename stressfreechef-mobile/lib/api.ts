const DEFAULT_API_BASE = "https://stressfreecheff-backend.onrender.com";

const RAW =
  (typeof process !== "undefined" && process.env?.EXPO_PUBLIC_API_BASE) ||
  DEFAULT_API_BASE;

export const API_BASE = String(RAW || "").replace(/\/+$/, "");

export async function fetchJSON<T>(
  url: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
