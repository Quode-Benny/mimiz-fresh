# Approved sandbox promotion - 22 October 2026

The owner accepted the sandbox and requested promotion into the main Mimiz Fresh project. This records the local main application at http://localhost:3002, with API port 4000. It does not activate public hosting or live payment/messaging providers.

Status: approved changes promoted, main application activated, and verification complete.

## Preserved main-project state

Main Compose project name, ports 3002/4000/5433/6380, database/Redis/photo volumes, cookie names, owner credentials, JWT/webhook secrets and existing provider settings remain in place. No sandbox customer data, credentials, database, Redis queues or uploaded photos were copied. Existing uncommitted source was preserved in a private source snapshot before changed files were replaced.

Only local AI configuration was added to the existing ignored .env. The main Ollama runtime has its own model volume, loopback port 11438, two-CPU/two-GB limits and cloud disabled. It uses the approved qwen2.5:0.5b routing model and persistent human handover. Main and sandbox support runtimes are independent.

Migration 009 adds assistant routing and messages. Existing conversations default to human support. Existing user, order and human-message row counts are checked before browser acceptance.

## Recovery assets

- Pre-promotion database/photo backup: data/backups/mimiz-2026-10-22T15-26-06-478Z.json.
- Private source/environment snapshot and file hashes: data/promotion-2026-10-22-1792682918529/.
- Retained API image: mimiz-fresh-api:pre-promotion-20261022.
- Retained web image: mimiz-fresh-web:pre-promotion-20261022.
- A temporary-database restore rehearsal passed before applying changes.

These ignored local recovery assets contain private configuration/data and must not be committed. Roll back using reviewed source changes and the retained images if needed. The additive migration can remain for the older app; do not drop tables or restore an old database over new orders automatically.

## Run

From the main project:

```powershell
docker compose -f docker-compose.yml -f docker-compose.app.yml -f docker-compose.ai.yml up -d
```

Staff/admin use the main project's ignored .local-admin credentials, not the sandbox credentials. Customer sign-in retains demo OTP 123456 while the current demo configuration is enabled.

## Verification

- Main API/web TypeScript checks passed.
- All 95 unit cases passed (27 domain, 48 providers including local-model contracts, 20 security; unchanged domain/security reused Turbo cache).
- Main API and production-mode Next web images built successfully and were activated.
- Migration 009 applied; pre-existing order, user and human-message row counts were unchanged before browser acceptance.
- Main model digest matches the approved sandbox model: a8b0c51577010a279d933d14c2a8ab4b268079d44c5c8830c0a93900f1827c67.
- Current-image PWA checks passed: manifest, service worker, strict private-cache exclusion and offline fallback after the owned temporary container stopped.
- API log privacy checks passed: query/auth/cookie sentinels excluded while route, status, timing and correlation ID were recorded.
- Full main-project browser acceptance passed in one consolidated run: 58 passed, 22 intentional duplicate mobile service checks skipped, zero failures (13.9 minutes). This includes the actual local model, human handover, ownership checks, checkout/payment/refunds, stock concurrency, separate portal sessions, themes/profile/discovery, kitchen approval/tracking, role permissions, authenticator security and both viewport accessibility checks.


## Follow-up requested improvements

The owner requested customer/rider chat, one customer tracker, guided meal ordering, a storage explanation and a compact staff queue. See [improvements-2026-10-22.md](improvements-2026-10-22.md) for the follow-up implementation and its separate verification record, and [system-and-storage.md](system-and-storage.md) for the local database and disk breakdown. The promotion results above record the earlier approved milestone.
