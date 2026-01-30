import * as cheerio from 'cheerio';
import { getDb } from '../db/connection';
import { CrawlResult } from '../qualification/crawler';

interface ExtractedContact {
  pathType: 'email' | 'form' | 'agency' | 'press';
  value: string;
  emailType?: string;
  confidenceScore: number;
  sourceUrl: string;
}

const EMAIL_PRIORITY: Record<string, number> = {
  partnerships: 100,
  partner: 95,
  sponsorship: 95,
  sponsor: 90,
  marketing: 80,
  brand: 75,
  press: 60,
  media: 60,
  pr: 55,
  info: 40,
  contact: 35,
  hello: 30,
};

function extractEmails(html: string, sourceUrl: string): ExtractedContact[] {
  const contacts: ExtractedContact[] = [];
  const $ = cheerio.load(html);

  // Find mailto links
  $('a[href^="mailto:"]').each((_, el) => {
    const href = $(el).attr('href');
    if (href) {
      const email = href.replace('mailto:', '').split('?')[0].toLowerCase();
      if (isValidEmail(email)) {
        contacts.push(createEmailContact(email, sourceUrl));
      }
    }
  });

  // Find emails in text content
  const text = $('body').text();
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const matches = text.match(emailRegex) || [];

  for (const email of matches) {
    const lowerEmail = email.toLowerCase();
    if (isValidEmail(lowerEmail)) {
      const existing = contacts.find((c) => c.value === lowerEmail);
      if (!existing) {
        contacts.push(createEmailContact(lowerEmail, sourceUrl));
      }
    }
  }

  return contacts;
}

function isValidEmail(email: string): boolean {
  // Filter out common false positives
  const blacklist = ['example.com', 'email.com', 'domain.com', 'test.com'];
  const domain = email.split('@')[1];

  if (!domain) return false;
  if (blacklist.some((b) => domain.includes(b))) return false;
  if (email.length > 100) return false;

  return true;
}

function createEmailContact(email: string, sourceUrl: string): ExtractedContact {
  const prefix = email.split('@')[0].toLowerCase();

  // Determine email type and confidence
  let emailType = 'general';
  let confidenceScore = 20;

  for (const [type, score] of Object.entries(EMAIL_PRIORITY)) {
    if (prefix.includes(type)) {
      emailType = type;
      confidenceScore = score;
      break;
    }
  }

  return {
    pathType: 'email',
    value: email,
    emailType,
    confidenceScore,
    sourceUrl,
  };
}

function extractContactForms(
  html: string,
  baseUrl: string,
  sourceUrl: string
): ExtractedContact[] {
  const contacts: ExtractedContact[] = [];
  const $ = cheerio.load(html);

  // Look for contact forms
  $('form').each((_, el) => {
    const $form = $(el);
    const action = $form.attr('action') || '';
    const method = ($form.attr('method') || 'get').toLowerCase();

    // Check if form has email-related fields
    const hasEmailField = $form.find('input[type="email"]').length > 0;
    const hasTextarea = $form.find('textarea').length > 0;

    if (hasEmailField || hasTextarea) {
      let formUrl = sourceUrl;

      if (action && !action.startsWith('javascript:')) {
        try {
          formUrl = new URL(action, baseUrl).toString();
        } catch {
          // Keep sourceUrl
        }
      }

      contacts.push({
        pathType: 'form',
        value: formUrl,
        confidenceScore: 40,
        sourceUrl,
      });
    }
  });

  return contacts;
}

function extractAgencyMentions(
  text: string,
  sourceUrl: string
): ExtractedContact[] {
  const contacts: ExtractedContact[] = [];

  // Look for PR/marketing agency mentions
  const agencyPatterns = [
    /(?:PR|press|media|marketing)\s+(?:agency|firm|partner)[:\s]+([A-Z][a-zA-Z\s&]+)/gi,
    /(?:represented by|handled by|contact)[:\s]+([A-Z][a-zA-Z\s&]+(?:PR|Communications|Agency))/gi,
  ];

  for (const pattern of agencyPatterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      if (match[1] && match[1].length > 3 && match[1].length < 50) {
        contacts.push({
          pathType: 'agency',
          value: match[1].trim(),
          confidenceScore: 50,
          sourceUrl,
        });
      }
    }
  }

  return contacts;
}

export function extractContacts(
  crawlResults: Map<string, CrawlResult>,
  baseUrl: string
): ExtractedContact[] {
  const allContacts: ExtractedContact[] = [];
  const seenValues = new Set<string>();

  for (const [path, result] of crawlResults) {
    if (!result.success) continue;

    // Extract emails
    const emails = extractEmails(result.html, result.url);
    for (const contact of emails) {
      if (!seenValues.has(contact.value)) {
        seenValues.add(contact.value);
        allContacts.push(contact);
      }
    }

    // Extract contact forms (only from contact/partnerships pages)
    if (
      path.includes('contact') ||
      path.includes('partner') ||
      path === '/'
    ) {
      const forms = extractContactForms(result.html, baseUrl, result.url);
      for (const contact of forms) {
        if (!seenValues.has(contact.value)) {
          seenValues.add(contact.value);
          allContacts.push(contact);
        }
      }
    }

    // Extract agency mentions
    const agencies = extractAgencyMentions(result.text, result.url);
    for (const contact of agencies) {
      if (!seenValues.has(contact.value)) {
        seenValues.add(contact.value);
        allContacts.push(contact);
      }
    }
  }

  // Sort by confidence score
  allContacts.sort((a, b) => b.confidenceScore - a.confidenceScore);

  return allContacts;
}

export function saveContacts(
  companyId: number,
  contacts: ExtractedContact[]
): void {
  const db = getDb();

  // Clear existing contacts for this company
  db.prepare(`DELETE FROM contact_paths WHERE company_id = ?`).run(companyId);

  const insertStmt = db.prepare(`
    INSERT INTO contact_paths (company_id, path_type, value, email_type, confidence_score, source_url, is_primary)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  contacts.forEach((contact, index) => {
    insertStmt.run(
      companyId,
      contact.pathType,
      contact.value,
      contact.emailType || null,
      contact.confidenceScore,
      contact.sourceUrl,
      index === 0 ? 1 : 0 // First contact is primary
    );
  });
}

export function getCompanyContacts(companyId: number): ExtractedContact[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT path_type, value, email_type, confidence_score, source_url
       FROM contact_paths
       WHERE company_id = ?
       ORDER BY confidence_score DESC`
    )
    .all(companyId) as Array<{
    path_type: string;
    value: string;
    email_type: string | null;
    confidence_score: number;
    source_url: string;
  }>;

  return rows.map((row) => ({
    pathType: row.path_type as 'email' | 'form' | 'agency' | 'press',
    value: row.value,
    emailType: row.email_type || undefined,
    confidenceScore: row.confidence_score,
    sourceUrl: row.source_url,
  }));
}
