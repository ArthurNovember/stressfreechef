// ── Shared timer utilities ──────────────────────────────────────────────────

export function clampInt(n, min, max) {
  if (Number.isNaN(n)) return min;
  return Math.min(max, Math.max(min, n));
}

// Converts total seconds to padded h/m/s parts (used in NewRecipe form)
export function secondsToParts(totalSeconds) {
  const total = clampInt(
    parseInt(totalSeconds || 0, 10),
    0,
    99 * 3600 + 59 * 60 + 59,
  );
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return {
    timerH: h ? String(h).padStart(2, "0") : "",
    timerM: m ? String(m).padStart(2, "0") : "",
    timerS: s ? String(s).padStart(2, "0") : "",
  };
}

// Converts h/m/s step fields back to total seconds (used in NewRecipe submit)
export function timerPartsToSeconds(step) {
  const hRaw = (step.timerH || "").trim();
  const mRaw = (step.timerM || "").trim();
  const sRaw = (step.timerS || "").trim();
  if (!hRaw && !mRaw && !sRaw) return 0;
  const h = clampInt(parseInt(hRaw || "0", 10), 0, 99);
  const m = clampInt(parseInt(mRaw || "0", 10), 0, 59);
  const s = clampInt(parseInt(sRaw || "0", 10), 0, 59);
  return h * 3600 + m * 60 + s;
}

// Normalises a timer input field string (used in NewRecipe onChange)
export function normalizeTimerField(val, max) {
  if (val === "") return "";
  const n = clampInt(parseInt(val, 10), 0, max);
  return String(n).padStart(2, "0");
}

// Parses timerSeconds from a recipe step object (used in Recipe page)
export function parseTimerSeconds(step) {
  const raw =
    typeof step?.timerSeconds === "number"
      ? step.timerSeconds
      : Number(step?.timerSeconds ?? 0);
  if (!raw || !Number.isFinite(raw) || raw <= 0) return null;
  return Math.floor(raw);
}

// Formats seconds as MM:SS display string (used in Recipe page timer)
export function formatTime(totalSeconds) {
  const safe = Math.max(0, Math.floor(totalSeconds || 0));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
