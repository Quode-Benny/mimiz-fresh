ALTER TABLE chat_threads ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'support' CHECK(channel IN ('support','rider'));
ALTER TABLE chat_threads ADD COLUMN IF NOT EXISTS rider_id uuid REFERENCES users(id);
ALTER TABLE chat_threads ADD CONSTRAINT rider_chat_requires_order CHECK(channel <> 'rider' OR (order_id IS NOT NULL AND rider_id IS NOT NULL));
CREATE UNIQUE INDEX IF NOT EXISTS rider_chat_assignment ON chat_threads(order_id,rider_id) WHERE channel='rider';
ALTER TABLE chat_assistant_messages ADD COLUMN IF NOT EXISTS actions jsonb NOT NULL DEFAULT '[]';
