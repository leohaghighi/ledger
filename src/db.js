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

// ---------------------------------------------------------------------------
// Products and variants
// ---------------------------------------------------------------------------

const PRODUCT_COLUMNS =
  "id, name, kind, unit, default_sale_price, default_purchase_price, note, active";

export async function insertProduct(db, p) {
  const res = await db
    .prepare(
      "INSERT INTO products (name, kind, unit, default_sale_price, default_purchase_price, note, active, created_at, updated_at) " +
        "VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)"
    )
    .bind(p.name, p.kind, p.unit, p.salePrice, p.purchasePrice, p.note, p.now, p.now)
    .run();
  return res.meta.last_row_id;
}

export async function updateProduct(db, id, p) {
  await db
    .prepare(
      "UPDATE products SET name = ?, kind = ?, unit = ?, default_sale_price = ?, " +
        "default_purchase_price = ?, note = ?, updated_at = ? WHERE id = ?"
    )
    .bind(p.name, p.kind, p.unit, p.salePrice, p.purchasePrice, p.note, p.now, id)
    .run();
}

export async function setProductActive(db, id, active, now) {
  await db
    .prepare("UPDATE products SET active = ?, updated_at = ? WHERE id = ?")
    .bind(active ? 1 : 0, now, id)
    .run();
}

export async function getProduct(db, id) {
  return await db
    .prepare("SELECT " + PRODUCT_COLUMNS + " FROM products WHERE id = ?")
    .bind(id)
    .first();
}

// filters: { q, kind, includeArchived }. "q" must already be LIKE-escaped.
export async function listProducts(db, filters) {
  const where = [];
  const args = [];
  if (!filters.includeArchived) where.push("active = 1");
  if (filters.kind) {
    where.push("kind = ?");
    args.push(filters.kind);
  }
  if (filters.q) {
    where.push("name LIKE ? ESCAPE '\\'");
    args.push("%" + filters.q + "%");
  }
  const sql =
    "SELECT " +
    PRODUCT_COLUMNS +
    " FROM products" +
    (where.length ? " WHERE " + where.join(" AND ") : "") +
    " ORDER BY name";
  const res = await db.prepare(sql).bind(...args).all();
  return res.results;
}

// All variants (optionally only those of active products), for grouping in code.
export async function listVariants(db, includeArchivedProducts) {
  const sql =
    "SELECT v.id AS id, v.product_id AS product_id, v.name AS name, v.active AS active " +
    "FROM variants v JOIN products p ON p.id = v.product_id" +
    (includeArchivedProducts ? "" : " WHERE p.active = 1") +
    " ORDER BY v.id";
  const res = await db.prepare(sql).all();
  return res.results;
}

export async function getVariantsOfProduct(db, productId) {
  const res = await db
    .prepare("SELECT id, product_id, name, active FROM variants WHERE product_id = ? ORDER BY id")
    .bind(productId)
    .all();
  return res.results;
}

export async function insertVariant(db, productId, name, active, now) {
  await db
    .prepare("INSERT INTO variants (product_id, name, active, created_at) VALUES (?, ?, ?, ?)")
    .bind(productId, name, active ? 1 : 0, now)
    .run();
}

export async function updateVariant(db, id, name, active) {
  await db
    .prepare("UPDATE variants SET name = ?, active = ? WHERE id = ?")
    .bind(name, active ? 1 : 0, id)
    .run();
}

export async function setVariantActive(db, id, active) {
  await db.prepare("UPDATE variants SET active = ? WHERE id = ?").bind(active ? 1 : 0, id).run();
}
