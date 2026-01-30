# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**sponsor-pathfinder** - A CLI tool to discover, qualify, and route sponsorship leads for the Panna World Championship using only free, legal, publicly available data sources.

## Tech Stack

- Node.js + TypeScript
- SQLite (better-sqlite3)
- Cheerio (HTML parsing)
- Commander (CLI)
- OpenAI SDK (AI-generated outreach)

## Build & Run Commands

```bash
npm run build          # Compile TypeScript
npm run start          # Run CLI (ts-node)

# CLI Commands
npx ts-node src/index.ts discover -c sportswear       # Discover companies
npx ts-node src/index.ts qualify --all                # Qualify companies
npx ts-node src/index.ts daily_sponsors --count 3     # Generate digest
npx ts-node src/index.ts status                       # Show DB status
npx ts-node src/index.ts list                         # List companies
```

## Architecture

```
src/
├── index.ts                 # CLI entry point (Commander)
├── db/
│   ├── connection.ts        # SQLite connection singleton
│   └── schema.ts            # Table definitions + TypeScript interfaces
├── discovery/
│   └── wikipedia.ts         # Wikipedia API for company discovery by category
├── qualification/
│   ├── crawler.ts           # Rate-limited website fetcher
│   └── analyzer.ts          # Sponsorship signal extraction & scoring
├── contacts/
│   ├── extractor.ts         # Email/form extraction from HTML
│   └── linkedin.ts          # LinkedIn search URL generator (no scraping)
├── people/
│   └── extractor.ts         # Human name extraction from pages/Wikipedia
├── ranking/
│   └── pathSelector.ts      # Best contact path selection logic
├── outreach/
│   └── generator.ts         # OpenAI-powered message generation
└── digest/
    └── markdown.ts          # Daily markdown digest output
```

## Data Pipeline

1. **Discovery** (`discover`) - Query Wikipedia API by category (sportswear, fashion, etc.) to find company names
2. **Qualification** (`qualify`) - Crawl company websites, extract sponsorship signals, score fit
3. **Contact Extraction** - Find emails (partnerships@, marketing@), forms, agency mentions
4. **People Extraction** - Find decision-maker names from team pages and Wikipedia
5. **Path Selection** - Rank: named_email > inbox > agency > form > linkedin
6. **Outreach** (`daily_sponsors`) - Generate AI messages via OpenAI GPT, create follow-up sequence

## Database Schema

Tables: `companies`, `sponsorship_signals`, `contact_paths`, `people`, `outreach`, `followups`

Key fields:
- `companies.status`: 'unqualified' | 'qualified' | 'rejected'
- `companies.qualification_score`: 0-100+ based on signal matches
- `contact_paths.is_primary`: Best contact path flag

## Environment Variables

```
OPENAI_API_KEY=sk-...   # Required for AI outreach generation
```

## Domain Context

See [about_the_championship.md](about_the_championship.md) for details about the Panna World Championship - a youth-driven, urban street football event targeting Gen Z/Millennial audiences.
