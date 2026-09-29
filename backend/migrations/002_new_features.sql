CREATE TABLE IF NOT EXISTS potty_log (
  id SERIAL PRIMARY KEY,
  child_id INTEGER REFERENCES children(id) ON DELETE CASCADE,
  occurred_at TIMESTAMP,
  kind VARCHAR(30) NOT NULL,
  location VARCHAR(120),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS school_records (
  id SERIAL PRIMARY KEY,
  child_id INTEGER REFERENCES children(id) ON DELETE CASCADE,
  institution VARCHAR(255) NOT NULL,
  record_type VARCHAR(80) NOT NULL,
  record_date DATE,
  details TEXT,
  contact_name VARCHAR(255),
  contact_phone VARCHAR(60),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS insurance_policies (
  id SERIAL PRIMARY KEY,
  child_id INTEGER REFERENCES children(id) ON DELETE CASCADE,
  provider VARCHAR(255) NOT NULL,
  policy_number VARCHAR(120),
  coverage_type VARCHAR(120),
  effective_date DATE,
  expiry_date DATE,
  document_url TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS feeding_plans (
  id SERIAL PRIMARY KEY,
  child_id INTEGER REFERENCES children(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  plan_date DATE,
  meal_time TIME,
  foods TEXT,
  portion VARCHAR(120),
  allergens TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS immunization_schedule (
  id SERIAL PRIMARY KEY,
  child_id INTEGER REFERENCES children(id) ON DELETE CASCADE,
  vaccine_name VARCHAR(200) NOT NULL,
  dose_number INTEGER,
  due_date DATE,
  administered_date DATE,
  status VARCHAR(40) NOT NULL,
  provider VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
