-- 0002_products.sql
-- Phase 1 / group 1: products and their variants.
-- Every product has at least one variant. A product without real variants has a single
-- "default" variant with an empty name (''). Stock is always tracked per variant.
-- Names are stored normalized (English digits, Persian yeh/kaf). Money is an integer in Toman.

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('raw', 'finished')),
  unit TEXT NOT NULL DEFAULT 'عدد',
  default_sale_price INTEGER NOT NULL DEFAULT 0,
  default_purchase_price INTEGER NOT NULL DEFAULT 0,
  note TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_name ON products(name);

CREATE TABLE IF NOT EXISTS variants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id),
  name TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  UNIQUE (product_id, name)
);
CREATE INDEX IF NOT EXISTS idx_variants_product ON variants(product_id);
