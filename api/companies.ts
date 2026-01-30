import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getCompanies, getCompanyWithRelations } from '../lib/db';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { id } = req.query;

    // GET /api/companies/:id - Get single company with relations
    if (id && typeof id === 'string') {
      const companyId = parseInt(id);

      if (isNaN(companyId)) {
        return res.status(400).json({ error: 'Invalid company ID' });
      }

      const result = await getCompanyWithRelations(companyId);

      if (!result.company) {
        return res.status(404).json({ error: 'Company not found' });
      }

      return res.status(200).json(result);
    }

    // GET /api/companies - List companies with filters
    if (req.method === 'GET') {
      const { status, minScore, search, limit, offset } = req.query;

      const filters = {
        status: status as string | undefined,
        minScore: minScore ? parseInt(minScore as string) : undefined,
        search: search as string | undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        offset: offset ? parseInt(offset as string) : undefined,
      };

      const result = await getCompanies(filters);

      return res.status(200).json({
        companies: result.companies,
        total: result.total,
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
