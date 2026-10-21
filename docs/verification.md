# Local verification - 2026-10-21

## Passed

- Web/API TypeScript checks.
- 17 pure domain tests and 6 payment-provider contract/scenario tests.
- Production Next.js + Serwist build and executable NestJS API bundle.
- Consolidated Playwright acceptance: 20 passed, 8 intentional skips. The skipped cases repeat backend-only scenarios under the mobile project; mobile and desktop customer/staff/browser flows both ran.
- Customer browse/customise/server-cart/OTP/pickup checkout/tracking/reload.
- Staff login, kitchen/catalogue visibility, owner settings and integration page.
- Forged/unsigned webhook rejection, duplicate payment delivery, decline/retry, asynchronous refunds, late success after timeout.
- Duplicate concurrent order submission, two buyers competing for one tracked portion, pending partial-refund reservation.
- Customer order ownership/CSRF, assigned-rider read/write/location boundaries and location removal on completion.
- PostGIS delivery coverage, stale cart versions, uploaded-image byte validation and WebP delivery.
- Automated WCAG AA checks on menu, meal dialog and bag at mobile/desktop widths.
- Production PWA manifest/worker, public menu caching, exclusion of private API paths, and offline fallback after the temporary owned production server was stopped.
- Built API process started against real PostgreSQL/PostGIS + Redis; production mock/demo provider guard rejected unsafe startup.
- Setup command preserved existing .env and reused the isolated containers.
- API imported-file reload was demonstrated with polling enabled.
- .env, .local-admin, uploads, browser traces and generated service worker remain ignored.

## Findings corrected during verification

- Restored keyboard focus to the opening control after dialogs close.
- Removed overlapping hero text and showed an explicit saved-order state while tracking navigation loads.
- Cold webpack compilation exceeded the earlier 5-second assertion window. Development test timeouts now allow compilation without removing functional assertions.
- The earlier development API watcher did not reload imported files in this Windows workspace. It now explicitly includes API sources and polls; the partial-refund race was rerun against the reloaded code and the final consolidated run passed.
- PWA offline acceptance disconnects an owned temporary server as well as emulating offline mode, avoiding service-worker network-emulation ambiguity.

## Limits

This verifies the local demo milestone, not the whole supplied v1 Definition of Done or live-provider readiness. See sprint-status.md and providers.md. GitHub Actions is configured but has not run remotely from this local workspace. No live charge, SMS, email, storage migration, restore rehearsal or production deployment is claimed.
