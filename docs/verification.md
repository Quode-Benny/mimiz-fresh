# Local verification - 2026-10-21

## Current checks

The final compiled Docker mobile/desktop acceptance run passed 51 cases with 21 intentional duplicate service cases skipped (72 total, no failures).

- API/web TypeScript checks and Linux standalone production web build passed.
- Unit suites pass 88 cases: 27 domain, 41 provider/storage/error contracts and 20 authenticator cases. The final invocation reused unchanged Turbo results.
- Cross-tab expiry renews once without invalidating the refresh family; a forced connection failure after renewal recovers without signing out. All four mobile/desktop cases passed.
- Cart-readiness regressions passed on mobile and desktop: fulfillment controls wait for the server cart and persist only after the update succeeds.
- Six storefront browser cases passed, including pickup preference persistence. Layout overflow was checked from 320 through 1280 pixels.
- Automated WCAG AA checks passed on all sixteen reviewed mobile customer, kitchen, administration and rider screens. The review exposed and corrected the hidden sign-out name and keyboard access to scrolling reports.
- Current Docker PWA acceptance passed: manifest, worker, strict public-menu-only API caching and offline fallback after stopping only the owned temporary container.
- Running-container logs preserve request correlation, route template, status and timing while excluding query/auth/cookie sentinels.
- Acceptance safety refuses production, live payment/SMS/email, cloud storage/error/maps and non-demo OTP configurations before resetting development rate counters.

## Earlier integration and recovery checks

The complete acceptance suite covers customer browse/options/server cart/OTP/checkout/tracking; independent portal sessions and role boundaries; manual orders, printing, catalogue and company settings; assigned-rider actions/location; profiles/reorder/account anonymisation; private support photos; authenticator setup/recovery; and notifications.

Payment scenarios include forged/unsigned and duplicate webhooks, decline/retry, asynchronous refunds, late success, concurrent duplicate submissions, last-portion contention and pending partial-refund reservation. All payments remain simulated.

- The storage/account follow-up passed 12 cases with 6 intentional mobile duplicates skipped.
- Executable API startup and production demo-provider rejection passed.
- Empty-installation provisioning passed all eight migrations with one owner/company and no sample kitchens/orders.
- Native and active-container photo backup paths and isolated database restore rehearsals passed.
- A real filesystem deletion failure persisted in the photo-deletion outbox, backed off and retried successfully using a separate temporary database.
- The source-preserving photo migration dry run validated 29 local photos; no cloud migration was executed.
- Windows production/PWA acceptance passed earlier; the current review stack uses Docker.
- Secrets, local credentials, photos, backups and browser artifacts remain ignored.

## Limits

This verifies local development behavior. Live merchant settlement/refunds, real SMS/email, real-device push, S3/Sentry acceptance, approved restaurant data and production deployment remain outstanding. Generated API-client coverage, Storybook, localization extraction and schema-tooling conformance remain on the supplied technical checklist. CI is prepared but has not run remotely. No live charge, external message, cloud migration or public deployment is claimed.

See review-notes.md, sprint-status.md and providers.md for operating instructions and remaining scope.

Final recovery check: a fresh database/active-container-photo backup was created after the acceptance suite, then restored into an isolated temporary database. Schema/orders/users/PostGIS and photo archive integrity passed; the running development database was unchanged. Web and API returned HTTP 200 afterward.
