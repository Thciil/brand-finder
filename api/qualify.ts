import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql, updateCompany, getCompanyWithRelations } from '../lib/db';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { id } = req.query;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Company ID is required' });
    }

    const companyId = parseInt(id);

    if (isNaN(companyId)) {
      return res.status(400).json({ error: 'Invalid company ID' });
    }

    console.log(`Starting qualification for company ID: ${companyId}`);

    // Get company details
    const { company } = await getCompanyWithRelations(companyId);

    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    if (!company.website_url) {
      return res.status(400).json({
        error: 'Company has no website URL',
        message: 'Cannot qualify a company without a website',
      });
    }

    // TODO: Implement full qualification pipeline
    // For now, create placeholder signals and contacts

    // Add sample partnership signal
    await sql`
      INSERT INTO sponsorship_signals (company_id, signal_type, signal_text, source_url)
      VALUES (
        ${companyId},
        'partnership',
        'Sample signal: Partnership opportunities available',
        ${company.website_url}
      )
      ON CONFLICT DO NOTHING
    `;

    // Add sample contact path
    const emailDomain = new URL(company.website_url).hostname;
    await sql`
      INSERT INTO contact_paths (company_id, path_type, value, email_type, confidence_score, is_primary)
      VALUES (
        ${companyId},
        'email',
        ${'partnerships@' + emailDomain},
        'partnerships',
        100,
        true
      )
      ON CONFLICT DO NOTHING
    `;

    // Update company status and score
    const updatedCompany = await updateCompany(companyId, {
      status: 'qualified',
      qualification_score: 75, // Placeholder score
    });

    // Get updated company with relations
    const result = await getCompanyWithRelations(companyId);

    return res.status(200).json({
      ...result,
      message: 'Company qualification complete (simplified version)',
      note: 'Full qualification pipeline will be added in a future update',
    });
  } catch (error) {
    console.error('Qualification Error:', error);
    return res.status(500).json({
      error: 'Failed to qualify company',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
