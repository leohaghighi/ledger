# Ledger - Progress Notes

Simple accounting + inventory web app (Persian UI) for a small handicraft workshop in Iran.
Single user. Hosted on Cloudflare Workers (free) + D1. See "Rules" below.

## Rules (hard constraints)
- Cloudflare Workers free plan (~10 ms CPU/request): keep server logic light; invoice printing is client-side (window.print + print CSS).
- No external CDNs, fonts or scripts. Everything (JS/CSS/Vazirmatn font) is bundled in this repo.
- Minimal dependencies, no build step (or a very simple one).
- All database access lives in ONE isolated layer (plain standard SQL) so the backend can move to another host. Data must be exportable as JSON/SQL.
- PWA for iOS (manifest + icons). Online-first: data writes need internet.
- Security: single-user login, hashed password, secure session cookie. Secrets only in the Cloudflare dashboard / GitHub secrets, never in code.
- Repo is PUBLIC for now: never commit secrets, real customer data, real invoices or backups.
- Persian UI, RTL, Persian digits in display, accept Persian/Arabic/English digits in inputs.
- Jalali dates in the UI (store Gregorian ISO/timestamps in DB). Fiscal year starts Farvardin 1.
- Money: integers; display Toman by default, optional Rial.

## Workflow
- The assistant has READ-ONLY access to this repo; the owner uploads files manually on github.com.
- One file (or 2-3 related files) per step; full file content every time.
- Phases are approved by the owner before the next one starts.

## Phases
- Phase 0: skeleton, login, deploy to Cloudflare, "hello" page on phone.
- Phase 1: products/materials, customers & suppliers, purchase/sales invoices with automatic stock, stock movements, Persian invoice print.
- Phase 2: manual backup/restore + nightly backup to a separate PRIVATE repo "ledger-backups".
- Later (each needs approval): payments and balances, cheques, expenses, reports, production/BOM, low-stock alerts, search/filters, settings.

## Status
- [x] Repo created, README only.
- [ ] Phase 0 in progress (started 2026-11-28).

## Architecture decisions
- (to be filled as we build)

## How to deploy
- (to be filled in Phase 0)

## Known issues
- None yet.
