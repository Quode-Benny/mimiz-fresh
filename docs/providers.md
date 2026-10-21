# Provider status

| Concern | Local implementation | Live status |
| --- | --- | --- |
| Payments | Persistent mock gateway; HMAC-SHA512 webhooks; verify/refund; BullMQ delivery and retries | Paystack source implemented, UNVERIFIED with real/test credentials |
| Customer SMS | Hashed random OTP persisted with a Dev Inbox record; explicit demo code | Live adapter outstanding; console mode only is supported |
| Email | No transactional flows yet | Console/live email adapters outstanding |
| Maps | Leaflet + OpenStreetMap display; browser geolocation; PostGIS radius matching | Google/Nominatim provider integration outstanding |
| Images | Local ignored data/uploads; Sharp validation + responsive WebP; immutable public paths | S3 and storage migration outstanding |
| Errors | Server logs and consistent API error responses | Sentry adapter outstanding |
| Realtime/jobs | Real Redis, Socket.IO and BullMQ | No external paid provider required |
| Push | PWA shell present | VAPID push delivery outstanding |

Secrets stay in ignored environment files. A provider selected without an implemented adapter must fail startup rather than quietly use simulated behaviour. Live adapter verification is a separate acceptance gate, never inferred from a successful local build.
