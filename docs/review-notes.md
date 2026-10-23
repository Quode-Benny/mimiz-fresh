# Review notes - 21 October 2026

The work is in G:/CODE~BENNY/Projects/DEV/mimiz-fresh. The older Mimiz Canteen project was left untouched. This is a functioning local development platform with illustrative restaurant data; live sales and the entire technical v1 checklist are not signed off.

## Open the application

The local Docker stack serves these separate entrances:

- Customer: http://localhost:3002/
- Kitchen/support staff: http://localhost:3002/staff
- Administration: http://localhost:3002/admin
- Assigned riders: http://localhost:3002/rider

Use the existing ignored .local-admin credentials for owner access. Staff and administration require separate sign-ins. Create role-specific team accounts in administration; a rider sees assigned deliveries only. Customer OTP cannot grant staff access.

Each portal has its own cookie namespace, CSRF token, database-bound sessions and browser query cache. Operational navigation stays in that workspace. Signing out of one portal leaves the others alone.

## What is working locally

The customer storefront has Ghanaian meals, responsive photography, a plum/coral/gold palette, meal options, dietary/allergen tags, category and typo-tolerant search, sorting and explainable suggestions. Kitchen selection checks PostGIS coverage and explicitly confirms cart changes.

Carts and orders persist in PostgreSQL. Checkout revalidates prices, options, stock, hours, scheduled slots, fees, promotions and coverage. Cash and signed simulated online flows include retry, cancellation, expiry and refunds. Transactional locks protect the last portion and duplicate submissions.

Staff have a kitchen board, sound alerts, full-screen view, busy preparation time, pause/resume, order filters, phone/walk-in cash orders and print tickets. Administration includes company/daypart/fee settings, categories, dish/options/stock editing, branch creation/archive, polygon zones, team roles, reports, reconciliation, customers, CSV exports and audit history.

Customer profiles, addresses, preferences, reorder, in-app updates, durable critical SMS/push jobs and authenticated support photos are implemented. Chat includes claims, typing and read receipts. Staff can enroll an authenticator and save one-use recovery codes.

Local and optional private S3 storage share the same image URLs. The source-preserving migration tool defaults to a local dry run and verifies hashes. Customer-photo deletion has a durable retry outbox. Structured request/error logging excludes customer content and credentials; optional Sentry remains unverified with a live project.

## Verification

- 88 unit cases pass: 27 domain, 41 provider/storage/error contracts and 20 authenticator cases.
- The final compiled Docker acceptance run passed 51 cases with 21 intentional duplicate service cases skipped under the mobile project (72 total, no failures).
- The storage/account follow-up passed 12 cases with 6 intentional skips, including customer-photo removal and retained staff replies.
- API/web type checks, executable API startup and production demo-provider rejection passed.
- Windows production build and PWA manifest/worker/private-cache/offline acceptance passed.
- Empty-installation provisioning passed with all eight migrations, one owner/company and no sample kitchens/orders.
- Native and active-container photo backup paths and isolated database restore rehearsals passed.
- A real filesystem deletion failure was retained with backoff and retried successfully in a separate temporary database.
- Running-container log checks confirmed request correlation and excluded query/auth/cookie sentinels.
- Storefront and deterministic cart-readiness regressions passed. Six viewport widths were checked from 320 to 1280 pixels.

The tests create local users, orders and messages. Screenshots/traces and backups remain ignored and private. No merchant charge, real SMS/email, cloud bucket migration, live Sentry activation, public deployment or remote GitHub Actions run is claimed.

The final session regressions passed on both screen sizes: simultaneous tabs renew once and a forced connection failure recovers without sign-out. All sixteen reviewed mobile portal screens passed automated WCAG AA checks after fixing the sign-out name and keyboard access to report tables. Run pnpm verify:accessibility to repeat that review; CI is prepared to run it too.

## Remaining acceptance and tooling

Owner-approved menu/prices/allergens, contacts, hours, fees and policies are required. Merchant/sender credentials, actual settlement/refund delivery, device push and production storage/monitoring/backups need separate acceptance.

Generated OpenAPI client coverage, Storybook, full localization extraction and the remaining Drizzle/shared-schema tooling conformance are still on the supplied technical checklist. See sprint-status.md and providers.md.

Automatic approval review rejected a broader deletion of order-event/audit notes because it could erase operational history. Those records and staff replies remain preserved. Account removal still clears the already-authorized customer profile and customer-authored private content.

## Running and maintenance

README.md describes host development. To use host development after the container review, stop only api/web with the combined Compose files before pnpm dev so ports do not conflict. Keep PostgreSQL/Redis volumes.

See installation.md for explicit owner provisioning and authenticator recovery, backups.md for source-aware backups, storage.md for optional S3 migration and monitoring.md for logs/error reporting.

CI checks are prepared in .github/workflows/checks.yml but have not been pushed or run remotely. No permanent cloud development worker was created; local work requires this PC to remain awake and connected.

Final recovery check: a fresh database/active-container-photo backup was created after the acceptance suite, then restored into an isolated temporary database. Schema/orders/users/PostGIS and photo archive integrity passed; the running development database was unchanged. Web and API returned HTTP 200 afterward.

## Approved sandbox promotion - 22 October 2026

The owner approved the sandbox changes. They are now running in the main project at http://localhost:3002, with the main project's existing credentials and data. See [promotion-2026-10-22.md](promotion-2026-10-22.md) for exact verification, local-AI startup and rollback assets. Verification complete: TypeScript checks and 95 unit cases passed; consolidated browser acceptance passed 58 cases with 22 intentional skips and zero failures. PWA/private-cache and log-privacy checks passed.


## Rider chat and busy-queue improvements

Customer/rider private chat, guided meal-review cards, one progress tracker and a compact paginated kitchen queue are now running at http://localhost:3002. Verification: 99 unit cases passed; full browser acceptance 59 passed, 23 intentional skips, zero failures. See [improvements-2026-10-22.md](improvements-2026-10-22.md) and [system-and-storage.md](system-and-storage.md) for behavior, storage measurements and approved cleanup results.
