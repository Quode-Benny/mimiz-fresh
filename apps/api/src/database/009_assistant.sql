ALTER TABLE chat_threads ADD COLUMN IF NOT EXISTS support_mode text NOT NULL DEFAULT 'human' CHECK(support_mode IN ('assistant','human'));
ALTER TABLE chat_threads ADD COLUMN IF NOT EXISTS handover_reason text;
ALTER TABLE chat_threads ADD COLUMN IF NOT EXISTS handover_at timestamptz;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS assistant_requested_at timestamptz;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS assistant_processed_at timestamptz;
CREATE TABLE IF NOT EXISTS chat_assistant_messages(
 id uuid PRIMARY KEY,thread_id uuid NOT NULL REFERENCES chat_threads(id),reply_to uuid UNIQUE REFERENCES chat_messages(id) ON DELETE CASCADE,
 body text NOT NULL,source text NOT NULL CHECK(source IN ('assistant','system')),created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS assistant_pending ON chat_messages(assistant_requested_at) WHERE assistant_requested_at IS NOT NULL AND assistant_processed_at IS NULL;
