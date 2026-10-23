CREATE TABLE IF NOT EXISTS notification_templates(
 event text PRIMARY KEY,title text NOT NULL,body text NOT NULL,sms boolean NOT NULL DEFAULT false
);
INSERT INTO notification_templates(event,title,body,sms) VALUES
 ('placed','Order {{number}} is in','Your order is with the kitchen.',true),
 ('accepted','The kitchen has accepted {{number}}','Your meal will be prepared soon.',false),
 ('preparing','Cooking your favourites','Order {{number}} is being prepared.',false),
 ('ready','Fresh and ready','Order {{number}} is ready.',false),
 ('out_for_delivery','Your meal is on its way','Order {{number}} is with your rider.',true),
 ('completed','Enjoy your meal','Order {{number}} has been completed. Thank you for choosing Mimiz.',false),
 ('cancelled','Order {{number}} was cancelled','Open your order for details and any refund updates.',true),
 ('rejected','The kitchen could not accept {{number}}','Open your order for details and any refund updates.',false),
 ('refunded','Refund update for {{number}}','Your payment refund has been processed.',false),
 ('chat','A message from Mimiz','You have a new message about order {{number}}.',false)
ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS push_subscriptions(
 id uuid PRIMARY KEY,user_id uuid NOT NULL REFERENCES users(id),endpoint text UNIQUE NOT NULL,keys jsonb NOT NULL,
 active boolean NOT NULL DEFAULT true,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS message_deliveries(
 id uuid PRIMARY KEY,notification_id uuid NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
 channel text NOT NULL CHECK(channel IN ('sms','push')),subscription_id uuid REFERENCES push_subscriptions(id) ON DELETE CASCADE,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sent','skipped','failed')),
 attempts integer NOT NULL DEFAULT 0,segments integer NOT NULL DEFAULT 0,next_attempt_at timestamptz NOT NULL DEFAULT now(),
 last_error text,sent_at timestamptz,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE NULLS NOT DISTINCT(notification_id,channel,subscription_id)
);
CREATE INDEX IF NOT EXISTS deliveries_pending ON message_deliveries(next_attempt_at) WHERE status='pending';
