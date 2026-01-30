import * as cheerio from 'cheerio';
import { getDb } from '../db/connection';
import { CrawlResult } from '../qualification/crawler';
import { generatePersonLinkedInUrl } from '../contacts/linkedin';

interface ExtractedPerson {
  name: string;
  jobTitle: string | null;
  department: string | null;
  sourceUrl: string;
  linkedinSearchUrl: string;
}

const RELEVANT_DEPARTMENTS: Record<string, string[]> = {
  brand: ['brand', 'branding'],
  partnerships: ['partnership', 'partner', 'sponsorship', 'sponsor'],
  marketing: ['marketing', 'market', 'growth'],
  sports: ['sport', 'sports', 'athletic'],
  csr: ['csr', 'sustainability', 'social responsibility', 'impact'],
  community: ['community', 'communities', 'engagement'],
  communications: ['communications', 'pr', 'press', 'media'],
};

const RELEVANT_TITLES = [
  /\b(cmo|chief marketing officer)\b/i,
  /\b(vp|vice president).*(marketing|brand|partnership|sponsorship)\b/i,
  /\b(head|director|manager).*(marketing|brand|partnership|sponsorship|community|csr|sports)\b/i,
  /\b(marketing|brand|partnership|sponsorship|community|csr|sports).*(head|director|manager)\b/i,
];

function classifyDepartment(title: string): string | null {
  const lowerTitle = title.toLowerCase();

  for (const [dept, keywords] of Object.entries(RELEVANT_DEPARTMENTS)) {
    for (const keyword of keywords) {
      if (lowerTitle.includes(keyword)) {
        return dept;
      }
    }
  }

  return null;
}

function isRelevantTitle(title: string): boolean {
  return RELEVANT_TITLES.some((pattern) => pattern.test(title));
}

function extractPeopleFromTeamPage(
  html: string,
  sourceUrl: string,
  companyName: string
): ExtractedPerson[] {
  const people: ExtractedPerson[] = [];
  const $ = cheerio.load(html);

  // Common patterns for team member cards
  const selectors = [
    '.team-member',
    '.person',
    '.staff',
    '.executive',
    '.leadership-card',
    '[class*="team"]',
    '[class*="person"]',
    '[class*="member"]',
  ];

  for (const selector of selectors) {
    $(selector).each((_, el) => {
      const $el = $(el);
      const text = $el.text();

      // Try to extract name and title from the element
      const $heading = $el.find('h2, h3, h4, .name, [class*="name"]').first();
      const $title = $el.find('.title, .role, .position, [class*="title"], [class*="role"]').first();

      let name = $heading.text().trim();
      let jobTitle = $title.text().trim();

      // Fallback: try to parse from text
      if (!name && text.length < 200) {
        const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
        if (lines.length >= 1) {
          name = lines[0];
          jobTitle = lines[1] || '';
        }
      }

      // Validate name (2-4 words, no special characters)
      if (name && /^[A-Z][a-z]+(\s+[A-Z][a-z]+){1,3}$/.test(name)) {
        const department = classifyDepartment(jobTitle);

        // Only add if title is relevant or department is recognized
        if (isRelevantTitle(jobTitle) || department) {
          people.push({
            name,
            jobTitle: jobTitle || null,
            department,
            sourceUrl,
            linkedinSearchUrl: generatePersonLinkedInUrl(name, companyName),
          });
        }
      }
    });
  }

  return people;
}

function extractPeopleFromText(
  text: string,
  sourceUrl: string,
  companyName: string
): ExtractedPerson[] {
  const people: ExtractedPerson[] = [];

  // Pattern: "Name, Title" or "Name - Title"
  const patterns = [
    /([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})[,\-–]\s*((?:Chief|VP|Vice President|Head|Director|Manager)[^,.\n]+)/g,
    /(?:led by|headed by|managed by)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})/gi,
  ];

  for (const pattern of patterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      const name = match[1].trim();
      const jobTitle = match[2]?.trim() || null;

      if (name && /^[A-Z][a-z]+(\s+[A-Z][a-z]+){1,2}$/.test(name)) {
        const department = jobTitle ? classifyDepartment(jobTitle) : null;

        if (!people.find((p) => p.name === name)) {
          people.push({
            name,
            jobTitle,
            department,
            sourceUrl,
            linkedinSearchUrl: generatePersonLinkedInUrl(name, companyName),
          });
        }
      }
    }
  }

  return people;
}

