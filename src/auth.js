// src/auth.js
// Password hashing, tokens and cookie helpers. No database access here.

const enc = new TextEncoder();

// PBKDF2-SHA256 iterations for NEW passwords. 100000 is the maximum Cloudflare Workers allows.
// The value used is stored per user, so it can be changed later without breaking old passwords.
// If login fails with "exceeded CPU time" on the free plan, lower this number
// (and set the password again).
export const PBKDF2_ITERATIONS = 100000;

export const SESSION_DAYS = 30;
export const COOKIE_NAME = "__Host-session";

// Converts Persian (۰-۹) and Arabic-Indic (٠-٩) digits to English digits.
export function normalizeDigits(text) {
  return String(text)
    .replace(/[\u06F0-\u06F9]/g, (c) => String(c.charCodeAt(0) - 0x06f0))
    .replace(/[\u0660-\u0669]/g, (c) => String(c.charCodeAt(0) - 0x0660));
}

function toHex(bytes) {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function fromHex(hex) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
}

export function randomHex(byteCount) {
  return toHex(crypto.getRandomValues(new Uint8Array(byteCount)));
}

export async function sha256Hex(text) {
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(text));
  return toHex(new Uint8Array(digest));
}

export async function hashPassword(password, saltHex, iterations) {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: fromHex(saltHex), iterations },
    key,
    256
  );
  return toHex(new Uint8Array(bits));
}

// Constant-time string comparison.
export function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    out[part.slice(0, idx).trim()] = part.slice(idx + 1).trim();
  }
  return out;
}

export function sessionCookie(token) {
  const maxAge = SESSION_DAYS * 24 * 60 * 60;
  return `${COOKIE_NAME}=${token}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Strict`;
}

export function clearSessionCookie() {
  return `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`;
}
