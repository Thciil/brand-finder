import Database from 'better-sqlite3';

export function initializeSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS companies (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      wikipedia_url TEXT,
      website_url TEXT,
      category TEXT,
      region TEXT,
      status TEXT DEFAULT 'unqualified',
      qualification_score INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sponsorship_signals (
      id INTEGER PRIMARY KEY,
      company_id INTEGER REFERENCES companies(id),
      signal_type TEXT NOT NULL,
      signal_text TEXT,
      source_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS contact_paths (
      id INTEGER PRIMARY KEY,
      company_id INTEGER REFERENCES companies(id),
      path_type TEXT NOT NULL,
      value TEXT NOT NULL,
      email_type TEXT,
      confidence_score INTEGER DEFAULT 0,
      source_url TEXT,
      is_primary INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS people (
      id INTEGER PRIMARY KEY,
      company_id INTEGER REFERENCES companies(id),
      name TEXT NOT NULL,
      job_title TEXT,
      department TEXT,
      source_url TEXT,
      linkedin_search_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS outreach (
      id INTEGER PRIMARY KEY,
      company_id INTEGER REFERENCES companies(id),
      contact_path_id INTEGER REFERENCES contact_paths(id),
      person_id INTEGER REFERENCES people(id),
      subject TEXT,
      body TEXT,
      status TEXT DEFAULT 'draft',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS followups (
      id INTEGER PRIMARY KEY,
      outreach_id INTEGER REFERENCES outreach(id),
      day_offset INTEGER NOT NULL,
      message TEXT,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_companies_status ON companies(status);
    CREATE INDEX IF NOT EXISTS idx_companies_category ON companies(category);
    CREATE INDEX IF NOT EXISTS idx_contact_paths_company ON contact_paths(company_id);
    CREATE INDEX IF NOT EXISTS idx_people_company ON people(company_id);
    CREATE INDEX IF NOT EXISTS idx_signals_company ON sponsorship_signals(company_id);
  `);
}

export interface Company {
  id: number;
  name: string;
  wikipedia_url: string | null;
  website_url: string | null;
  category: string | null;
  region: string | null;
  status: 'unqualified' | 'qualified' | 'rejected';
  qualification_score: number;
  created_at: string;
}

export interface SponsorshipSignal {
  id: number;
  company_id: number;
  signal_type: string;
  signal_text: string | null;
  source_url: string | null;
  created_at: string;
}

export interface ContactPath {
  id: number;
  company_id: number;
  path_type: 'email' | 'form' | 'agency' | 'press' | 'linkedin';
  value: string;
  email_type: string | null;
  confidence_score: number;
  source_url: string | null;
  is_primary: number;
  created_at: string;
}

export interface Person {
  id: number;
  company_id: number;
  name: string;
  job_title: string | null;
  department: string | null;
  source_url: string | null;
  linkedin_search_url: string | null;
  created_at: string;
}

export interface Outreach {
  id: number;
  company_id: number;
  contact_path_id: number | null;
  person_id: number | null;
  subject: string | null;
  body: string | null;
  status: 'draft' | 'sent' | 'replied';
  created_at: string;
}

export interface Followup {
  id: number;
  outreach_id: number;
  day_offset: number;
  message: string | null;
  status: 'pending' | 'sent' | 'skipped';
  created_at: string;
}
