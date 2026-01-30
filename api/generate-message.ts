import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql, getCompanyWithRelations } from '../lib/db';
import OpenAI from 'openai';

function getOpenAI(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is not set');
  }
  return new OpenAI({ apiKey });
}

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

    console.log(`Generating message for company ID: ${companyId}`);

    // Get company with all related data
    const { company, signals, contacts, people } = await getCompanyWithRelations(companyId);

    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    // Build context for AI
    const signalsSummary = signals.length > 0
      ? signals.map((s) => `- ${s.signal_type}: ${s.signal_text}`).join('\n')
      : 'No specific signals found - focus on general brand alignment.';

    const contactInfo = contacts.length > 0
      ? `Best contact: ${contacts[0].value} (${contacts[0].path_type})`
      : 'No contact information available yet.';

    const championshipContext = `The Panna World Championship is the leading global event in street football (panna) — a discipline rooted in urban culture, creativity, and 1v1 expression. The championship brings together the world's best street football players, representing different countries, cultures, and backgrounds. It targets young, mobile-first audiences (primarily Gen Z & Millennials) interested in street culture, hip-hop, fashion, and sports.`;

    const prompt = `You are writing a sponsorship outreach email for the Panna World Championship.

## Event Context
${championshipContext}

## Target Company
Company: ${company.name}
Website: ${company.website_url || 'N/A'}
${contactInfo}

## Sponsorship Signals Found
${signalsSummary}

## Instructions
Write a professional, concise sponsorship outreach email that:
1. Opens with a brief, relevant hook (no generic flattery)
2. Introduces the Panna World Championship in 1-2 sentences
3. Explains why this partnership makes sense based on the signals found
4. Includes a clear, low-commitment ask (e.g., "Would you be open to a 15-minute call?")
5. Is under 200 words

Format your response as JSON:
{
  "subject": "Email subject line (under 50 characters)",
  "body": "Full email body"
}`;

    const client = getOpenAI();
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.7,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    const parsed = JSON.parse(content);

    // Save outreach to database
    const outreachResult = await sql`
      INSERT INTO outreach (company_id, subject, body, status)
      VALUES (${companyId}, ${parsed.subject}, ${parsed.body}, 'draft')
      RETURNING *
    `;

    return res.status(200).json({
      subject: parsed.subject,
      body: parsed.body,
      outreach: outreachResult.rows[0],
      message: 'Message generated successfully',
    });
  } catch (error) {
    console.error('Message Generation Error:', error);
    return res.status(500).json({
      error: 'Failed to generate message',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
