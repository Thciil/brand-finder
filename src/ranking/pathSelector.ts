import { getDb } from '../db/connection';
import { getCompanyContacts } from '../contacts/extractor';
import { getCompanyPeople } from '../people/extractor';
import { generateLinkedInSearchUrl } from '../contacts/linkedin';

export interface SelectedPath {
  type: 'named_email' | 'inbox' | 'agency' | 'form' | 'linkedin';
  value: string;
  personName?: string;
  personTitle?: string;
  score: number;
  sourceUrl?: string;
}

export interface PathSelection {
  primary: SelectedPath;
  backup: SelectedPath | null;
  linkedinUrls: Array<{ title: string; url: string }>;
}

export function selectBestPaths(
  companyId: number,
  companyName: string,
  region?: string
): PathSelection | null {
  const contacts = getCompanyContacts(companyId);
  const people = getCompanyPeople(companyId);

  const rankedPaths: SelectedPath[] = [];

  // Check for named person + email combinations
  for (const person of people) {
    // Look for email that might belong to this person
    const personalEmail = contacts.find((c) => {
      if (c.pathType !== 'email') return false;
      const emailPrefix = c.value.split('@')[0].toLowerCase();
      const nameParts = person.name.toLowerCase().split(' ');

      // Check if email contains first name, last name, or initials
      return nameParts.some(
        (part) => emailPrefix.includes(part) || part.includes(emailPrefix)
      );
    });

    if (personalEmail) {
      rankedPaths.push({
        type: 'named_email',
        value: personalEmail.value,
        personName: person.name,
        personTitle: person.jobTitle || undefined,
        score: 100,
        sourceUrl: personalEmail.sourceUrl,
      });
    }
  }

  // Add partnership/marketing emails
  for (const contact of contacts) {
    if (contact.pathType !== 'email') continue;

    const isPartnershipEmail =
      contact.emailType === 'partnerships' ||
      contact.emailType === 'partner' ||
      contact.emailType === 'sponsorship' ||
      contact.emailType === 'sponsor';

    const isMarketingEmail =
      contact.emailType === 'marketing' || contact.emailType === 'brand';

    if (isPartnershipEmail) {
      rankedPaths.push({
        type: 'inbox',
        value: contact.value,
        score: 75,
        sourceUrl: contact.sourceUrl,
      });
    } else if (isMarketingEmail) {
      rankedPaths.push({
        type: 'inbox',
        value: contact.value,
        score: 70,
        sourceUrl: contact.sourceUrl,
      });
    }
  }

  // Add press/agency contacts
  for (const contact of contacts) {
    if (contact.pathType === 'agency') {
      rankedPaths.push({
        type: 'agency',
        value: contact.value,
        score: 50,
        sourceUrl: contact.sourceUrl,
      });
    } else if (
      contact.pathType === 'email' &&
      (contact.emailType === 'press' || contact.emailType === 'media')
    ) {
      rankedPaths.push({
        type: 'agency',
        value: contact.value,
        score: 45,
        sourceUrl: contact.sourceUrl,
      });
    }
  }

  // Add contact forms
  for (const contact of contacts) {
    if (contact.pathType === 'form') {
      rankedPaths.push({
        type: 'form',
        value: contact.value,
        score: 40,
        sourceUrl: contact.sourceUrl,
      });
    }
  }

  // Add generic emails as fallback
  for (const contact of contacts) {
    if (
      contact.pathType === 'email' &&
      !rankedPaths.find((p) => p.value === contact.value)
    ) {
      rankedPaths.push({
        type: 'inbox',
        value: contact.value,
        score: 30,
        sourceUrl: contact.sourceUrl,
      });
    }
  }

  // Add LinkedIn as final fallback
  const linkedinUrl = generateLinkedInSearchUrl(
    companyName,
    'Brand Partnerships',
    region
  );
  rankedPaths.push({
    type: 'linkedin',
    value: linkedinUrl,
    score: 25,
  });

  // Sort by score
  rankedPaths.sort((a, b) => b.score - a.score);

  if (rankedPaths.length === 0) {
    return null;
  }

  // Generate LinkedIn search URLs for manual lookup
  const linkedinUrls = [
    { title: 'Brand Partnerships', url: generateLinkedInSearchUrl(companyName, 'Brand Partnerships', region) },
    { title: 'Sports Marketing', url: generateLinkedInSearchUrl(companyName, 'Sports Marketing', region) },
    { title: 'Sponsorship Manager', url: generateLinkedInSearchUrl(companyName, 'Sponsorship Manager', region) },
    { title: 'Marketing Director', url: generateLinkedInSearchUrl(companyName, 'Marketing Director', region) },
  ];

  return {
    primary: rankedPaths[0],
    backup: rankedPaths.length > 1 ? rankedPaths[1] : null,
    linkedinUrls,
  };
}

export function savePathSelection(
  companyId: number,
  selection: PathSelection
): void {
  const db = getDb();

  // Reset all paths to non-primary
  db.prepare(
    `UPDATE contact_paths SET is_primary = 0 WHERE company_id = ?`
  ).run(companyId);

  // Set primary path
  if (selection.primary.type !== 'linkedin') {
    db.prepare(
      `UPDATE contact_paths SET is_primary = 1 WHERE company_id = ? AND value = ?`
    ).run(companyId, selection.primary.value);
  }
}

export function getPathTypeLabel(type: SelectedPath['type']): string {
  switch (type) {
    case 'named_email':
      return 'Named Person + Email';
    case 'inbox':
      return 'Department Inbox';
    case 'agency':
      return 'Press/Agency';
    case 'form':
      return 'Contact Form';
    case 'linkedin':
      return 'LinkedIn (Manual)';
  }
}
