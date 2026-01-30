import { getDb } from '../db/connection';
import { CrawlResult } from './crawler';

interface SignalMatch {
  type: string;
  text: string;
  score: number;
}

const SIGNAL_PATTERNS: Record<string, { patterns: RegExp[]; score: number }> = {
  sport: {
    patterns: [
      /\b(football|soccer|athletics|sport|sports|athlete|athletes|team|teams|championship|tournament)\b/gi,
    ],
    score: 15,
  },
  youth: {
    patterns: [
      /\b(youth|young|generation|next gen|nextgen|teenager|teens|kids|children|school|education)\b/gi,
    ],
    score: 20,
  },
  culture: {
    patterns: [
      /\b(urban|street|culture|cultural|hip.?hop|music|art|creative|creativity|lifestyle|fashion)\b/gi,
    ],
    score: 20,
  },
  community: {
    patterns: [
      /\b(community|communities|local|grassroots|neighborhood|social impact|giving back|initiative)\b/gi,
    ],
    score: 15,
  },
  partnership: {
    patterns: [
      /\b(partner|partners|partnership|partnerships|collaborate|collaboration|sponsor|sponsored|sponsorship|activate|activation)\b/gi,
    ],
    score: 25,
  },
  previous_sponsorship: {
    patterns: [
      /\b(official partner|proud partner|official sponsor|title sponsor|presenting sponsor|supported by|in partnership with)\b/gi,
    ],
    score: 30,
  },
  events: {
    patterns: [
      /\b(event|events|festival|festivals|tournament|championship|competition|experience|experiential)\b/gi,
    ],
    score: 10,
  },
};

function findSignals(text: string): SignalMatch[] {
  const signals: SignalMatch[] = [];
  const textLower = text.toLowerCase();

  for (const [type, config] of Object.entries(SIGNAL_PATTERNS)) {
    for (const pattern of config.patterns) {
      const matches = text.match(pattern);
      if (matches && matches.length > 0) {
        // Get context around the match (first match only to avoid duplicates)
        const firstMatch = matches[0];
        const index = textLower.indexOf(firstMatch.toLowerCase());
        const start = Math.max(0, index - 50);
        const end = Math.min(text.length, index + firstMatch.length + 50);
        const context = text.slice(start, end).replace(/\s+/g, ' ').trim();

        signals.push({
          type,
          text: `...${context}...`,
          score: config.score,
        });
        break; // Only count each signal type once per text block
      }
    }
  }

  return signals;
}

export function analyzePageContent(
  crawlResults: Map<string, CrawlResult>
): SignalMatch[] {
  const allSignals: SignalMatch[] = [];
  const seenTypes = new Set<string>();

  for (const [path, result] of crawlResults) {
    if (!result.success) continue;

    const signals = findSignals(result.text);

    for (const signal of signals) {
      // Only add each signal type once across all pages
      if (!seenTypes.has(signal.type)) {
        seenTypes.add(signal.type);
        allSignals.push({
          ...signal,
          text: `[${path}] ${signal.text}`,
        });
      }
    }
  }

  return allSignals;
}

export function calculateQualificationScore(signals: SignalMatch[]): number {
  return signals.reduce((total, signal) => total + signal.score, 0);
}

export function saveSignals(companyId: number, signals: SignalMatch[]): void {
  const db = getDb();
  const insertStmt = db.prepare(`
    INSERT INTO sponsorship_signals (company_id, signal_type, signal_text, source_url)
    VALUES (?, ?, ?, ?)
  `);

  // Clear existing signals for this company
  db.prepare(`DELETE FROM sponsorship_signals WHERE company_id = ?`).run(
    companyId
  );

  for (const signal of signals) {
    insertStmt.run(companyId, signal.type, signal.text, null);
  }
}

export function updateCompanyQualification(
  companyId: number,
  score: number,
  threshold: number = 50
): void {
  const db = getDb();
  const status = score >= threshold ? 'qualified' : 'unqualified';

  db.prepare(
    `UPDATE companies SET qualification_score = ?, status = ? WHERE id = ?`
  ).run(score, status, companyId);
}

export function getCompanySignals(companyId: number): SignalMatch[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT signal_type, signal_text FROM sponsorship_signals WHERE company_id = ?`
    )
    .all(companyId) as Array<{ signal_type: string; signal_text: string }>;

  return rows.map((row) => ({
    type: row.signal_type,
    text: row.signal_text,
    score: SIGNAL_PATTERNS[row.signal_type]?.score || 0,
  }));
}

export function getQualifiedCompanies(): Array<{
  id: number;
  name: string;
  website_url: string | null;
  qualification_score: number;
}> {
  const db = getDb();
  return db
    .prepare(
      `SELECT id, name, website_url, qualification_score
       FROM companies
       WHERE status = 'qualified'
       ORDER BY qualification_score DESC`
    )
    .all() as Array<{
    id: number;
    name: string;
    website_url: string | null;
    qualification_score: number;
  }>;
}
