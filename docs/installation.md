# Installation and owner security

Local setup runs a demonstration. Production seeding is disabled: NODE_ENV=production never inserts the fictional kitchen or demo owner.

For a new installation, configure an empty PostgreSQL/PostGIS database and run `node scripts/database.mjs migrate`. Ordered forward migrations run under a database advisory lock without starting queues or calling providers.

Set COMPANY_NAME and OWNER_EMAIL, then run `node scripts/database.mjs provision`. An optional OWNER_PASSWORD must have at least 16 characters; otherwise a random password is generated. Provisioning refuses an existing company/owner and never overwrites credentials. The ignored .provisioned-owner file contains the initial credentials. Restrict its Windows ACL or Unix permissions and transfer it to the owner's password manager. Configure approved kitchens, menus, hours, delivery coverage and operating settings through administration before opening orders.

Use HTTPS origins and unique JWT_SECRET, MOCK_WEBHOOK_SECRET, TOTP_ENCRYPTION_KEY and VAPID keys in production. Verify live provider accounts separately. Production refuses simulated providers and demo OTP unless the explicit cash-only soft-launch override is enabled.

Staff can enrol an authenticator through their portal's Security page. Setup and disabling require the current password. Login then requires a TOTP or a one-use recovery code. Store the ten recovery codes privately. The owner has not been enrolled automatically.

Back up TOTP_ENCRYPTION_KEY with encrypted deployment secrets: losing it prevents decryption of enrolled authenticators. Rotation requires an audited migration/re-enrolment plan. Data backups exclude .env and owner credentials; secure those separately.

The browser acceptance suite creates users, orders, messages and audit records. Run it only against a dedicated development/test installation.
