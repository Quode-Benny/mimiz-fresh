# Mimiz Fresh

Approved design and local-AI support have been promoted to the main app. See [promotion notes](docs/promotion-2026-10-22.md) for verification, startup and recovery details.

A Ghanaian restaurant ordering platform built independently of the previous applications.

## Run locally

Requirements: Node.js 22+ (verified here with Node 24), Docker Desktop and pnpm 10.18.3.

1. Install packages: `npx pnpm@10.18.3 install --frozen-lockfile`.
2. Prepare the local environment: `npx pnpm@10.18.3 run setup`. This preserves an existing .env, otherwise generates local secrets, and starts isolated PostgreSQL/PostGIS and Redis containers.
3. Start the web app and API: `npx pnpm@10.18.3 dev`. The API applies forward-compatible idempotent schema setup and seeds the fictional kitchen only when missing.
4. Open http://localhost:3002. API health: http://localhost:4000/api/v1/health. API documentation: http://localhost:4000/docs.

The database and Redis use host ports 5433 and 6380 so they do not modify the older Mimiz apps. Docker volumes persist records across restarts. The default workflow runs API/web on the host. docker-compose.app.yml adds application containers for local acceptance; see docs/installation.md and docs/backups.md before switching storage.

## Customer and staff access

Customers sign in with a Ghana phone number. In local demo mode, `123456` is accepted alongside the actual expiring random code. Staff must use email/password; customer OTP cannot grant staff access.

The first local owner's email and generated password are saved in ignored `.local-admin` at the project root. Read that file locally; do not commit or share it publicly. Optional STAFF_ADMIN_EMAIL/STAFF_ADMIN_PASSWORD overrides apply only before the first owner exists.

- Customer menu: /
- Customer checkout: /checkout
- Order history and tracking: /orders
- Customer profile, saved addresses and updates: /account
- Kitchen/support/menu workspace: /staff or /kitchen
- Team, kitchen settings, delivery zones, promotions and integrations: /admin
- Assigned delivery view: /rider

Create kitchen/rider/support accounts through /admin. Rider accounts see only assigned deliveries.

## Working flows

The catalogue and carts are database-backed. Prices, options, stock, branch hours, schedule limits, promotions and delivery coverage are checked by the API. Cash and simulated online orders persist with snapshots and status events. Staff fulfil the same orders visible to customers.

Online checkout uses a persistent mock gateway that delivers HMAC-signed webhooks through the real API endpoint and queue. Duplicate events are idempotent; payment failures can be retried; cancellations and late success can produce asynchronous simulated refunds. No real money is collected.

Delivery requires a map pin and landmark. Coverage is checked by PostGIS against configured radius or polygon zones. Leaflet/OpenStreetMap and foreground rider geolocation are real. All seed business data and stock examples are fictional.

Menu photo uploads are validated by image decoding, re-encoded into responsive WebP and saved in ignored data/uploads by default; optional private S3 uses the same API image URLs. Existing sample photo credits and licences are listed in docs/image-credits.md and /photo-credits.

## Checks

- `pnpm typecheck`: web and API types
- `pnpm test`: domain, provider and authenticator security tests
- `pnpm build`: executable Nest API bundle and production Next/PWA
- `pnpm test:e2e`: start `pnpm dev` first; covers mobile/desktop UI, accessibility and real PostgreSQL/Redis lifecycles
- `pnpm verify:accessibility`: safe local review of sixteen mobile customer/operations screens; the API and web must be running
- `pnpm verify:api`: executable API + production demo-mode guard (build first)
- `pnpm verify:pwa`: owned temporary production server + offline/cache checks (build first; API must be running)
- `pnpm test:reset-limits`: development-only reset of this project's Redis rate counters before repeated automated runs

Browser screenshots/traces are under ignored artifacts/. Test cases create local orders and users; this is a development database, not production data.

The service worker is disabled in development. A production web build includes the PWA manifest, public-menu caching and an offline fallback. Auth, customer orders, checkout and payments must use the network. Offline views never confirm an order or payment.

## Completion and go-live

This is a functioning local ordering system, not the full completed v1 or a live-sales deployment. See docs/sprint-status.md for the explicit remaining requirements, docs/providers.md for integration verification, and docs/go-live.md for acceptance.

Never enable paid/live providers merely because a local demo passes. Paystack is implemented but UNVERIFIED with provider credentials. Hubtel, Arkesel, Resend and Google adapters have local transport-contract tests but remain unverified with live accounts. The local/S3 storage adapter and safe migration tool are implemented, with cloud acceptance outstanding. Console/Sentry error reporting is implemented; its live project and deployed alerts remain unverified; unsupported modes fail startup. Production mock/demo mode is blocked unless the explicit soft-launch override is set. Real branch data, provider verification, production backup scheduling and deployment hardening remain required. Local backup, isolated restore and empty-installation rehearsals are available.

A GitHub Actions workflow is configured under .github/workflows/checks.yml. It has not been executed by GitHub from this local workspace.

See docs/review-notes.md for the latest review record and docs/installation.md for empty-installation provisioning and staff authenticator recovery.
Development output uses .next-dev so it cannot overwrite the production .next build during CI/offline verification.

Do not start host dev and the application containers on the same ports. To switch to host dev, stop only api/web with docker compose -f docker-compose.yml -f docker-compose.app.yml stop api web; leave infrastructure volumes intact.
