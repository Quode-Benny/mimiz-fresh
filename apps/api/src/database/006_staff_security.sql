ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_secret text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_pending text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_pending_expires timestamptz;
ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_last_counter bigint NOT NULL DEFAULT -1;
ALTER TABLE users ADD COLUMN IF NOT EXISTS recovery_codes jsonb NOT NULL DEFAULT '[]';
CREATE INDEX IF NOT EXISTS chat_messages_retention ON chat_messages(created_at);
CREATE INDEX IF NOT EXISTS chat_attachments_retention ON chat_attachments(created_at);
