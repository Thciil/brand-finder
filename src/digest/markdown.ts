import fs from 'fs';
import path from 'path';
import { getDb } from '../db/connection';
import { getCompanySignals } from '../qualification/analyzer';
import { getCompanyContacts } from '../contacts/extractor';
import { getCompanyPeople } from '../people/extractor';
import {
  selectBestPaths,
  getPathTypeLabel,
  PathSelection,
} from '../ranking/pathSelector';
import { GeneratedOutreach } from '../outreach/generator';

interface DigestCompany {
  id: number;
  name: string;
  websiteUrl: string | null;
  qualificationScore: number;
  signals: Array<{ type: string; text: string }>;
  pathSelection: PathSelection | null;
  people: Array<{
    name: string;
    jobTitle: string | null;
    linkedinSearchUrl: string;
  }>;
  outreach: GeneratedOutreach | null;
}

export function generateDigest(
  companies: DigestCompany[],
  outputPath?: string
): string {
  const date = new Date().toISOString().split('T')[0];

  let markdown = `# Daily Sponsor Digest - ${date}\n\n`;
  markdown += `Generated: ${new Date().toLocaleString()}\n\n`;
  markdown += `---\n\n`;

  for (let i = 0; i < companies.length; i++) {
    const company = companies[i];

    markdown += `## ${i + 1}. ${company.name}\n\n`;

    if (company.websiteUrl) {
      markdown += `**Website:** ${company.websiteUrl}\n\n`;
    }

    markdown += `**Qualification Score:** ${company.qualificationScore}/100\n\n`;

    // Sponsorship Signals
    markdown += `### Sponsorship Signals\n\n`;
    if (company.signals.length > 0) {
      for (const signal of company.signals) {
        markdown += `- ✓ **${signal.type}**: ${signal.text.slice(0, 100)}...\n`;
      }
    } else {
      markdown += `- No specific signals found\n`;
    }
    markdown += `\n`;

    // Contact Path
    if (company.pathSelection) {
      markdown += `### Primary Contact Path\n\n`;
      markdown += `- **Type:** ${getPathTypeLabel(company.pathSelection.primary.type)}\n`;
      markdown += `- **Contact:** ${company.pathSelection.primary.value}\n`;

      if (company.pathSelection.primary.personName) {
        markdown += `- **Person:** ${company.pathSelection.primary.personName}`;
        if (company.pathSelection.primary.personTitle) {
          markdown += `, ${company.pathSelection.primary.personTitle}`;
        }
        markdown += `\n`;
      }

      if (company.pathSelection.primary.sourceUrl) {
        markdown += `- **Source:** ${company.pathSelection.primary.sourceUrl}\n`;
      }
      markdown += `\n`;

      if (company.pathSelection.backup) {
        markdown += `### Backup Path\n\n`;
        markdown += `- **Type:** ${getPathTypeLabel(company.pathSelection.backup.type)}\n`;
        markdown += `- **Contact:** ${company.pathSelection.backup.value}\n\n`;
      }

      // LinkedIn Search URLs
      markdown += `### LinkedIn Search (Manual)\n\n`;
      for (const link of company.pathSelection.linkedinUrls) {
        markdown += `- [${link.title}](${link.url})\n`;
      }
      markdown += `\n`;
    }

    // People Found
    if (company.people.length > 0) {
      markdown += `### People Found\n\n`;
      for (const person of company.people.slice(0, 5)) {
        markdown += `- **${person.name}**`;
        if (person.jobTitle) {
          markdown += ` - ${person.jobTitle}`;
        }
        markdown += ` ([LinkedIn](${person.linkedinSearchUrl}))\n`;
      }
      markdown += `\n`;
    }

    // Outreach Copy
    if (company.outreach) {
      markdown += `### Outreach Copy\n\n`;
      markdown += `**Subject:** ${company.outreach.subject}\n\n`;
      markdown += `---\n\n`;
      markdown += company.outreach.body
        .split('\n')
        .map((line) => `> ${line}`)
        .join('\n');
      markdown += `\n\n---\n\n`;

      // Follow-up Checklist
      markdown += `### Follow-up Checklist\n\n`;
      for (const followup of company.outreach.followups) {
        markdown += `- [ ] **Day ${followup.dayOffset}:** ${followup.message.slice(0, 100)}...\n`;
      }
      markdown += `\n`;
    }

    markdown += `---\n\n`;
  }

  // Save to file if path provided
  if (outputPath) {
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(outputPath, markdown);
  }

  return markdown;
}

export function getDefaultDigestPath(): string {
  const date = new Date().toISOString().split('T')[0];
  return path.join(process.cwd(), 'digests', `${date}.md`);
}

export function prepareCompanyForDigest(
  companyId: number,
  region?: string
): Omit<DigestCompany, 'outreach'> {
  const db = getDb();

  const company = db
    .prepare(
      `SELECT id, name, website_url, qualification_score
       FROM companies WHERE id = ?`
    )
    .get(companyId) as {
    id: number;
    name: string;
    website_url: string | null;
    qualification_score: number;
  };

  if (!company) {
    throw new Error(`Company with ID ${companyId} not found`);
  }

  const signals = getCompanySignals(companyId);
  const pathSelection = selectBestPaths(companyId, company.name, region);
  const people = getCompanyPeople(companyId);

  return {
    id: company.id,
    name: company.name,
    websiteUrl: company.website_url,
    qualificationScore: company.qualification_score,
    signals,
    pathSelection,
    people: people.map((p) => ({
      name: p.name,
      jobTitle: p.jobTitle,
      linkedinSearchUrl: p.linkedinSearchUrl,
    })),
  };
}

export function getTopQualifiedCompanies(
  limit: number = 3
): Array<{ id: number; name: string; qualification_score: number }> {
  const db = getDb();
  return db
    .prepare(
      `SELECT id, name, qualification_score
       FROM companies
       WHERE status = 'qualified'
       ORDER BY qualification_score DESC
       LIMIT ?`
    )
    .all(limit) as Array<{
    id: number;
    name: string;
    qualification_score: number;
  }>;
}
