# brand-finder

Find brands to work with:

Tech stack (proposed, but can be changed if there is a better use).

- Node.js + TypeScript
- SQLite
- Fetch / Cheerio for HTML parsing
- Wikipedia API
- OpenCorporates API
- Markdown output

## 1 — Scaffold

- Create a Node.js TypeScript project called **sponsor-pathfinder**.
- Include SQLite DB with tables: `companies`, `people`, `contact_paths`, `outreach`, `followups`.
- Add a CLI command: `daily_sponsors`.

## 2 — Company & page crawler

- Implement a crawler that fetches allowed pages from a company website (contact, about, press, partnerships).
- Extract emails, forms, agency mentions, and store with source URLs.

## 3 — Human name extraction

- Implement a module that pulls named executives from Wikipedia API and company leadership pages.
- Store name, role, relevance score, and source.

## 4 — Contact path selector

- Implement logic to rank contact paths:
  - named email > partnerships inbox > agency > LinkedIn route.
- Output the best path per company.

## 5 — Outreach generator

- Generate outreach messages customized to the selected contact path, plus a 10-day follow-up plan.

## 6 — Daily digest

- Output a single markdown file per day with 3 sponsors, contact paths, outreach copy, and follow-up checklist.