export async function extractPeopleFromWikipedia(
  wikipediaUrl: string,
  companyName: string
): Promise<ExtractedPerson[]> {
  const people: ExtractedPerson[] = [];

  try {
    const title = decodeURIComponent(
      wikipediaUrl.split('/wiki/')[1] || ''
    ).replace(/_/g, ' ');

    const params = new URLSearchParams({
      action: 'query',
      titles: title,
      prop: 'revisions',
      rvprop: 'content',
      rvslots: 'main',
      format: 'json',
      origin: '*',
    });

    const response = await fetch(
      `https://en.wikipedia.org/w/api.php?${params}`
    );
    const data = (await response.json()) as {
      query?: {
        pages?: Record<
          string,
          { revisions?: Array<{ slots?: { main?: { '*'?: string } } }> }
        >;
      };
    };

    const pages = data.query?.pages;
    if (!pages) return people;

    const pageId = Object.keys(pages)[0];
    const content =
      pages[pageId]?.revisions?.[0]?.slots?.main?.['*'] || '';

    // Look for key people in infobox
    const keyPeopleMatch = content.match(
      /\|\s*key_people\s*=([^|]+)/i
    );
    if (keyPeopleMatch) {
      const keyPeopleText = keyPeopleMatch[1];

      // Extract names from wiki links
      const wikiLinkPattern = /\[\[([^|\]]+)(?:\|([^\]]+))?\]\]/g;
      const matches = keyPeopleText.matchAll(wikiLinkPattern);

      for (const match of matches) {
        const name = (match[2] || match[1]).trim();

        // Extract title if present after the link
        const afterLink = keyPeopleText.slice(
          (match.index || 0) + match[0].length,
          (match.index || 0) + match[0].length + 100
        );
        const titleMatch = afterLink.match(/^\s*\(([^)]+)\)/);
        const jobTitle = titleMatch ? titleMatch[1].trim() : null;

        if (name && /^[A-Z][a-z]+(\s+[A-Z][a-z]+){1,2}$/.test(name)) {
          people.push({
            name,
            jobTitle,
            department: jobTitle ? classifyDepartment(jobTitle) : null,
            sourceUrl: wikipediaUrl,
            linkedinSearchUrl: generatePersonLinkedInUrl(name, companyName),
          });
        }
      }
    }
  } catch (error) {
    console.log(`    Warning: Could not fetch Wikipedia data`);
  }

  return people;
}

export function extractPeople(
  crawlResults: Map<string, CrawlResult>,
  companyName: string
): ExtractedPerson[] {
  const allPeople: ExtractedPerson[] = [];
  const seenNames = new Set<string>();

  for (const [path, result] of crawlResults) {
    if (!result.success) continue;

    // Prioritize team/about pages
    const isTeamPage =
      path.includes('team') ||
      path.includes('leadership') ||
      path.includes('about');

    let extracted: ExtractedPerson[] = [];

    if (isTeamPage) {
      extracted = extractPeopleFromTeamPage(
        result.html,
        result.url,
        companyName
      );
    }

    // Also try text extraction
    const fromText = extractPeopleFromText(
      result.text,
      result.url,
      companyName
    );
    extracted = [...extracted, ...fromText];

    for (const person of extracted) {
      if (!seenNames.has(person.name.toLowerCase())) {
        seenNames.add(person.name.toLowerCase());
        allPeople.push(person);
      }
    }
  }

  return allPeople;
}

export function savePeople(
  companyId: number,
  people: ExtractedPerson[]
): void {
  const db = getDb();

  // Clear existing people for this company
  db.prepare(`DELETE FROM people WHERE company_id = ?`).run(companyId);

  const insertStmt = db.prepare(`
    INSERT INTO people (company_id, name, job_title, department, source_url, linkedin_search_url)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  for (const person of people) {
    insertStmt.run(
      companyId,
      person.name,
      person.jobTitle,
      person.department,
      person.sourceUrl,
      person.linkedinSearchUrl
    );
  }
}

export function getCompanyPeople(companyId: number): ExtractedPerson[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT name, job_title, department, source_url, linkedin_search_url
       FROM people
       WHERE company_id = ?`
    )
    .all(companyId) as Array<{
    name: string;
    job_title: string | null;
    department: string | null;
    source_url: string;
    linkedin_search_url: string;
  }>;

  return rows.map((row) => ({
    name: row.name,
    jobTitle: row.job_title,
    department: row.department,
    sourceUrl: row.source_url,
    linkedinSearchUrl: row.linkedin_search_url,
  }));
}
