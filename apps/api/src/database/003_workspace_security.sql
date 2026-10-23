ALTER TABLE sessions ADD COLUMN IF NOT EXISTS portal text NOT NULL DEFAULT 'mimiz';
CREATE INDEX IF NOT EXISTS sessions_family ON sessions(family_id);
