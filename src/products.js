// src/products.js
// API handlers for products and their variants. No SQL here (see db.js).
//
// Routes (all require login):
//   GET  /api/products?q=&kind=&archived=1   list
//   POST /api/products                       create
//   GET  /api/products/:id                   read one
//   PUT  /api/products/:id                   update
//   POST /api/products/:id/active            archive / restore  { active: true|false }
//
// Variants: every product has at least one variant. If a product has no real (named)
// active variants, it has one default variant with an empty name.

import * as db from "./db.js";
import { json, fail, readJson } from "./http.js";
import { normalizeText, parseMoney, escapeLike, isUniqueError } from "./util.js";

const KINDS = ["raw", "finished"];

function shapeProduct(p, variants) {
  return {
    id: p.id,
    name: p.name,
    kind: p.kind,
    unit: p.unit,
    default_sale_price: p.default_sale_price,
    default_purchase_price: p.default_purchase_price,
    note: p.note,
    active: p.active,
    variants: variants.map((v) => ({ id: v.id, name: v.name, active: v.active })),
  };
}

function parseBody(body) {
  if (!body || typeof body !== "object") return { error: "bad_request" };

  const name = normalizeText(body.name);
  if (name.length < 1 || name.length > 100) return { error: "invalid_name" };
  if (!KINDS.includes(body.kind)) return { error: "invalid_kind" };

  const unit = normalizeText(body.unit || "عدد");
  if (unit.length < 1 || unit.length > 20) return { error: "invalid_unit" };

  const salePrice = parseMoney(body.defaultSalePrice);
  const purchasePrice = parseMoney(body.defaultPurchasePrice);
  if (salePrice === null || purchasePrice === null) return { error: "invalid_price" };

  const note = normalizeText(body.note || "");
  if (note.length > 500) return { error: "invalid_note" };

  const rawVariants = Array.isArray(body.variants) ? body.variants : [];
  if (rawVariants.length > 50) return { error: "too_many_variants" };
  const variants = [];
  for (const v of rawVariants) {
    if (!v || typeof v !== "object") return { error: "invalid_variant" };
    const vname = normalizeText(v.name);
    if (vname.length < 1 || vname.length > 60) return { error: "invalid_variant" };
    variants.push({
      id: Number.isInteger(v.id) ? v.id : null,
      name: vname,
      active: v.active !== false,
    });
  }

  return { value: { name, kind: body.kind, unit, salePrice, purchasePrice, note, variants } };
}

// Checks the variant list against what is already stored. No writes.
function planVariants(existing, payload) {
  const byId = new Map(existing.map((v) => [v.id, v]));
  for (const v of payload) {
    if (v.id !== null) {
      const e = byId.get(v.id);
      if (!e || e.name === "") return { error: "invalid_variant" };
    }
  }
  const final = new Map(); // key -> { name, active }
  for (const e of existing) {
    if (e.name !== "") final.set(e.id, { name: e.name, active: !!e.active });
  }
  payload.forEach((v, i) => {
    final.set(v.id !== null ? v.id : "new" + i, { name: v.name, active: v.active });
  });
  const names = Array.from(final.values()).map((v) => v.name);
  if (new Set(names).size !== names.length) return { error: "duplicate_variant" };
  const namedActive = Array.from(final.values()).filter((v) => v.active).length;
  return { namedActive };
}

// Writes the variant changes. Call planVariants first.
async function applyVariants(dbh, productId, existing, payload, namedActive, now) {
  for (const v of payload) {
    if (v.id !== null) await db.updateVariant(dbh, v.id, v.name, v.active);
    else await db.insertVariant(dbh, productId, v.name, v.active, now);
  }
  const defaultVariant = existing.find((e) => e.name === "");
  if (defaultVariant) {
    const shouldBeActive = namedActive === 0;
    if (!!defaultVariant.active !== shouldBeActive) {
      await db.setVariantActive(dbh, defaultVariant.id, shouldBeActive);
    }
  } else if (namedActive === 0) {
    await db.insertVariant(dbh, productId, "", true, now);
  }
}

