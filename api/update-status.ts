import type { VercelRequest, VercelResponse } from '@vercel/node';
import { updateCompany } from '../lib/db';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'PATCH') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { id } = req.query;
    const { status, qualification_score } = req.body;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Company ID is required' });
    }

    const companyId = parseInt(id);

    if (isNaN(companyId)) {
      return res.status(400).json({ error: 'Invalid company ID' });
    }

    // Validate status if provided
    if (status && !['unqualified', 'qualified', 'rejected'].includes(status)) {
      return res.status(400).json({
        error: 'Invalid status',
        message: 'Status must be one of: unqualified, qualified, rejected',
      });
    }

    console.log(`Updating company ${companyId}: status=${status}, score=${qualification_score}`);

    const updates: any = {};
    if (status) updates.status = status;
    if (qualification_score !== undefined) updates.qualification_score = qualification_score;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const updatedCompany = await updateCompany(companyId, updates);

    if (!updatedCompany) {
      return res.status(404).json({ error: 'Company not found' });
    }

    return res.status(200).json({
      company: updatedCompany,
      message: 'Company updated successfully',
    });
  } catch (error) {
    console.error('Update Status Error:', error);
    return res.status(500).json({
      error: 'Failed to update company',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
