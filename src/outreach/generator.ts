import OpenAI from 'openai';
import { getDb } from '../db/connection';
import { SelectedPath } from '../ranking/pathSelector';
import fs from 'fs';
import path from 'path';

let openai: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openai) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error(
        'OPENAI_API_KEY environment variable is not set. Add it to your .env file.'
      );
    }
    openai = new OpenAI({ apiKey });
  }
  return openai;
}

function getChampionshipContext(): string {
  try {
    const contextPath = path.join(
      process.cwd(),
      'about_the_championship.md'
    );
    return fs.readFileSync(contextPath, 'utf-8');
  } catch {
    return `The Panna World Championship is the leading global event in street football (panna) — a discipline rooted in urban culture, creativity, and 1v1 expression. The championship brings together the world's best street football players, representing different countries, cultures, and backgrounds. It targets young, mobile-first audiences (primarily Gen Z & Millennials) interested in street culture, hip-hop, fashion, and sports.`;
  }
}

export interface GeneratedOutreach {
  subject: string;
  body: string;
  followups: Array<{
    dayOffset: number;
    message: string;
  }>;
}

export async function generateOutreach(
  companyName: string,
  signals: Array<{ type: string; text: string }>,
  contactPath: SelectedPath
): Promise<GeneratedOutreach> {
  const client = getOpenAI();
  const championshipContext = getChampionshipContext();

  const signalsSummary = signals
    .map((s) => `- ${s.type}: ${s.text}`)
    .join('\n');

  const contactContext = contactPath.personName
    ? `Contact: ${contactPath.personName}${contactPath.personTitle ? `, ${contactPath.personTitle}` : ''}`
    : `Contact type: ${contactPath.type}`;

  const prompt = `You are writing a sponsorship outreach email for the Panna World Championship.

## Event Context
${championshipContext}

## Target Company
Company: ${companyName}
${contactContext}

## Sponsorship Signals Found
${signalsSummary || 'No specific signals found - focus on general brand alignment.'}

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

  // Generate follow-ups
  const followups = await generateFollowups(
    companyName,
    parsed.subject,
    parsed.body
  );

  return {
    subject: parsed.subject,
    body: parsed.body,
    followups,
  };
}

async function generateFollowups(
  companyName: string,
  originalSubject: string,
  originalBody: string
): Promise<Array<{ dayOffset: number; message: string }>> {
  const client = getOpenAI();

  const prompt = `Generate 3 follow-up emails for a sponsorship outreach to ${companyName}.

Original email subject: ${originalSubject}
Original email body: ${originalBody}

Create follow-ups for:
1. Day 3: Gentle bump (short, friendly reminder)
2. Day 7: Value-add (share relevant content or news about the event)
3. Day 10: Final follow-up (last attempt with alternative ask)

Keep each follow-up under 100 words.

Format as JSON:
{
  "followups": [
    {"dayOffset": 3, "message": "..."},
    {"dayOffset": 7, "message": "..."},
    {"dayOffset": 10, "message": "..."}
  ]
}`;

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    temperature: 0.7,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    return [
      { dayOffset: 3, message: 'Following up on my previous email...' },
      { dayOffset: 7, message: 'Wanted to share some updates...' },
      { dayOffset: 10, message: 'Final follow-up...' },
    ];
  }

  const parsed = JSON.parse(content);
  return parsed.followups || [];
}

export function saveOutreach(
  companyId: number,
  contactPathId: number | null,
  personId: number | null,
  outreach: GeneratedOutreach
): number {
  const db = getDb();

  const result = db
    .prepare(
      `INSERT INTO outreach (company_id, contact_path_id, person_id, subject, body, status)
       VALUES (?, ?, ?, ?, ?, 'draft')`
    )
    .run(companyId, contactPathId, personId, outreach.subject, outreach.body);

  const outreachId = result.lastInsertRowid as number;

  // Save follow-ups
  const followupStmt = db.prepare(
    `INSERT INTO followups (outreach_id, day_offset, message, status)
     VALUES (?, ?, ?, 'pending')`
  );

  for (const followup of outreach.followups) {
    followupStmt.run(outreachId, followup.dayOffset, followup.message);
  }

  return outreachId;
}

export function getOutreach(outreachId: number): {
  subject: string;
  body: string;
  followups: Array<{ dayOffset: number; message: string }>;
} | null {
  const db = getDb();

  const outreach = db
    .prepare(`SELECT subject, body FROM outreach WHERE id = ?`)
    .get(outreachId) as { subject: string; body: string } | undefined;

  if (!outreach) return null;

  const followups = db
    .prepare(
      `SELECT day_offset, message FROM followups WHERE outreach_id = ? ORDER BY day_offset`
    )
    .all(outreachId) as Array<{ day_offset: number; message: string }>;

  return {
    subject: outreach.subject,
    body: outreach.body,
    followups: followups.map((f) => ({
      dayOffset: f.day_offset,
      message: f.message,
    })),
  };
}

export function getCompanyOutreach(companyId: number): Array<{
  id: number;
  subject: string;
  body: string;
  status: string;
}> {
  const db = getDb();
  return db
    .prepare(
      `SELECT id, subject, body, status FROM outreach WHERE company_id = ? ORDER BY created_at DESC`
    )
    .all(companyId) as Array<{
    id: number;
    subject: string;
    body: string;
    status: string;
  }>;
}
