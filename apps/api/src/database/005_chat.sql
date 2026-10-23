ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]';
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS flagged boolean NOT NULL DEFAULT false;
CREATE TABLE IF NOT EXISTS chat_attachments(
 id uuid PRIMARY KEY,thread_id uuid NOT NULL REFERENCES chat_threads(id),user_id uuid NOT NULL REFERENCES users(id),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS chat_messages_thread_created ON chat_messages(thread_id,created_at);
CREATE INDEX IF NOT EXISTS chat_threads_branch ON chat_threads(branch_id,created_at);
