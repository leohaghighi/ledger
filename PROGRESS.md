# Ledger - Progress Notes

Simple accounting + inventory web app (Persian UI) for a small handicraft workshop in Iran.
Single user. Hosted on Cloudflare Workers (free) + D1. See "Rules" below.

## Rules (hard constraints)
- Cloudflare Workers free plan (~10 ms CPU/request): keep server logic light; invoice printing is client-side (window.print + print CSS).
- No external CDNs, fonts or scripts. Everything (JS/CSS/Vazirmatn font) is bundled in this repo.
- Minimal dependencies, no build step (or a very simple one).
- All database access lives in ONE isolated layer (src/db.js, plain standard SQL) so the backend can move to another host. Data must be exportable as JSON/SQL.
- PWA for iOS (manifest + icons). Online-first: data writes need internet.
- Security: single-user login, hashed password, secure session cookie. Secrets only in the Cloudflare dashboard / GitHub secrets, never in code.
- Repo is PUBLIC for now: never commit secrets, real customer data, real invoices or backups.
- Persian UI, RTL, Persian digits in display, accept Persian/Arabic/English digits in inputs.
- Jalali dates in the UI (store Gregorian ISO/timestamps in DB). Fiscal year starts Farvardin 1.
- Money: integers; display Toman by default, optional Rial.

## Workflow
- The assistant has READ-ONLY access to this repo; the owner uploads files manually on github.com (drag & drop of a zip's extracted contents).
- Small groups of files per step; full file content every time.
- Phases are approved by the owner before the next one starts.
- The assistant has a Cloudflare connection that can create/query D1 (it cannot create Workers or set secrets). Schema changes are written as files in migrations/ AND applied to the D1 database by the assistant (wrangler does not run them automatically).

## Phases
- Phase 0: skeleton, login, deploy to Cloudflare, "hello" page on phone.
- Phase 1: products/materials, customers & suppliers, purchase/sales invoices with automatic stock, stock movements, Persian invoice print.
- Phase 2: manual backup/restore + nightly backup to a separate PRIVATE repo "ledger-backups".
- Later (each needs approval): payments and balances, cheques, expenses, reports, production/BOM, low-stock alerts, search/filters, settings.

## Status
- [x] Repo created, Worker "ledger" deployed via Cloudflare Git integration (auto-deploy on commit).
- [x] Live URL: https://ledger.myskynew.workers.dev/ (health check + DB connection verified).
- [x] D1 database "ledger-db" (id 9b597b11-d268-4a2c-94b3-63e2573ed1c4, binding DB) with tables from migrations/0001_init.sql applied.
- [x] Login works (first-run setup, login, logout) - tested by owner on 2026-11-28. Account "dana" created.
- [x] Secret SETUP_CODE exists in Cloudflare (type Secret). Do NOT make it a plain Variable: wrangler deploy deletes plain variables.
- [x] PWA: manifest, icons, minimal service worker, Vazirmatn font bundled (public/fonts, OFL license included).
- [x] Phase 0 approved by owner (2026-11-28).
- [x] Phase 1, group 1 (this commit): app shell (header + bottom tab bar + hash router), products with variants (list, search, filter, create, edit, archive). Migration 0002 applied to D1 by the assistant. Awaiting owner test.
- [ ] Phase 1, group 2: customers and suppliers.
- [ ] Phase 1, group 3: purchase invoices + stock movements (Jalali date helper arrives here).
- [ ] Phase 1, group 4: sales invoices.
- [ ] Phase 1, group 5: current stock view, seller settings, Persian invoice print (A4/A5, amount in words), Toman/Rial switch.

## Architecture decisions
- Static files in public/ (served free, without running the Worker). Only /api/* runs Worker code (run_worker_first in wrangler.jsonc).
- src/index.js = routing + request handling; src/auth.js = hashing/cookies (no DB); src/db.js = ALL SQL.
- Auth: first-run setup creates the single user; protected by a SETUP_CODE secret and only works while the users table is empty. Password: PBKDF2-SHA256 (100000 iterations, stored per user), random salt. Session: random 32-byte token in cookie "__Host-session" (HttpOnly, Secure, SameSite=Strict, 30 days); only the SHA-256 of the token is stored in D1.
- Brute-force protection: login_attempts table, max 10 failures per IP per 15 minutes.
- CSRF: SameSite=Strict + Origin check on non-GET requests.
- Passwords/usernames: Persian/Arabic digits are converted to English digits before hashing.
- All API routes except health, setup-status, setup, login, logout require a valid session.
- Timestamps in DB are Unix epoch milliseconds (integers).

- PWA: public/manifest.webmanifest + public/icons/*.png (generated: brown background, Persian letter "د"). public/sw.js caches only the shell (page, icons, fonts, manifest), navigation is network-first, /api/* is never cached. Bump CACHE_VERSION in sw.js when changing cached static files.
- Font: Vazirmatn Regular + Bold (woff2) in public/fonts, loaded with @font-face (no external requests).
- Install on iPhone: open the site in Safari > Share > Add to Home Screen.

### Phase 1 decisions (owner, 2026-11-28)
- Invoices are VOID-ONLY: no free editing. A wrong invoice is cancelled (voided) and a new one is issued. Voiding must reverse its stock movements.
- Selling more than the current stock is ALLOWED; the UI only shows a warning (stock may go negative).
- Products have VARIANTS (color/size/...), each with its own stock. Stock is always tracked per variant.

### Phase 1 data model and code layout
- products(id, name UNIQUE, kind raw|finished, unit, default_sale_price, default_purchase_price, note, active, ...). variants(id, product_id, name, active, UNIQUE(product_id,name)).
- Every product has at least one variant. A product without real variants has ONE default variant with an empty name (''); it is active only while the product has no active named variants (handled in src/products.js).
- Products and variants are never deleted, only archived/deactivated (invoices and stock history must stay valid).
- TODO (group 3): deactivating a variant / converting the default variant must be blocked or handled when its stock is not zero.
- Money: integer Toman in DB. Rial display = x10 (switch comes in group 5). Quantities (group 3+): integer thousandths ("milli-units") to allow meters/kg without float errors.
- Text normalization on the server (src/util.js normalizeText): English digits, Persian yeh/kaf; names are stored with English digits and displayed with Persian digits (toFaDigits).
- Backend files: src/index.js (routing, auth), src/http.js (json/fail helpers), src/util.js (validation helpers), src/products.js (product API), src/db.js (ALL SQL), src/auth.js.
- Frontend files (no build step, ES modules): public/index.html, public/css/app.css, public/js/{app,api,util,auth-view,products}.js. Screens are plain DOM built with the h() helper (no innerHTML). Routing by URL hash (#/products, #/products/new, #/products/12).
- Service worker: network-first for pages/scripts/styles, cache-first only for icons/fonts. When adding new JS files, add them to the SHELL list in public/sw.js (offline copy) and bump CACHE_VERSION only if icons/fonts change.
- Testing note: the assistant tests API and UI logic with an in-memory SQLite + jsdom before delivering; real deployment is tested by the owner.

## How to deploy
- Commit files to the main branch on GitHub; Cloudflare builds and deploys automatically (Workers & Pages > ledger > Deployments).
- Worker name in wrangler.jsonc must stay "ledger".

## Known issues / watch list
- PBKDF2 with 100000 iterations may exceed the free-plan 10 ms CPU limit. If login/setup fails with a CPU-time error (Cloudflare error 1102), lower PBKDF2_ITERATIONS in src/auth.js.
- A duplicate empty "ledger-db" was created by mistake in the previous (wrong) Cloudflare account; it is unused.
