// src/util.js
// Text and number helpers for validating input.

import { normalizeDigits } from "./auth.js";

// Normalizes user text: English digits, Persian yeh/kaf, no tatweel/invisible marks,
// collapsed whitespace. (Zero-width non-joiner U+200C is kept: it is meaningful in Persian.)
export function normalizeText(value) {
  return normalizeDigits(String(value === null || value === undefined ? "" : value))
    .replace(/[\u064A\u0649]/g, "\u06CC")
    .replace(/\u0643/g, "\u06A9")
    .replace(/[\u0640\u200B\u200E\u200F]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Money amounts are non-negative integers (Toman). Returns null if invalid.
export function parseMoney(value) {
  if (value === null || value === undefined || value === "") return 0;
  const n =
    typeof value === "number"
      ? value
      : Number(normalizeDigits(String(value)).replace(/[,\u060C\u066C\s]/g, ""));
  if (!Number.isInteger(n) || n < 0 || n > 1e12) return null;
  return n;
}

// Escapes % _ \ for use in LIKE ... ESCAPE '\'
export function escapeLike(text) {
  return text.replace(/[\\%_]/g, (c) => "\\" + c);
}

export function isUniqueError(err) {
  return String((err && err.message) || err).includes("UNIQUE");
}
