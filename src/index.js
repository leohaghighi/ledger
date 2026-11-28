// src/index.js
// Entry point of the Worker. Only /api/* requests reach this code
// (see "run_worker_first" in wrangler.jsonc). Static files are served automatically.

import * as db from "./db.js";
import { json, fail, readJson } from "./http.js";
import { handleProducts } from "./products.js";
import {
  PBKDF2_ITERATIONS,
  SESSION_DAYS,
  COOKIE_NAME,
  normalizeDigits,
  randomHex,
  sha256Hex,
  hashPassword,
  safeEqual,
  parseCookies,
  sessionCookie,
  clearSessionCookie,
} from "./auth.js";

const MAX_FAILURES = 10; // failed attempts allowed per IP...
const FAILURE_WINDOW_MS = 15 * 60 * 1000; // ...within 15 minutes

function clientIp(request) {
  return request.headers.get("cf-connecting-ip") || "unknown";
}

// Returns { user_id, username, tokenHash } for a valid session, otherwise null.
async function getCurrentUser(request, env) {
  const token = parseCookies(request.headers.get("cookie"))[COOKIE_NAME];
  if (!token || !/^[0-9a-f]{64}$/.test(token)) return null;
  const tokenHash = await sha256Hex(token);
  const row = await db.getSessionUser(env.DB, tokenHash, Date.now());
  return row ? { user_id: row.user_id, username: row.username, tokenHash } : null;
}

async function startSession(env, userId) {
  const token = randomHex(32);
  const now = Date.now();
  await db.createSession(
    env.DB,
    await sha256Hex(token),
    userId,
    now,
    now + SESSION_DAYS * 24 * 60 * 60 * 1000
  );
  return token;
}

async function handleSetup(request, env) {
  if (!env.SETUP_CODE) return fail("setup_code_not_configured", 503);
  if ((await db.countUsers(env.DB)) > 0) return fail("already_setup", 409);

  const ip = clientIp(request);
  const now = Date.now();
  if ((await db.countRecentLoginFailures(env.DB, ip, now - FAILURE_WINDOW_MS)) >= MAX_FAILURES) {
    return fail("too_many_attempts", 429);
  }

  const body = await readJson(request);
  if (!body) return fail("bad_request", 400);

  const codeOk = safeEqual(
    await sha256Hex(normalizeDigits(String(body.setupCode || "")).trim()),
    await sha256Hex(normalizeDigits(String(env.SETUP_CODE)).trim())
  );
  if (!codeOk) {
    await db.recordLoginFailure(env.DB, ip, now);
    return fail("bad_setup_code", 403);
  }

  const username = normalizeDigits(String(body.username || "")).trim().toLowerCase();
  const password = normalizeDigits(String(body.password || ""));
  if (username.length < 3 || username.length > 40) return fail("invalid_username", 400);
  if (password.length < 8 || password.length > 200) return fail("weak_password", 400);

  const salt = randomHex(16);
  const hash = await hashPassword(password, salt, PBKDF2_ITERATIONS);
  const created = await db.createFirstUser(env.DB, {
    username,
    hash,
    salt,
    iterations: PBKDF2_ITERATIONS,
    now,
  });
  if (!created) return fail("already_setup", 409);

  const user = await db.getUserByUsername(env.DB, username);
  const token = await startSession(env, user.id);
  return json({ ok: true }, 200, { "set-cookie": sessionCookie(token) });
}

async function handleLogin(request, env) {
  const ip = clientIp(request);
  const now = Date.now();
  if ((await db.countRecentLoginFailures(env.DB, ip, now - FAILURE_WINDOW_MS)) >= MAX_FAILURES) {
    return fail("too_many_attempts", 429);
  }

  const body = await readJson(request);
  if (!body) return fail("bad_request", 400);

  const username = normalizeDigits(String(body.username || "")).trim().toLowerCase();
  const password = normalizeDigits(String(body.password || ""));
  if (!username || !password || password.length > 200) return fail("invalid_credentials", 401);

  const user = await db.getUserByUsername(env.DB, username);
  // Hash even when the user does not exist, so timing does not reveal valid usernames.
  const hash = await hashPassword(
    password,
    user ? user.password_salt : "00000000000000000000000000000000",
    user ? user.password_iterations : PBKDF2_ITERATIONS
  );

  if (!user || !safeEqual(hash, user.password_hash)) {
    await db.recordLoginFailure(env.DB, ip, now);
    return fail("invalid_credentials", 401);
  }

  await db.clearLoginFailures(env.DB, ip);
  // Light housekeeping of old rows.
  await db.deleteExpiredSessions(env.DB, now);
  await db.deleteOldLoginFailures(env.DB, now - FAILURE_WINDOW_MS);

  const token = await startSession(env, user.id);
  return json({ ok: true }, 200, { "set-cookie": sessionCookie(token) });
}

async function handleLogout(request, env) {
  const me = await getCurrentUser(request, env);
  if (me) await db.deleteSession(env.DB, me.tokenHash);
  return json({ ok: true }, 200, { "set-cookie": clearSessionCookie() });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // Basic CSRF protection: state-changing requests must come from our own origin.
    if (method !== "GET" && method !== "HEAD") {
      const origin = request.headers.get("origin");
      if (origin && origin !== url.origin) return fail("forbidden", 403);
    }

    try {
      // ---- Public routes ----
      if (path === "/api/health" && method === "GET") {
        const row = await env.DB.prepare("SELECT 1 AS ok").first();
        return json({ ok: true, db: !!row && row.ok === 1 });
      }
      if (path === "/api/setup-status" && method === "GET") {
        return json({ ok: true, needsSetup: (await db.countUsers(env.DB)) === 0 });
      }
      if (path === "/api/setup" && method === "POST") return await handleSetup(request, env);
      if (path === "/api/login" && method === "POST") return await handleLogin(request, env);
      if (path === "/api/logout" && method === "POST") return await handleLogout(request, env);

      // ---- Everything below requires a logged-in user ----
      const me = await getCurrentUser(request, env);
      if (!me) return fail("not_logged_in", 401);

      if (path === "/api/me" && method === "GET") {
        return json({ ok: true, user: { username: me.username } });
      }

      if (path.startsWith("/api/products")) {
        const res = await handleProducts(request, env, url);
        if (res) return res;
      }

      return fail("not_found", 404);
    } catch (err) {
      return fail("server_error", 500);
    }
  },
};
