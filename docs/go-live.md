# Go-live acceptance

The local demo is not an approved live-sales environment. Complete the full v1 status checklist before deployment.

1. Replace fictional branch, hours, fees, menu, allergens and photography with approved owner data. Confirm tax, service-fee, refund and cancellation policies.
2. Run live-account acceptance for the implemented provider adapters; transport contract tests alone are insufficient. Validate Paystack using test keys: success, MoMo timeout, decline/retry, duplicate webhook, delayed success, refund and settlement reconciliation.
3. Use live SMS for OTP, disable OTP_DEMO_MODE, verify sender identity and delivery. Verify transactional email and contextual web push.
4. Configure HTTPS, restricted origins, secure cookies, trusted-proxy rules, private storage/CDN, persistent volumes, encrypted off-site backups and production restore rehearsal, logs/alerts and secret rotation. Local S3/Sentry adapters and development recovery tools do not establish deployment readiness.
5. Run unit, integration, concurrency, ownership/RBAC, migration, production guard, Playwright, accessibility and bundle/performance checks. Complete the remaining status checklist.
6. Create a production owner account through an explicit provisioning command. Do not seed demo data into production.
7. Ensure ALLOW_MOCK_IN_PRODUCTION is false, provider statuses are live/verified, and a small real charge/refund completes before public launch.

Cash-only soft launch requires an explicit owner decision, completed operational acceptance and real customer authentication. Do not enable the production override automatically.
