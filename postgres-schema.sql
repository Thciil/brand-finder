-- Postgres Schema for Sponsor Pathfinder
-- Converted from SQLite schema in src/db/schema.ts

-- Companies table: stores discovered companies
CREATE TABLE IF NOT EXISTS companies (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  wikipedia_url TEXT,
  website_url TEXT,
  category TEXT,
  region TEXT,
  status TEXT DEFAULT 'unqualified' CHECK (status IN ('unqualified', 'qualified', 'rejected')),
  qualification_score INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sponsorship signals: detected indicators of sponsorship fit
CREATE TABLE IF NOT EXISTS sponsorship_signals (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  signal_type TEXT NOT NULL,
  signal_text TEXT,
  source_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Contact paths: ways to reach the company
CREATE TABLE IF NOT EXISTS contact_paths (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  path_type TEXT NOT NULL CHECK (path_type IN ('email', 'form', 'agency', 'press', 'linkedin')),
  value TEXT NOT NULL,
  email_type TEXT,
  confidence_score INTEGER DEFAULT 0,
  source_url TEXT,
  is_primary BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- People: decision makers at companies
CREATE TABLE IF NOT EXISTS people (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  job_title TEXT,
  department TEXT,
  source_url TEXT,
  linkedin_search_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Outreach: generated sponsorship messages
CREATE TABLE IF NOT EXISTS outreach (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  contact_path_id INTEGER REFERENCES contact_paths(id) ON DELETE SET NULL,
  person_id INTEGER REFERENCES people(id) ON DELETE SET NULL,
  subject TEXT,
  body TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'replied')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Followups: follow-up message sequences
CREATE TABLE IF NOT EXISTS followups (
  id SERIAL PRIMARY KEY,
  outreach_id INTEGER NOT NULL REFERENCES outreach(id) ON DELETE CASCADE,
  day_offset INTEGER NOT NULL,
  message TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'skipped')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for query performance
CREATE INDEX IF NOT EXISTS idx_companies_status ON companies(status);
CREATE INDEX IF NOT EXISTS idx_companies_category ON companies(category);
CREATE INDEX IF NOT EXISTS idx_companies_score ON companies(qualification_score DESC);
CREATE INDEX IF NOT EXISTS idx_contact_paths_company ON contact_paths(company_id);
CREATE INDEX IF NOT EXISTS idx_people_company ON people(company_id);
CREATE INDEX IF NOT EXISTS idx_signals_company ON sponsorship_signals(company_id);
CREATE INDEX IF NOT EXISTS idx_outreach_company ON outreach(company_id);
CREATE INDEX IF NOT EXISTS idx_followups_outreach ON followups(outreach_id);
