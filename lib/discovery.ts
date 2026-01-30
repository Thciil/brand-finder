import { sql, createCompany } from './db';

const WIKIPEDIA_API = 'https://en.wikipedia.org/w/api.php';

interface WikiCategoryMember {
  pageid: number;
  ns: number;
  title: string;
}

interface WikiApiResponse {
  query?: {
    categorymembers?: WikiCategoryMember[];
    search?: Array<{ title: string }>;
  };
  continue?: {
    cmcontinue: string;
  };
}

// Preset shortcuts for common searches
export const CATEGORY_SHORTCUTS: Record<string, string[]> = {
  sportswear: ['Sportswear_brands', 'Athletic_shoe_brands'],
  fashion: ['Fashion_brands', 'Clothing_brands'],
  streetwear: ['Streetwear_brands', 'Skateboarding_companies'],
  watches: ['Watch_brands', 'Watch_manufacturing_companies'],
  energy: ['Energy_drink_brands', 'Soft_drink_brands'],
  tech: ['Technology_companies', 'Consumer_electronics_brands'],
  danish: ['Danish_brands', 'Companies_of_Denmark'],
  swedish: ['Swedish_brands', 'Companies_of_Sweden'],
  norwegian: ['Norwegian_brands', 'Companies_of_Norway'],
  nordic: ['Danish_brands', 'Swedish_brands', 'Norwegian_brands', 'Finnish_brands'],
  automotive: ['Car_brands', 'Motorcycle_manufacturers'],
  food: ['Food_brands', 'Snack_food_manufacturers'],
  beverage: ['Drink_brands', 'Soft_drink_brands', 'Beer_brands'],
  cosmetics: ['Cosmetics_brands', 'Perfume_houses'],
  gaming: ['Video_game_companies', 'Esports'],
  music: ['Record_labels', 'Musical_instrument_manufacturers'],
  outdoor: ['Outdoor_clothing_brands', 'Camping_equipment_manufacturers'],
  luxury: ['Luxury_brands', 'High_fashion_brands'],
};

async function fetchCategoryMembers(
  category: string,
  continueToken?: string
): Promise<WikiApiResponse> {
  const params = new URLSearchParams({
    action: 'query',
    list: 'categorymembers',
    cmtitle: `Category:${category}`,
    cmlimit: '50',
    cmtype: 'page',
    format: 'json',
    origin: '*',
  });

  if (continueToken) {
    params.append('cmcontinue', continueToken);
  }

  const response = await fetch(`${WIKIPEDIA_API}?${params}`);
  if (!response.ok) {
    throw new Error(`Wikipedia API error: ${response.status}`);
  }
  return response.json() as Promise<WikiApiResponse>;
}

async function searchWikipediaCategories(query: string): Promise<string[]> {
  console.log(`  🔍 Searching Wikipedia for categories matching "${query}"...`);

  const params = new URLSearchParams({
    action: 'query',
    list: 'search',
    srsearch: `${query} brands OR ${query} companies`,
    srnamespace: '14', // Category namespace
    srlimit: '10',
    format: 'json',
    origin: '*',
  });

  try {
    const response = await fetch(`${WIKIPEDIA_API}?${params}`);
    const data = (await response.json()) as WikiApiResponse;

    const categories =
      data.query?.search?.map((r) => r.title.replace('Category:', '')) || [];

    if (categories.length > 0) {
      console.log(`  ✓ Found ${categories.length} matching categories:`);
      categories.slice(0, 5).forEach((c) => console.log(`    - ${c}`));
    }

    return categories;
  } catch {
    return [];
  }
}

async function fetchCompanyWebsite(title: string): Promise<string | null> {
  // Fetch the Wikipedia page content to extract website from infobox
  const params = new URLSearchParams({
    action: 'query',
    titles: title,
    prop: 'revisions',
    rvprop: 'content',
    rvslots: 'main',
    format: 'json',
    origin: '*',
  });

  try {
    const response = await fetch(`${WIKIPEDIA_API}?${params}`);
    if (!response.ok) return null;

    const data = (await response.json()) as {
      query?: {
        pages?: Record<string, { revisions?: Array<{ slots?: { main?: { '*'?: string } } }> }>;
      };
    };

    const pages = data.query?.pages;
    if (!pages) return null;

    const pageId = Object.keys(pages)[0];
    const content = pages[pageId]?.revisions?.[0]?.slots?.main?.['*'] || '';

    // Try to extract website from infobox
    // Common patterns: | website = {{URL|example.com}} or | website = [http://example.com]
    const patterns = [
      /\|\s*website\s*=\s*\{\{URL\|([^}|]+)/i,
      /\|\s*website\s*=\s*\{\{url\|([^}|]+)/i,
      /\|\s*website\s*=\s*\[?(https?:\/\/[^\s\]|]+)/i,
      /\|\s*homepage\s*=\s*\{\{URL\|([^}|]+)/i,
      /\|\s*homepage\s*=\s*\[?(https?:\/\/[^\s\]|]+)/i,
      /\|\s*url\s*=\s*\{\{URL\|([^}|]+)/i,
      /\|\s*url\s*=\s*\[?(https?:\/\/[^\s\]|]+)/i,
    ];

    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match && match[1]) {
        let url = match[1].trim();

        // Clean up the URL
        url = url.replace(/\}\}.*$/, ''); // Remove closing braces
        url = url.replace(/\|.*$/, ''); // Remove anything after pipe
        url = url.replace(/\s+.*$/, ''); // Remove anything after space

        // Add protocol if missing
        if (!url.startsWith('http')) {
          url = `https://${url}`;
        }

        // Validate and normalize
        try {
          const parsed = new URL(url);
          return `${parsed.protocol}//${parsed.hostname}`;
        } catch {
          continue;
        }
      }
    }

    return null;
  } catch {
    return null;
  }
}

