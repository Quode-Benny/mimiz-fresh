# Requested improvements - 22 October 2026

Status: implemented, activated at http://localhost:3002, verified, and approved cache cleanup complete.

## Customer and rider conversation

Customer order details and assigned rider delivery cards now offer Chat about delivery. This is separate from kitchen support and the local assistant. Only the owning customer and the currently assigned rider can access it. Every request checks the assignment; reassignment revokes old rider access and opens a separate thread for the new rider. Delivery completion/cancellation makes the conversation read-only. Photos, read receipts, typing and private update signals use the existing chat infrastructure.

Kitchen staff/support cannot claim or browse this private rider channel. Customers can still open a separate kitchen support conversation for operational help.

## One customer progress display

The horizontal chained tracker remains, including recorded stage times, current status, ETA, rider contact and location freshness. The lower expandable activity timeline has been removed. It originally exposed the same events with extra notes, but duplicated the customer progress display. Cancellation/decline reasons remain visible as a concise exception note, and database event history is preserved.

## Ordering assistance

The reported Sobolo and two-Ampesi requests now produce meal-review cards instead of another menu dump. Bounded ordering intent and recent customer context are handled deterministically before the small local FAQ model, with current catalogue IDs, names and availability. The quantity is prefilled for review.

Reviewing a card loads the current menu and opens the existing meal-options dialog. Only the customer's Add to bag confirmation changes the actual versioned cart. Checkout remains the place to review fulfillment, fees and payment and place the order. The assistant does not claim to have placed or paid for anything. Sensitive requests still hand over to staff.

This is scoped restaurant assistance, not a general autonomous agent. Ambiguous or unsupported requests need clarification or a person.

## Busy kitchen queue

New, Preparing and Ready menus show server-derived counts for the current filters. New contains orders waiting for approval. Accepted orders move to Preparing, alongside cooking orders. Ready contains packed and dispatched orders. Compact tickets show at most 12 orders per page.

Search by order/customer, pickup/delivery, owner kitchen filter and oldest/newest sorting are server-side. Oldest-first is the default. Counts are not taken from the former capped 200-order list. Page bounds adjust as orders move between stages. Existing review dialogs, kitchen operating controls, permission checks and transitions remain in place.

## System and disk space

See [system-and-storage.md](system-and-storage.md) for the component diagram, local database connection, measured usage and storage options. The main PostgreSQL database measured 23 MB. Docker's VHDX measured 34.63 GiB; Windows paging and hibernation files measured 12 and 9.52 GiB. These explain current usage, not a proven breakdown of the whole overnight change.

The owner approved unused build-cache removal after verification. Database/photo/model volumes, application images, Windows system files and virtual-disk location will be preserved. Unused build-cache cleanup completed: Docker reported 19.6 GB removed and now reports zero build cache. Named image inventory and all 11 volume names were identical before/after. Windows C: free space measured 21.43 GiB before and 21.34 GiB immediately after; this operation freed Docker-internal storage without returning that amount to Windows. VHDX compaction or relocation is a separate next step.

## Recovery and verification

- Database/photo backup created before the change: data/backups/mimiz-2026-10-22T16-59-51-171Z.json.
- Changed source snapshot: ignored data/improvements-20261022/before.
- Prior web image retained as mimiz-fresh-web:before-chat-queue-20261022. The exact prior API image could not be retagged following a Docker engine restart; the older mimiz-fresh-api:pre-promotion-20261022 image and source/database backups remain available.
- Migration 010 is additive: separate rider-channel metadata and structured assistant meal actions.
- Empty-installation rehearsal passed: ten migrations, idempotent rerun, one owner/company, no demo kitchens or orders.
- TypeScript checks passed; 99 unit cases passed, including four ordering-intent regressions (unchanged domain/security results reused).
- Production API and web images built and activated. Docker engine restart was handled without deleting volumes.
- Focused acceptance passed: 5 cases passed, 3 intentional duplicate-service skips.
- Full consolidated browser acceptance passed: 59 passed, 23 intentional duplicate-service skips, zero failures (9.2 minutes).
- Actual customer and rider portal tabs exchanged delivery messages; reassignment, stranger/staff denial and completion read-only behavior passed.
- The reported Sobolo/two-Ampesi messages produced correct meal-review actions; the cart stayed unchanged until customer confirmation, then contained two portions.
- A 13-order busy shift verified server pagination (12 plus 1), exact counts, stage movement, customer denial and light/dark accessibility.
- Queue layout passed 320/360/390px overflow checks and mobile light/dark accessibility.
- Customer tracking showed one horizontal stage chain and no lower activity timeline.
- Current-image PWA/private-cache and API log-privacy checks passed.


Cleanup evidence is in ignored data/improvements-20261022/cache-before.json, cache-after.json and cache-prune.txt. No databases, photos, models, named images or Windows paging/hibernation files were removed.
