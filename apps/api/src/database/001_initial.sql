CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS companies (id uuid PRIMARY KEY, name text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS branches (
 id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES companies(id), slug text UNIQUE NOT NULL, name text NOT NULL,
 code text NOT NULL UNIQUE, location geography(Point,4326) NOT NULL, address text NOT NULL, phone text NOT NULL,
 timezone text NOT NULL DEFAULT 'Africa/Accra', accepting boolean NOT NULL DEFAULT true,
 supports_cash boolean NOT NULL DEFAULT true, supports_delivery boolean NOT NULL DEFAULT true, supports_pickup boolean NOT NULL DEFAULT true,
 prep_minutes integer NOT NULL DEFAULT 25 CHECK(prep_minutes BETWEEN 5 AND 180),
 hours jsonb NOT NULL, closures jsonb NOT NULL DEFAULT '[]', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS branches_location_gist ON branches USING gist(location);
CREATE TABLE IF NOT EXISTS delivery_zones (
 id uuid PRIMARY KEY, branch_id uuid NOT NULL REFERENCES branches(id), name text NOT NULL,
 center geography(Point,4326), radius_m integer CHECK(radius_m > 0), polygon geography(Polygon,4326),
 fee integer NOT NULL CHECK(fee>=0), minimum integer NOT NULL CHECK(minimum>=0), eta_minutes integer NOT NULL,
 active boolean NOT NULL DEFAULT true, CHECK ((center IS NOT NULL AND radius_m IS NOT NULL) OR polygon IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS zones_center_gist ON delivery_zones USING gist(center);
CREATE INDEX IF NOT EXISTS zones_polygon_gist ON delivery_zones USING gist(polygon);
CREATE TABLE IF NOT EXISTS catalogue (
 id text PRIMARY KEY, company_id uuid NOT NULL REFERENCES companies(id), data jsonb NOT NULL,
 archived boolean NOT NULL DEFAULT false, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS branch_menu (
 branch_id uuid NOT NULL REFERENCES branches(id), item_id text NOT NULL REFERENCES catalogue(id),
 available boolean NOT NULL DEFAULT true, price integer CHECK(price>=0), stock integer CHECK(stock>=0),
 PRIMARY KEY(branch_id,item_id)
);
CREATE TABLE IF NOT EXISTS users (
 id uuid PRIMARY KEY, phone text UNIQUE, email text UNIQUE, name text NOT NULL, role text NOT NULL CHECK(role IN ('customer','kitchen_staff','rider','support_agent','branch_manager','super_admin')),
 branch_id uuid REFERENCES branches(id), password_hash text, active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sessions (
 id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id), token_hash text UNIQUE NOT NULL,
 family_id uuid NOT NULL, expires_at timestamptz NOT NULL, revoked_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS otp_challenges (
 id uuid PRIMARY KEY, phone text NOT NULL, hash text NOT NULL, attempts integer NOT NULL DEFAULT 0,
 expires_at timestamptz NOT NULL, consumed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS dev_outbox (
 id uuid PRIMARY KEY, channel text NOT NULL, recipient text NOT NULL, body text NOT NULL, segments integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS carts (
 id uuid PRIMARY KEY, owner_hash text UNIQUE NOT NULL, user_id uuid UNIQUE REFERENCES users(id), branch_id uuid NOT NULL REFERENCES branches(id),
 fulfillment text NOT NULL CHECK(fulfillment IN ('delivery','pickup')), selections jsonb NOT NULL DEFAULT '[]', promo_code text,
 version integer NOT NULL DEFAULT 1, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS addresses (
 id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id), label text NOT NULL, data jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS branch_day_counters (
 branch_id uuid NOT NULL REFERENCES branches(id), order_day date NOT NULL, last_seq integer NOT NULL,
 PRIMARY KEY(branch_id,order_day)
);
CREATE TABLE IF NOT EXISTS promotions (
 id uuid PRIMARY KEY, code text UNIQUE NOT NULL, type text NOT NULL CHECK(type IN ('fixed','percent','free_delivery')), value integer NOT NULL CHECK(value>=0),
 minimum integer NOT NULL DEFAULT 0, max_discount integer, branch_id uuid REFERENCES branches(id),
 starts_at timestamptz NOT NULL DEFAULT now(), ends_at timestamptz NOT NULL,
 total_limit integer, per_user_limit integer NOT NULL DEFAULT 1, first_order_only boolean NOT NULL DEFAULT false, active boolean NOT NULL DEFAULT true
);
CREATE TABLE IF NOT EXISTS orders (
 id uuid PRIMARY KEY, number text UNIQUE NOT NULL, branch_id uuid NOT NULL REFERENCES branches(id), user_id uuid NOT NULL REFERENCES users(id),
 fulfillment text NOT NULL CHECK(fulfillment IN ('delivery','pickup')), status text NOT NULL CHECK(status IN ('pending_payment','placed','accepted','preparing','ready','out_for_delivery','completed','cancelled','rejected')),
 payment_status text NOT NULL CHECK(payment_status IN ('pending','unpaid','succeeded','failed','refunded','partially_refunded')),
 payment_method text NOT NULL CHECK(payment_method IN ('cash','online')),
 items jsonb NOT NULL, subtotal integer NOT NULL CHECK(subtotal>=0), delivery_fee integer NOT NULL CHECK(delivery_fee>=0),
 service_fee integer NOT NULL DEFAULT 0, tax integer NOT NULL DEFAULT 0, discount integer NOT NULL DEFAULT 0, total integer NOT NULL CHECK(total>=0),
 address jsonb, note text NOT NULL DEFAULT '', promo_id uuid REFERENCES promotions(id), scheduled_for timestamptz,
 rider_id uuid REFERENCES users(id), estimated_ready_at timestamptz NOT NULL, estimated_delivery_at timestamptz,
 idempotency_key text UNIQUE NOT NULL, request_hash text NOT NULL, stock_released boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS orders_branch_status ON orders(branch_id,status,created_at);
CREATE INDEX IF NOT EXISTS orders_user_created ON orders(user_id,created_at DESC);
CREATE TABLE IF NOT EXISTS order_events (
 id uuid PRIMARY KEY, order_id uuid NOT NULL REFERENCES orders(id), from_status text, to_status text NOT NULL,
 actor_id uuid REFERENCES users(id), note text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS payments (
 id uuid PRIMARY KEY, order_id uuid NOT NULL REFERENCES orders(id), provider text NOT NULL, reference text UNIQUE NOT NULL,
 amount integer NOT NULL CHECK(amount>=0), status text NOT NULL DEFAULT 'pending', authorization_url text, simulated boolean NOT NULL,
 refunded_amount integer NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS mock_gateway_transactions (
 reference text PRIMARY KEY REFERENCES payments(reference), amount integer NOT NULL, status text NOT NULL DEFAULT 'pending', updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS webhook_events (
 id text PRIMARY KEY, provider text NOT NULL, payload jsonb NOT NULL, processed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS refunds (
 id uuid PRIMARY KEY, payment_id uuid NOT NULL REFERENCES payments(id), amount integer NOT NULL CHECK(amount>0),
 reason text NOT NULL, status text NOT NULL DEFAULT 'pending', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS notifications (
 id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id), order_id uuid REFERENCES orders(id), title text NOT NULL, body text NOT NULL, read_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS chat_threads (
 id uuid PRIMARY KEY, order_id uuid REFERENCES orders(id), user_id uuid NOT NULL REFERENCES users(id), branch_id uuid NOT NULL REFERENCES branches(id),
 closed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS chat_messages (
 id uuid PRIMARY KEY, thread_id uuid NOT NULL REFERENCES chat_threads(id), sender_id uuid NOT NULL REFERENCES users(id), body text NOT NULL,
 read_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS ratings (
 order_id uuid PRIMARY KEY REFERENCES orders(id), food integer NOT NULL CHECK(food BETWEEN 1 AND 5),
 delivery integer CHECK(delivery BETWEEN 1 AND 5), comment text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS rider_locations (
 order_id uuid PRIMARY KEY REFERENCES orders(id), rider_id uuid NOT NULL REFERENCES users(id), lat double precision NOT NULL, lng double precision NOT NULL, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS audit_logs (
 id uuid PRIMARY KEY, actor_id uuid REFERENCES users(id), action text NOT NULL, entity_id text, before_data jsonb, after_data jsonb, created_at timestamptz NOT NULL DEFAULT now()
);
