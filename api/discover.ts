import type { VercelRequest, VercelResponse } from '@vercel/node';
import { discoverCompanies } from '../lib/discovery';

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
    const { keywords, region, limit } = req.body;

    if (!keywords || typeof keywords !== 'string') {
      return res.status(400).json({ error: 'Keywords are required' });
    }

    console.log(`Starting discovery for keywords: ${keywords}`);

    const result = await discoverCompanies(
      keywords,
      region,
      limit || 50
    );

    return res.status(200).json({
      added: result.added,
      companies: result.companies,
      message: `Successfully discovered ${result.added} companies`,
    });
  } catch (error) {
    console.error('Discovery Error:', error);
    return res.status(500).json({
      error: 'Failed to discover companies',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