async function loadFull(env, id) {
  const p = await db.getProduct(env.DB, id);
  if (!p) return null;
  const variants = await db.getVariantsOfProduct(env.DB, id);
  return shapeProduct(p, variants);
}

async function listHandler(env, url) {
  const q = escapeLike(normalizeText(url.searchParams.get("q") || ""));
  const kindParam = url.searchParams.get("kind") || "";
  const kind = KINDS.includes(kindParam) ? kindParam : "";
  const includeArchived = url.searchParams.get("archived") === "1";

  const products = await db.listProducts(env.DB, { q, kind, includeArchived });
  const variants = await db.listVariants(env.DB, includeArchived);
  const byProduct = new Map();
  for (const v of variants) {
    if (!byProduct.has(v.product_id)) byProduct.set(v.product_id, []);
    byProduct.get(v.product_id).push(v);
  }
  return json({
    ok: true,
    products: products.map((p) => shapeProduct(p, byProduct.get(p.id) || [])),
  });
}

async function createHandler(request, env) {
  const parsed = parseBody(await readJson(request));
  if (parsed.error) return fail(parsed.error, 400);
  const p = parsed.value;

  const plan = planVariants([], p.variants);
  if (plan.error) return fail(plan.error, 400);

  const now = Date.now();
  let productId;
  try {
    productId = await db.insertProduct(env.DB, { ...p, now });
  } catch (err) {
    if (isUniqueError(err)) return fail("duplicate_name", 409);
    throw err;
  }
  await applyVariants(env.DB, productId, [], p.variants, plan.namedActive, now);
  return json({ ok: true, product: await loadFull(env, productId) });
}

async function updateHandler(request, env, id) {
  const current = await db.getProduct(env.DB, id);
  if (!current) return fail("not_found", 404);

  const parsed = parseBody(await readJson(request));
  if (parsed.error) return fail(parsed.error, 400);
  const p = parsed.value;

  const existing = await db.getVariantsOfProduct(env.DB, id);
  const plan = planVariants(existing, p.variants);
  if (plan.error) return fail(plan.error, 400);

  const now = Date.now();
  try {
    await db.updateProduct(env.DB, id, { ...p, now });
  } catch (err) {
    if (isUniqueError(err)) return fail("duplicate_name", 409);
    throw err;
  }
  try {
    await applyVariants(env.DB, id, existing, p.variants, plan.namedActive, now);
  } catch (err) {
    if (isUniqueError(err)) return fail("duplicate_variant", 409);
    throw err;
  }
  return json({ ok: true, product: await loadFull(env, id) });
}

async function activeHandler(request, env, id) {
  const current = await db.getProduct(env.DB, id);
  if (!current) return fail("not_found", 404);
  const body = await readJson(request);
  if (!body || typeof body.active !== "boolean") return fail("bad_request", 400);
  await db.setProductActive(env.DB, id, body.active, Date.now());
  return json({ ok: true });
}

// Returns a Response if the path belongs to products, otherwise null.
export async function handleProducts(request, env, url) {
  const path = url.pathname;
  const method = request.method;

  if (path === "/api/products") {
    if (method === "GET") return await listHandler(env, url);
    if (method === "POST") return await createHandler(request, env);
    return fail("method_not_allowed", 405);
  }

  const m = path.match(/^\/api\/products\/(\d+)(\/active)?$/);
  if (!m) return null;
  const id = Number(m[1]);

  if (m[2]) {
    if (method === "POST") return await activeHandler(request, env, id);
    return fail("method_not_allowed", 405);
  }
  if (method === "GET") {
    const full = await loadFull(env, id);
    return full ? json({ ok: true, product: full }) : fail("not_found", 404);
  }
  if (method === "PUT") return await updateHandler(request, env, id);
  return fail("method_not_allowed", 405);
}
