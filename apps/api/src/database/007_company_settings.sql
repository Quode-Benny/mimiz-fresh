ALTER TABLE companies ADD COLUMN IF NOT EXISTS contact jsonb NOT NULL DEFAULT '{}';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS logo text NOT NULL DEFAULT '';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS settings jsonb NOT NULL DEFAULT '{"serviceFee":{"kind":"fixed","value":0},"taxBps":0,"taxDelivery":false,"dayparts":[{"id":"breakfast","label":"Breakfast","start":"05:00","end":"11:00"},{"id":"lunch","label":"Lunch","start":"11:00","end":"15:00"},{"id":"afternoon","label":"Afternoon","start":"15:00","end":"18:00"},{"id":"dinner","label":"Dinner","start":"18:00","end":"22:00"},{"id":"late_night","label":"Late night","start":"22:00","end":"05:00"}],"flags":{"onlinePayments":true,"recommendations":true,"promotions":true,"scheduling":true}}';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS settings_updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE branches ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS extra_prep_minutes integer NOT NULL DEFAULT 0 CHECK(extra_prep_minutes BETWEEN 0 AND 120);
CREATE TABLE IF NOT EXISTS categories(
 id uuid PRIMARY KEY,company_id uuid NOT NULL REFERENCES companies(id),name text NOT NULL,description text NOT NULL DEFAULT '',
 image text NOT NULL DEFAULT '',sort_order integer NOT NULL DEFAULT 100,active boolean NOT NULL DEFAULT true,parent_id uuid REFERENCES categories(id),
 UNIQUE(company_id,name)
);
INSERT INTO categories(id,company_id,name)
 SELECT gen_random_uuid(),company_id,data->>'category' FROM catalogue GROUP BY company_id,data->>'category'
ON CONFLICT(company_id,name) DO NOTHING;
