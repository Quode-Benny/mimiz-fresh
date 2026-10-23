# Platform status - 21 October 2026

## Implemented locally

- Separate customer, staff, administration and rider entrances; independent portal-bound sessions, CSRF cookies and browser query caches. Role and branch permissions are checked by the API.
- Responsive Ghanaian storefront with fourteen illustrative dishes, meal choices, dietary/allergen tags, typo-tolerant search, categories, sorting and explainable recommendations.
- Multi-kitchen selection, nearest-distance display, PostGIS coverage, cart-switch confirmation, stock and current-price validation.
- Persistent versioned carts, cash and simulated online checkout, fee/tax snapshots, promotions, valid scheduled slots, opening hours and closures.
- Idempotent order creation and transactional last-portion reservations; signed/duplicate payment webhooks, retry, expiry, cancellation, partial refunds and late-success refunds.
- Kitchen board, phone/walk-in cash orders, print tickets, menu/option/stock editing, dish duplication/archive, categories, company/daypart/fee settings, kitchen creation/archive, team and delivery-zone controls.
- Assigned rider deliveries, foreground location updates and customer tracking.
- Private support text/photos, typing, opposite-side read receipts, staff claiming, flags and retention maintenance.
- Customer profiles, addresses, preferences, reorder and guarded account anonymisation.
- Durable SMS/push notification deliveries, retries, templates, subscription validation and cost reports.
- Date/branch reports, reconciliation, customer controls, CSV exports and audit viewing.
- Staff authenticator enrolment, replay prevention, encrypted secrets and one-use recovery codes.
- Production PWA/offline fallback, private API cache exclusion, forward SQL migrations, explicit first-owner provisioning, Docker application definitions and native data backup/isolated restore scripts.

## Verification

The current unit suite passes 88 tests: 27 domain, 41 provider contracts and 20 authenticator/cryptography cases. The final compiled Docker acceptance run passed 51 cases with 21 intentional mobile duplicates skipped (72 total, no failures). Native production/PWA, empty-installation and backup/restore checks passed. Storage/account follow-up checks passed 12 cases with 6 intentional skips. Storefront/cart-readiness and four cross-tab/network-recovery regressions passed. All sixteen reviewed mobile portal screens passed automated WCAG AA checks.

Tests use a development database and create illustrative users/orders. Mobile duplicates of service-only tests are intentionally skipped. Provider transport stubs do not establish live readiness.

## Still required for the entire supplied specification

- Verified merchant/sender credentials, live payment settlement/refund acceptance, real-device push acceptance and approved business data.
- Verified live S3 migration/bucket and Sentry-project acceptance, plus deployed monitoring/alerts. Local/S3 storage, source-preserving migration, metadata-only error reporting and optional Sentry adapters are implemented.
- Generated OpenAPI client coverage, Storybook, full i18n extraction and remaining shared configuration/schema tooling conformance.
- Final deployment security/performance acceptance, production backup scheduling and off-site retention.
- Owner decisions on retention/anonymisation of operational notes. Existing financial and audit history is preserved.

Seed menu prices, hours, addresses and allergens are illustrative. Local functionality is substantial, but the complete v1 and live-sales deployment must not be labelled finished yet.
