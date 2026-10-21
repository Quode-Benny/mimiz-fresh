# Decisions

- Fresh project is local-only and separate from both previous apps. The supplied documents are requirements; they do not imply the entire system is complete in this slice.
- Use the specified pnpm/Turborepo, Next.js, separate NestJS/Fastify and pure domain packages. Introduce further libraries with the features that need them.
- First slice is a browser-only catalogue and basket preview using clearly identified fictional data. No order creation, authentication or payment claims.
- Original ivory/orange food-first design, Plus Jakarta Sans, Lucide and Radix dialog. Self-hosted font package. Photography now uses locally stored, credited Wikimedia Commons images of Ghanaian food; replace with approved owner photography before launch.
- Displayed totals are previews only; authoritative server pricing will accompany server cart implementation.

## Ghanaian menu and ordering UI

- The sample catalogue now has 14 Ghanaian dishes and drinks, with locally stored WebP images and public licence attribution at /photo-credits. No catalogue data is represented as an approved restaurant recipe, price or real stock state.
- Suggested now uses Africa/Accra dayparts to reorder available items; it does not remove dishes. All items exposes the full menu and usual-daypart hints. The sample asana entry demonstrates an unavailable state.
- Required protein/soup options, optional extras, quantities and notes are validated in the domain package. Distinct configurations remain distinct basket lines. Stored prices are discarded and recalculated from the sample catalogue on restore.
- The v2 browser basket replaces the early generic preview basket. It is not a server cart or an order. The API still only exposes foundation health; checkout, provider lifecycle and database work remain next.
- UI changes include sticky navigation, persistent branch and fulfilment context, sticky categories, mobile bottom navigation, accessible Radix meal/bag dialogs, focus restoration, unavailable/empty/offline/storage-error states, vegetarian filters and larger dish text.
- Static catalogue content lives in the shared demo fixture. Main marketing copy lives in the English message catalogue. Full next-intl integration and extraction of remaining interface labels are deferred to the app shell milestone.

## Database-backed local ordering milestone

The initial browser-only preview descriptions above are historical. The current source uses the Nest API, persistent PostgreSQL/PostGIS data and server carts.

- Infrastructure runs in project-specific Docker volumes and host ports 5433/6380. Existing Mimiz application databases and containers are not modified.
- The current database layer uses parameterised PostgreSQL SQL with transaction/row locks and PostGIS functions. Drizzle is initialised, but converting the remaining repository SQL and generated schema/migration tooling is an outstanding technical-spec conformance item.
- Access JWTs expire in 15 minutes and are tied to revocable database sessions. Refresh tokens rotate, reuse revokes their family, and staff passwords use Argon2. Demo customer OTP never authenticates staff.
- Cart ownership is separate from customer identity. Logging out or changing accounts cannot expose the old customer's server cart. Client versions prevent silent cross-tab overwrites.
- Checkout snapshots the menu, applies integer-pesewa prices/promotions, validates hours/scheduling and geospatial eligibility, locks stock and allocates branch/day order numbers transactionally.
- Payments initialize after order commit. Webhooks verify raw-body HMAC signatures, enter a durable inbox, and process idempotently in BullMQ. Refund records and expired pending orders are reconciled after restarts. The browser never confirms payment.
- API and live-update access are checked against ownership, role, branch and assigned rider. More adversarial permission coverage and websocket session-revocation hardening remain part of final acceptance.
- The PWA uses Serwist through webpack. Development disables the service worker; production builds cache the public menu and shell while using network-only handlers for private/order/payment routes.
- Sharp validates and re-encodes uploaded menu images. Local files and credentials remain ignored. S3 migration/live adapters remain outstanding.
- This milestone is not the full v1 Definition of Done. The explicit remaining list is maintained in docs/sprint-status.md; provider gaps cannot be presented as verified integrations.
