# Platform status

## Working locally

- Next.js storefront with the Ghanaian catalogue, accessible meal customisation, vegetarian/category/search controls and Ghana-time suggestions.
- Separate NestJS/Fastify API, PostgreSQL 16 + PostGIS, Redis, BullMQ and protected Socket.IO order signals. REST polling remains the fallback.
- Company-owned catalogue with branch price/availability/stock overrides. Persistent server carts and optimistic-version conflict checks.
- Customer OTP with hashed five-minute codes, attempt limits and explicit demo code; staff Argon2 login; HttpOnly access/rotating refresh sessions; refresh-family reuse detection; CSRF and origin checks; branch/role permissions.
- Pickup and delivery checkout with required delivery pin, landmark and recipient details. PostGIS checks coverage; opening hours, closures, three-day 15-minute scheduling, minimums, promotions and server prices are enforced.
- Transactional stock reservations, per-branch/day order numbers, snapshots, customer cancellation, append-only status history, cash completion, private history/tracking and meal ratings.
- Signed mock gateway, duplicate delivery, decline/retry, delayed success, late success/refund, background unpaid-order expiry, persistent webhook inbox, refund recovery.
- Staff kitchen board with sound gate/repeating alerts, availability toggles, company dish editing/creation, photo validation + responsive WebP upload, team creation/deactivation, kitchen hours/closures, radius delivery zones and promotions.
- Rider assignment and role-scoped rider lists/actions; foreground location posting for assigned active deliveries; customer rider contact/location link.
- Order support messages and branch support inbox, in-app notifications, owner-only Dev Inbox, basic revenue/popularity summaries.
- Installable manifest and Serwist offline fallback/menu cache; auth, order, checkout and payment paths use network-only strategies. Service worker is enabled in production builds, disabled during development.

## Verification

See test commands in README. Real-service tests cover cash lifecycle, duplicate checkout, ownership/CSRF, signed and duplicate webhooks, cancellation/refund, decline/retry, late webhook/refund, PostGIS delivery and last-portion concurrency. Browser tests cover customer checkout and staff tools on 360px and 1280px. Never infer production readiness solely from these checks.

## Still required for the full supplied v1 definition

- Complete live SMS/email/maps/storage/error adapters and shared provider contract suites; the Paystack implementation remains UNVERIFIED and needs test credentials.
- Web push/VAPID delivery, notification preferences and complete notification retry/cost reporting.
- Full multi-branch chooser with closest-branch resolution and cart-switch confirmation; branch creation UI; polygon zone drawing.
- Full option-group/category/daypart management, richer search ranking/typo tolerance and recommendation impression/click logging.
- Chat attachments, typing/read receipts, staff claiming/retention, order print layouts and staff-created telephone orders.
- Broader reports, reconciliation/settlement CSVs, audit viewer, account anonymisation/deletion, staff 2FA, retention/backup/restore rehearsals and deployment monitoring.
- Generated OpenAPI client coverage, Storybook, full i18n extraction, shared styling/config packages, production security/performance review and CI migration/container acceptance.

Do not label the entire specification complete yet. Seed branch data, prices and photos are illustrative. No real kitchen, rider business or payment processor is connected.
