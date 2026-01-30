const RELEVANT_TITLES = [
  'Brand Partnerships',
  'Sports Marketing',
  'Experiential Marketing',
  'Sponsorship Manager',
  'Sponsorship',
  'CSR Manager',
  'Community Manager',
  'Marketing Director',
  'Brand Manager',
  'Partnerships Manager',
  'Head of Partnerships',
  'Head of Marketing',
  'CMO',
  'Chief Marketing Officer',
];

const REGIONS: Record<string, string> = {
  denmark: 'Denmark',
  nordic: 'Denmark OR Sweden OR Norway OR Finland',
  europe: 'Europe',
  global: '',
};

export function generateLinkedInSearchUrl(
  companyName: string,
  title?: string,
  region?: string
): string {
  const keywords: string[] = [];

  if (title) {
    keywords.push(title);
  }

  keywords.push(companyName);

  const regionFilter = region ? REGIONS[region.toLowerCase()] || '' : '';

  const params = new URLSearchParams({
    keywords: keywords.join(' '),
    origin: 'GLOBAL_SEARCH_HEADER',
  });

  if (regionFilter) {
    params.append('geoUrn', regionFilter);
  }

  return `https://www.linkedin.com/search/results/people/?${params.toString()}`;
}

export function generateAllLinkedInUrls(
  companyName: string,
  region?: string
): Array<{ title: string; url: string }> {
  return RELEVANT_TITLES.map((title) => ({
    title,
    url: generateLinkedInSearchUrl(companyName, title, region),
  }));
}

export function generatePersonLinkedInUrl(
  personName: string,
  companyName: string
): string {
  const keywords = `${personName} ${companyName}`;

  const params = new URLSearchParams({
    keywords,
    origin: 'GLOBAL_SEARCH_HEADER',
  });

  return `https://www.linkedin.com/search/results/people/?${params.toString()}`;
}

export function getRelevantTitles(): string[] {
  return [...RELEVANT_TITLES];
}
