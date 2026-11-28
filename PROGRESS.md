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
- [ ] Owner to test install on iPhone (Add to Home Screen), then approve Phase 0 -> Phase 1.

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

## How to deploy
- Commit files to the main branch on GitHub; Cloudflare builds and deploys automatically (Workers & Pages > ledger > Deployments).
- Worker name in wrangler.jsonc must stay "ledger".

## Known issues / watch list
- PBKDF2 with 100000 iterations may exceed the free-plan 10 ms CPU limit. If login/setup fails with a CPU-time error (Cloudflare error 1102), lower PBKDF2_ITERATIONS in src/auth.js.
- A duplicate empty "ledger-db" was created by mistake in the previous (wrong) Cloudflare account; it is unused.
