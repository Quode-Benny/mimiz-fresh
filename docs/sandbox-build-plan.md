# Sandbox build plan - 22 October 2026

Status: owner approved promotion on 22 October 2026. The main app is running the approved candidate; see promotion-2026-10-22.md for verification and recovery evidence.

## Isolation and review

- Accepted local app: G:/CODE~BENNY/Projects/DEV/mimiz-fresh, http://localhost:3002.
- Experimental source: G:/CODE~BENNY/Projects/DEV/mimiz-fresh-sandbox.
- Review target: production-built web at http://127.0.0.1:3006 with sandbox API on 4006.
- Separate Compose project, database/Redis/photo volumes, generated credentials and fictional seed data. No live merchant, messaging or customer data.
- Use the exact sandbox host above; review does not publish or replace the accepted app.
- Owner review and acceptance are required before promoting the candidate to the existing application. No automatic merge, public deployment or live-provider activation.
- This PC must remain awake for local work. No off-PC worker is configured.

## Requested work

1. Food tracking and approvals: readable fulfillment stages, explicit kitchen acceptance, truthful ETA/delay states, rider contact/location freshness, activity history and review/confirmation of consequential actions. Preserve server permissions, transition validation and payment separation.
2. Administration: modern sidebar, clear tool grouping/search, branch context, selected state, uncluttered panels and usable mobile navigation. Preserve current business logic and role boundaries.
3. Lively customer experience: real-menu spotlight slider, optional food-finder popup, useful banners, subtle transitions and accessible drawers. Respect reduced motion; avoid forced popups, fake urgency, fake reviews or invented offers.
4. Customer profile: identity summary, clear section navigation, saved places, notification controls, order shortcuts, support access and deliberate destructive-action handling. Keep actual data and privacy controls.
5. Whole-system design: coherent copper/teal/ink palette, typography, spacing, surfaces, states, icons and responsive composition across customer/staff/admin/rider views.
6. Theme: persisted light/dark/system choice, operating-system changes, readable forms/dialogs/charts and reduced-motion support. Avoid a bright flash before dark rendering.
7. Zero-spend AI support: local Ollama integration, clearly identified assistant, current restaurant/order context, strict authorization, no payment/order mutation authority, customer-requested handover and automatic handover for sensitive/uncertain/failed responses. Staff can claim the same conversation with its history. No cloud API keys or paid models.
8. The original list's eighth entry is blank; no additional requirement is inferred.

## Research and bounded experiments

Search primary food-ordering sites and official help pages for relevant patterns. Record the source, proposed value, implemented behavior and review status. Adapt patterns to a Ghanaian single-restaurant platform; do not copy another site's layout or introduce wallets, subscriptions, paid integrations or marketplace scope without agreement.

Candidate extras: active-order resume banner, readable delayed-order state, taste-based discovery, quick support prompts and searchable admin tools. All remain sandbox-only until accepted.

## Build sequence

- [x] Review existing screens, workflows and support persistence.
- [x] Confirm local-model / zero-spend preference.
- [x] Create isolated source, service ports and fresh secrets.
- [x] Integrate visual tokens, theme and shared interactive components.
- [x] Refine customer discovery, profile, tracking and approval review.
- [x] Modernize administration and operational surfaces.
- [x] Implement local assistant and persistent human handover.
- [x] Verify types, unit/provider contracts, permission boundaries, key browser flows, WCAG and both themes.
- [x] Build and launch the production-mode sandbox preview; document exact review links, credentials location, results and outstanding limitations.
- [x] Owner reviews and explicitly accepts changes before promotion.

## Acceptance evidence

Record actual results, not expected results. Review mobile and desktop, light/dark/system, keyboard/dialog focus, reduced motion, profile persistence, approval transitions and local-model unavailable/handover behavior. A model adapter contract test is distinct from a real downloaded-model run. No live-model claim without a successful local runtime/model check.

## Research references

- Uber Eats order-status help: https://help.uber.com/en/ubereats/restaurants/article/node-title?nodeId=4148ea8b-c9d8-409d-b7bf-b2fcb019a498
  Pattern: active-order entry point, status description, assigned-rider location. Candidate: real-order progress and resume banner.
- Uber Eats delayed-order help: https://help.uber.com/en-GB/ubereats/restaurants/article/my-order-is-taking-longer-than-expected-?nodeId=d80a5816-bb48-4143-a3c8-e0c5b2420fb4
  Pattern: distinguish restaurant preparation and rider contact. Candidate: truthful overdue estimate and contextual help.
- Tock delivery/takeout: https://www.exploretock.com/join/restaurant-delivery-takeout-software/
  Pattern: clear pickup scheduling. Existing server-validated scheduled ordering stays in scope.
- Ollama chat API: https://docs.ollama.com/api/chat
  Use local inference with bounded context and structured output; no external model service.

Additional Ghana-focused research: https://help.chowdeck.com/en/articles/16879093-how-do-i-track-the-status-of-my-order and https://hubtel.com/consumer support a clear status timeline, assigned-rider tracking and a quick return to an active order. The sandbox adapts those interaction patterns to its existing server statuses; it does not add unsupported rider stages or copy a competitor layout.
