CREATE TABLE IF NOT EXISTS photo_deletions(
 key text PRIMARY KEY CHECK(key ~ '^chat/[a-f0-9-]{36}[.]webp$'),
 attempts integer NOT NULL DEFAULT 0,
 next_attempt_at timestamptz NOT NULL DEFAULT now(),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS photo_deletions_due ON photo_deletions(next_attempt_at);
