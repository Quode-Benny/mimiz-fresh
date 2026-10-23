# Implementation decisions

- Mimiz Fresh is independent of both older applications. Its PostgreSQL/PostGIS and Redis services use host ports 5433 and 6380 and project-specific volumes.
- Customers, kitchen/support staff, administrators and riders have distinct entrances and navigation. Portal-specific cookie namespaces, database-bound sessions and separate browser query caches prevent a role switch from becoming an implicit login.
- All authority stays in the Nest/Fastify API: customer ownership, staff branch scope and rider assignment are checked on REST and live connections. Customer OTP never grants a staff role.
- Prices use integer pesewas and rates use basis points. Checkout revalidates current prices, options, stock, operating hours, scheduled time and PostGIS coverage. Orders retain snapshots; setting changes affect new orders.
- Dayparts guide recommendations and ordering. Explicit serving windows, category state, branch availability and stock control whether a meal can be bought.
- Cash and the signed mock gateway work locally. Browser callbacks cannot confirm payment. Merchant payment verification, settlement, sender delivery and device push remain distinct live acceptance gates.
- Parameterized SQL and row/advisory locks implement transactions and PostGIS operations. Drizzle is initialized; generated schema/repository conformance is still outstanding. Forward SQL migrations run under an advisory lock.
- Local photo storage remains the zero-cost default. Optional S3 keeps buckets private and proxies the same API URLs. Image inputs are decoded and re-encoded by Sharp. Private chat photos require thread authorization and are never served by the public menu-image route.
- Customer-photo deletion has a durable retry outbox. Account anonymisation preserves financial/order-event/audit history and staff replies. A broader operational-note purge was rejected by automatic approval review; owner retention decisions remain outstanding.
- Staff authenticator secrets use a separate encryption key. Password reauthentication protects enrollment/disable actions, TOTP counters prevent replay, and recovery codes are hashed and one-use.
- The production service worker caches public menu data and shell assets. Private APIs and operational routes use the network. Offline pages never confirm an order or payment.
- Development uses .next-dev; production uses .next. Windows uses normal production output because standalone symlinks require privileges; Linux containers use standalone output.
- docker-compose.app.yml is a local demo acceptance stack. Its API deliberately runs development configuration against isolated local services. This is not a production deployment manifest.
- Production seeding is disabled. Explicit migration/provisioning commands create an empty company and first owner without fictional kitchens, menus or customers.
- Backup rehearsals use uniquely named temporary databases. Native and container photos are captured according to the active storage source. Production/S3 backup scheduling, encrypted off-site retention and deployed monitoring still need acceptance.
- The fourteen sample Ghanaian dishes, prices, addresses, allergens and hours are illustrative. Food photo licenses are documented. Restaurant-approved data is required before live sales.
- docs/sprint-status.md and docs/providers.md state the remaining specification and live-integration gaps. Passing local checks does not complete those external acceptance gates.

- Session renewal is coordinated per portal with browser Web Locks and a per-tab promise. A waiting tab rechecks authentication before rotating again; transient session-network failures retry rather than becoming a signed-out state. Server refresh-family reuse detection remains enforced.
- The broader automated accessibility review is available as pnpm verify:accessibility and included in prepared CI. It uses only local demo providers, reviews sixteen mobile portal screens and removes only its own temporary customer/rider fixtures.
