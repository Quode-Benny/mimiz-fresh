# Provider status

| Concern | Implemented | Verification limit |
| --- | --- | --- |
| Payments | Persistent mock; signed webhooks, verify, retries/refunds; Paystack adapter | Mock tested end to end. Paystack UNVERIFIED with merchant test/live credentials |
| SMS | Durable console outbox; Hubtel and Arkesel adapters; OTP and critical order notifications | Local contract tests use stub transport; sender approval and actual delivery unverified |
| Email | Console and Resend adapters | Contract tested; actual sender/domain and transactional workflows unverified |
| Maps | Leaflet/OSM, Ghana-only explicit Nominatim search, Redis cache/rate gate, Google geocoding/routing adapters | Provider transport contracts tested; public search availability and real route estimates need deployment acceptance |
| Images | Sharp-validated responsive public WebP and authenticated private chat photos through local/S3 storage | Local/S3 adapter and source-preserving hash-checked migration tool implemented; cloud bucket/credentials UNVERIFIED |
| Errors | Consistent error envelopes and local server logs | Console/Sentry error adapter and structured privacy-checked request logs implemented; live Sentry project/alerts UNVERIFIED |
| Push | VAPID subscription handling, durable retries, service-worker notifications | Subscription privacy/security tested; real browser-device delivery unverified |
| Jobs/realtime | Redis, BullMQ, portal-authenticated Socket.IO, polling fallback | Local database/queue/browser flows tested |

Selected external adapters require their configuration instead of silently falling back to mocks. Production blocks demo providers/OTP unless the explicit cash-only override is set. Live verification is a separate acceptance gate.

See installation.md for first-owner provisioning and secret handling, maps.md for public geocoder usage constraints, and backups.md for current backup scope.
