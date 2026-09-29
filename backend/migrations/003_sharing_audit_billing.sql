-- Caregiver sharing, audit trail, and billing subscription stub.
-- Idempotent: safe to run repeatedly via scripts/apply-migrations.js.
BEGIN;

CREATE TABLE IF NOT EXISTS child_caregivers (
  id SERIAL PRIMARY KEY,
  child_id INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL CHECK(role IN('guardian','caregiver')),
  status VARCHAR(20) NOT NULL DEFAULT 'invited' CHECK(status IN('invited','active','revoked')),
  invited_by INTEGER,
  invite_token VARCHAR(80) UNIQUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(child_id,user_id)
);

CREATE TABLE IF NOT EXISTS audit_events (
  id SERIAL PRIMARY KEY,
  user_id INTEGER,
  action VARCHAR(80) NOT NULL,
  entity VARCHAR(60) NOT NULL,
  entity_id INTEGER,
  details JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER UNIQUE NOT NULL,
  plan VARCHAR(40) NOT NULL DEFAULT 'free',
  status VARCHAR(40) NOT NULL DEFAULT 'inactive',
  stripe_customer_id VARCHAR(120),
  stripe_subscription_id VARCHAR(120),
  current_period_end TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS child_caregivers_child_idx ON child_caregivers(child_id);
CREATE INDEX IF NOT EXISTS child_caregivers_user_idx ON child_caregivers(user_id);
CREATE INDEX IF NOT EXISTS audit_events_child_idx ON audit_events(entity, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_events_user_idx ON audit_events(user_id, created_at DESC);

COMMIT;
