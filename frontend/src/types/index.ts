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
  is_primary: boolean;
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

export interface CompanyWithRelations {
  company: Company;
  signals: SponsorshipSignal[];
  contacts: ContactPath[];
  people: Person[];
  outreach: Outreach[];
}
