ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_preferences jsonb NOT NULL DEFAULT '{"push":true,"criticalSms":true,"promotions":false}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS internal_notes text NOT NULL DEFAULT '';
ALTER TABLE chat_threads ADD COLUMN IF NOT EXISTS claimed_by uuid REFERENCES users(id);
CREATE TABLE IF NOT EXISTS recommendation_events (
 id uuid PRIMARY KEY,user_id uuid REFERENCES users(id),branch_id uuid NOT NULL REFERENCES branches(id),item_id text NOT NULL REFERENCES catalogue(id),
 kind text NOT NULL CHECK(kind IN ('impression','click','add')),source text NOT NULL,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS recommendation_events_branch ON recommendation_events(branch_id,created_at);
