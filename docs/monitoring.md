# Local observability and optional Sentry

Every completed API request writes a JSON record containing a generated request ID, HTTP method, route template, status and elapsed milliseconds. It does not log request bodies, query strings, cookies, authorization headers, customer names or addresses. X-Request-Id lets a customer-facing failure be correlated with server records.

Unexpected API, worker, reconciliation and startup errors use ErrorProvider. Console mode is the default and sends no external telemetry. Events contain the error type, sanitized error code, component, route/request metadata and source basenames/line numbers. Raw exception messages and absolute stack paths are excluded. Expected validation and permission failures remain normal API responses.

ERROR_PROVIDER=sentry plus SENTRY_DSN enables a small Sentry envelope adapter. It preserves a local metadata record, sends only the same restricted event, requires HTTPS and rejects password-bearing DSNs. Delivery is best effort, times out after three seconds, allows five concurrent sends and fifty events per minute per process, and honors provider rate-limit/retry headers. Failure of telemetry delivery never changes an order response. This is error reporting, not distributed tracing or session replay.

The Sentry transport has local contract tests, including event framing, privacy, rate limits and bounded concurrency. No live Sentry project/DSN has been verified or activated.

Application container JSON logs are size-limited. Production still requires an owner-selected collection destination, retention/access policy, alert routing, uptime checks, dashboard review and an incident/recovery rehearsal.

Protocol references: [Sentry envelope format](https://develop.sentry.dev/sdk/envelopes/) and [Sentry's reference transport](https://github.com/getsentry/sentry-go/blob/master/transport.go).
