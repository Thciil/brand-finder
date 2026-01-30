import * as cheerio from 'cheerio';

const RATE_LIMIT_MS = 1000; // 1 request per second
let lastRequestTime = 0;

const RELEVANT_PATHS = [
  '/',
  '/about',
  '/about-us',
  '/brand',
  '/community',
  '/sustainability',
  '/partnerships',
  '/partners',
  '/sponsorship',
  '/sponsorships',
  '/press',
  '/news',
  '/newsroom',
  '/media',
  '/contact',
  '/team',
  '/leadership',
  '/our-team',
  '/about/team',
];

export interface CrawlResult {
  url: string;
  html: string;
  text: string;
  links: string[];
  success: boolean;
  error?: string;
}

async function rateLimitedFetch(url: string): Promise<Response> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;

  if (timeSinceLastRequest < RATE_LIMIT_MS) {
    await new Promise((resolve) =>
      setTimeout(resolve, RATE_LIMIT_MS - timeSinceLastRequest)
    );
  }

  lastRequestTime = Date.now();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; SponsorPathfinder/1.0; +https://github.com/sponsor-pathfinder)',
        Accept: 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
    });
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchPage(url: string): Promise<CrawlResult> {
  try {
    const response = await rateLimitedFetch(url);

    if (!response.ok) {
      return {
        url,
        html: '',
        text: '',
        links: [],
        success: false,
        error: `HTTP ${response.status}`,
      };
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Remove script and style elements
    $('script, style, noscript').remove();

    const text = $('body').text().replace(/\s+/g, ' ').trim();

    // Extract links
    const links: string[] = [];
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href');
      if (href) links.push(href);
    });

    return { url, html, text, links, success: true };
  } catch (error) {
    return {
      url,
      html: '',
      text: '',
      links: [],
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

function normalizeUrl(baseUrl: string, path: string): string {
  try {
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path;
    }
    const base = new URL(baseUrl);
    return new URL(path, base).toString();
  } catch {
    return '';
  }
}

export async function crawlCompanyWebsite(
  baseUrl: string
): Promise<Map<string, CrawlResult>> {
  const results = new Map<string, CrawlResult>();

  // Ensure baseUrl has protocol
  let normalizedBase = baseUrl;
  if (!normalizedBase.startsWith('http')) {
    normalizedBase = `https://${normalizedBase}`;
  }

  // Remove trailing slash
  normalizedBase = normalizedBase.replace(/\/$/, '');

  console.log(`  Crawling ${normalizedBase}...`);

  // Fetch homepage first
  const homepage = await fetchPage(normalizedBase);
  results.set('/', homepage);

  if (!homepage.success) {
    console.log(`    Failed to fetch homepage: ${homepage.error}`);
    return results;
  }

  // Try to find relevant pages from homepage links
  const foundPaths = new Set<string>();

  for (const link of homepage.links) {
    const normalized = normalizeUrl(normalizedBase, link);
    if (!normalized) continue;

    try {
      const linkUrl = new URL(normalized);
      const baseHost = new URL(normalizedBase).hostname;

      // Only follow links on the same domain
      if (linkUrl.hostname !== baseHost) continue;

      const path = linkUrl.pathname.toLowerCase();

      // Check if this is a relevant path
      for (const relevantPath of RELEVANT_PATHS) {
        if (path === relevantPath || path === `${relevantPath}/`) {
          foundPaths.add(linkUrl.pathname);
        }
      }
    } catch {
      continue;
    }
  }

  // Also try common paths that might not be linked
  for (const path of RELEVANT_PATHS) {
    if (path !== '/') {
      foundPaths.add(path);
    }
  }

  // Fetch found pages (limit to avoid too many requests)
  const pathsToFetch = Array.from(foundPaths).slice(0, 10);

  for (const path of pathsToFetch) {
    const url = `${normalizedBase}${path}`;
    const result = await fetchPage(url);

    if (result.success) {
      results.set(path, result);
      console.log(`    Found: ${path}`);
    }
  }

  return results;
}

export function extractTextContent(html: string): string {
  const $ = cheerio.load(html);
  $('script, style, noscript, nav, footer, header').remove();
  return $('body').text().replace(/\s+/g, ' ').trim();
}
