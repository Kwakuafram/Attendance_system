// src/utils/ordinals.js

export function ordinal(n) {
  const x = Number(n);
  if (!Number.isFinite(x) || x <= 0) return "";
  const s = ["th", "st", "nd", "rd"];
  const v = x % 100;
  return x + (s[(v - 20) % 10] || s[v] || s[0]);
}
