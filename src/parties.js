// src/parties.js
// API handlers for customers and suppliers (one table, "parties"). No SQL here (see db.js).
//
// Routes (all require login):
//   GET  /api/parties?q=&role=customer|supplier&archived=1   list
//   POST /api/parties                                        create
//   GET  /api/parties/:id                                    read one
//   PUT  /api/parties/:id                                    update
//   POST /api/parties/:id/active                             archive / restore { active }

import * as db from "./db.js";
import { json, fail, readJson } from "./http.js";
import { normalizeText, escapeLike } from "./util.js";

function shape(p) {
  return {
    id: p.id,
    name: p.name,
    is_customer: p.is_customer,
    is_supplier: p.is_supplier,
    phone: p.phone,
    national_id: p.national_id,
    address: p.address,
    note: p.note,
    active: p.active,
  };
}

function parseBody(body) {
  if (!body || typeof body !== "object") return { error: "bad_request" };

  const name = normalizeText(body.name);
  if (name.length < 1 || name.length > 100) return { error: "invalid_name" };

  const isCustomer = body.isCustomer === true ? 1 : 0;
  const isSupplier = body.isSupplier === true ? 1 : 0;
  if (!isCustomer && !isSupplier) return { error: "invalid_role" };

  const phone = normalizeText(body.phone || "");
  if (phone.length > 30 || !/^[0-9+\-() ]*$/.test(phone)) return { error: "invalid_phone" };

  const nationalId = normalizeText(body.nationalId || "");
  if (nationalId.length > 20) return { error: "invalid_national_id" };

  const address = normalizeText(body.address || "");
  if (address.length > 300) return { error: "invalid_address" };

  const note = normalizeText(body.note || "");
  if (note.length > 500) return { error: "invalid_note" };

  return { value: { name, isCustomer, isSupplier, phone, nationalId, address, note } };
}

async function listHandler(env, url) {
  const q = escapeLike(normalizeText(url.searchParams.get("q") || ""));
  const roleParam = url.searchParams.get("role") || "";
  const role = roleParam === "customer" || roleParam === "supplier" ? roleParam : "";
  const includeArchived = url.searchParams.get("archived") === "1";
  const rows = await db.listParties(env.DB, { q, role, includeArchived });
  return json({ ok: true, parties: rows.map(shape) });
}

async function createHandler(request, env) {
  const parsed = parseBody(await readJson(request));
  if (parsed.error) return fail(parsed.error, 400);
  const id = await db.insertParty(env.DB, { ...parsed.value, now: Date.now() });
  return json({ ok: true, party: shape(await db.getParty(env.DB, id)) });
}

async function updateHandler(request, env, id) {
  if (!(await db.getParty(env.DB, id))) return fail("not_found", 404);
  const parsed = parseBody(await readJson(request));
  if (parsed.error) return fail(parsed.error, 400);
  await db.updateParty(env.DB, id, { ...parsed.value, now: Date.now() });
  return json({ ok: true, party: shape(await db.getParty(env.DB, id)) });
}

async function activeHandler(request, env, id) {
  if (!(await db.getParty(env.DB, id))) return fail("not_found", 404);
  const body = await readJson(request);
  if (!body || typeof body.active !== "boolean") return fail("bad_request", 400);
  await db.setPartyActive(env.DB, id, body.active, Date.now());
  return json({ ok: true });
}

// Returns a Response if the path belongs to parties, otherwise null.
export async function handleParties(request, env, url) {
  const path = url.pathname;
  const method = request.method;

  if (path === "/api/parties") {
    if (method === "GET") return await listHandler(env, url);
    if (method === "POST") return await createHandler(request, env);
    return fail("method_not_allowed", 405);
  }

  const m = path.match(/^\/api\/parties\/(\d+)(\/active)?$/);
  if (!m) return null;
  const id = Number(m[1]);

  if (m[2]) {
    if (method === "POST") return await activeHandler(request, env, id);
    return fail("method_not_allowed", 405);
  }
  if (method === "GET") {
    const row = await db.getParty(env.DB, id);
    return row ? json({ ok: true, party: shape(row) }) : fail("not_found", 404);
  }
  if (method === "PUT") return await updateHandler(request, env, id);
  return fail("method_not_allowed", 405);
}
