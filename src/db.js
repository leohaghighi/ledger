// src/db.js
// The ONLY file that talks to the database. Plain standard SQL with "?" parameters.
// To move the backend to another host later, only this file needs a new implementation.
// Every function receives the D1 binding (env.DB) as its first argument.

export async function countUsers(db) {
  const row = await db.prepare("SELECT COUNT(*) AS n FROM users").first();
  return row ? row.n : 0;
}

// Creates the first (and only) user. Returns true if created, false if a user already exists.
export async function createFirstUser(db, u) {
  const res = await db
    .prepare(
      "INSERT INTO users (username, password_hash, password_salt, password_iterations, created_at) " +
        "SELECT ?, ?, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM users)"
    )
    .bind(u.username, u.hash, u.salt, u.iterations, u.now)
    .run();
  return res.meta.changes === 1;
}

export async function getUserByUsername(db, username) {
  return await db
    .prepare(
      "SELECT id, username, password_hash, password_salt, password_iterations FROM users WHERE username = ?"
    )
    .bind(username)
    .first();
}

export async function createSession(db, tokenHash, userId, now, expiresAt) {
  await db
    .prepare("INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)")
    .bind(tokenHash, userId, now, expiresAt)
    .run();
}

// Returns { user_id, username } or null if the session does not exist or has expired.
export async function getSessionUser(db, tokenHash, now) {
  return await db
    .prepare(
      "SELECT u.id AS user_id, u.username AS username FROM sessions s " +
        "JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?"
    )
    .bind(tokenHash, now)
    .first();
}

export async function deleteSession(db, tokenHash) {
  await db.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(tokenHash).run();
}

export async function deleteExpiredSessions(db, now) {
  await db.prepare("DELETE FROM sessions WHERE expires_at <= ?").bind(now).run();
}

export async function recordLoginFailure(db, ip, now) {
  await db.prepare("INSERT INTO login_attempts (ip, created_at) VALUES (?, ?)").bind(ip, now).run();
}

export async function countRecentLoginFailures(db, ip, since) {
  const row = await db
    .prepare("SELECT COUNT(*) AS n FROM login_attempts WHERE ip = ? AND created_at > ?")
    .bind(ip, since)
    .first();
  return row ? row.n : 0;
}

export async function clearLoginFailures(db, ip) {
  await db.prepare("DELETE FROM login_attempts WHERE ip = ?").bind(ip).run();
}

export async function deleteOldLoginFailures(db, before) {
  await db.prepare("DELETE FROM login_attempts WHERE created_at <= ?").bind(before).run();
}
