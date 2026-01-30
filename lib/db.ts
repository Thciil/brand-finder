import { sql } from '@vercel/postgres';
import type {
  Company,
  SponsorshipSignal,
  ContactPath,
  Person,
  Outreach,
  Followup,
} from '../src/db/schema';

// Export the sql function from @vercel/postgres
// This automatically uses the POSTGRES_URL environment variable
export { sql };

// Helper function to get a company by ID with all related data
export async function getCompanyWithRelations(companyId: number) {
  const [company, signals, contacts, people, outreach] = await Promise.all([
    sql<Company>`SELECT * FROM companies WHERE id = ${companyId}`,
    sql<SponsorshipSignal>`SELECT * FROM sponsorship_signals WHERE company_id = ${companyId}`,
    sql<ContactPath>`SELECT * FROM contact_paths WHERE company_id = ${companyId} ORDER BY confidence_score DESC`,
    sql<Person>`SELECT * FROM people WHERE company_id = ${companyId}`,
    sql<Outreach>`SELECT * FROM outreach WHERE company_id = ${companyId} ORDER BY created_at DESC`,
  ]);

  return {
    company: company.rows[0] || null,
    signals: signals.rows,
    contacts: contacts.rows,
    people: people.rows,
    outreach: outreach.rows,
  };
}

// Helper function to get all companies with optional filters
export async function getCompanies(filters: {
  status?: string;
  minScore?: number;
  search?: string;
  limit?: number;
  offset?: number;
}) {
  const { status, minScore, search, limit = 50, offset = 0 } = filters;

  let query = 'SELECT * FROM companies WHERE 1=1';
  const params: any[] = [];

  if (status) {
    params.push(status);
    query += ` AND status = $${params.length}`;
  }

  if (minScore !== undefined) {
    params.push(minScore);
    query += ` AND qualification_score >= $${params.length}`;
  }

  if (search) {
    params.push(`%${search}%`);
    query += ` AND (name ILIKE $${params.length} OR website_url ILIKE $${params.length})`;
  }

  query += ` ORDER BY qualification_score DESC`;
  params.push(limit);
  query += ` LIMIT $${params.length}`;
  params.push(offset);
  query += ` OFFSET $${params.length}`;

  const result = await sql.query(query, params);

  // Get total count
  let countQuery = 'SELECT COUNT(*) as count FROM companies WHERE 1=1';
  const countParams: any[] = [];

  if (status) {
    countParams.push(status);
    countQuery += ` AND status = $${countParams.length}`;
  }

  if (minScore !== undefined) {
    countParams.push(minScore);
    countQuery += ` AND qualification_score >= $${countParams.length}`;
  }

  if (search) {
    countParams.push(`%${search}%`);
    countQuery += ` AND (name ILIKE $${countParams.length} OR website_url ILIKE $${countParams.length})`;
  }

  const countResult = await sql.query(countQuery, countParams);

  return {
    companies: result.rows,
    total: parseInt(countResult.rows[0].count),
  };
}

// Helper function to create a company
export async function createCompany(data: {
  name: string;
  wikipedia_url?: string;
  website_url?: string;
  category?: string;
  region?: string;
}) {
  const result = await sql<Company>`
    INSERT INTO companies (name, wikipedia_url, website_url, category, region)
    VALUES (${data.name}, ${data.wikipedia_url || null}, ${data.website_url || null}, ${data.category || null}, ${data.region || null})
    RETURNING *
  `;

  return result.rows[0];
}

// Helper function to update a company
export async function updateCompany(
  companyId: number,
  data: Partial<Omit<Company, 'id' | 'created_at'>>
) {
  const fields: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  Object.entries(data).forEach(([key, value]) => {
    fields.push(`${key} = $${paramIndex}`);
    values.push(value);
    paramIndex++;
  });

  if (fields.length === 0) {
    throw new Error('No fields to update');
  }

  values.push(companyId);
  const query = `UPDATE companies SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`;

  const result = await sql.query(query, values);
  return result.rows[0];
}

// Helper function to delete a company
export async function deleteCompany(companyId: number) {
  await sql`DELETE FROM companies WHERE id = ${companyId}`;
}

// Export types for convenience
export type {
  Company,
  SponsorshipSignal,
  ContactPath,
  Person,
  Outreach,
  Followup,
};