export async function discoverCompanies(
  categoryInput: string,
  region?: string,
  limit: number = 50
): Promise<{ added: number; companies: Array<{ id: number; name: string; website_url: string | null }> }> {
  console.log(`\n━━━ Discovery Starting ━━━\n`);

  // Determine which categories to search
  let categories: string[] = [];
  const inputLower = categoryInput.toLowerCase();

  if (CATEGORY_SHORTCUTS[inputLower]) {
    // Use preset shortcut
    categories = CATEGORY_SHORTCUTS[inputLower];
    console.log(`📁 Using preset category: "${inputLower}"`);
    console.log(`   Wikipedia categories: ${categories.join(', ')}`);
  } else {
    // Treat as direct category name or search term
    console.log(`🔎 "${categoryInput}" is not a preset, searching Wikipedia...`);

    // First try as direct category
    const directCategories = [categoryInput.replace(/\s+/g, '_')];

    // Also search for related categories
    const searchResults = await searchWikipediaCategories(categoryInput);

    categories = [...directCategories, ...searchResults.slice(0, 3)];

    if (categories.length === 0) {
      throw new Error(`No Wikipedia categories found for "${categoryInput}"`);
    }
  }

  console.log(`\n📥 Fetching companies (limit: ${limit})...\n`);

  let totalInserted = 0;
  let totalProcessed = 0;
  const addedCompanies: Array<{ id: number; name: string; website_url: string | null }> = [];

  for (const category of categories) {
    if (totalInserted >= limit) break;

    console.log(`\n📂 Category: ${category}`);

    let continueToken: string | undefined;
    let categoryCount = 0;

    do {
      try {
        const data = await fetchCategoryMembers(category, continueToken);
        const members = data.query?.categorymembers || [];

        if (members.length === 0 && !continueToken) {
          console.log(`   ⚠ No companies found in this category`);
          break;
        }

        for (const member of members) {
          if (totalInserted >= limit) break;
          if (member.ns !== 0) continue; // Skip non-article pages

          totalProcessed++;
          const name = member.title;

          // Skip disambiguation pages and lists
          if (
            name.includes('(disambiguation)') ||
            name.startsWith('List of')
          ) {
            continue;
          }

          console.log(`   ${totalProcessed}. ${name}`);

          const wikipediaUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(name.replace(/ /g, '_'))}`;

          // Fetch company website from Wikipedia infobox
          console.log(`      ↳ Fetching website from Wikipedia...`);
          const websiteUrl = await fetchCompanyWebsite(name);

          if (websiteUrl) {
            console.log(`      ✓ Website: ${websiteUrl}`);
          } else {
            console.log(`      ⚠ No website found in Wikipedia infobox`);
          }

          // Small delay to be respectful to Wikipedia API
          await new Promise((resolve) => setTimeout(resolve, 150));

          // Check if company already exists (Postgres doesn't have INSERT OR IGNORE)
          const existing = await sql`
            SELECT id FROM companies WHERE name = ${name}
          `;

          if (existing.rows.length > 0) {
            console.log(`      → Already in database, skipped`);
            continue;
          }

          // Insert new company
          try {
            const company = await createCompany({
              name,
              wikipedia_url: wikipediaUrl,
              website_url: websiteUrl,
              category: categoryInput.toLowerCase(),
              region: region || undefined,
            });

            totalInserted++;
            categoryCount++;
            addedCompanies.push({
              id: company.id,
              name: company.name,
              website_url: company.website_url,
            });
            console.log(`      ✓ Added to database (#${totalInserted})`);
          } catch (error) {
            console.log(`      ⚠ Error adding company: ${error instanceof Error ? error.message : error}`);
          }
        }

        continueToken = data.continue?.cmcontinue;
      } catch (error) {
        console.log(
          `   ⚠ Error fetching category: ${error instanceof Error ? error.message : error}`
        );
        break;
      }
    } while (continueToken && totalInserted < limit);

    console.log(`   📊 Added ${categoryCount} from this category`);
  }

  console.log(`\n━━━ Discovery Complete ━━━`);
  console.log(`   Processed: ${totalProcessed} companies`);
  console.log(`   Added: ${totalInserted} new companies`);
  console.log(`   Skipped: ${totalProcessed - totalInserted} (duplicates/filtered)\n`);

  return {
    added: totalInserted,
    companies: addedCompanies,
  };
}

export function listCategories(): string[] {
  return Object.keys(CATEGORY_SHORTCUTS);
}

export function getCategoryShortcuts(): Record<string, string[]> {
  return CATEGORY_SHORTCUTS;
}
