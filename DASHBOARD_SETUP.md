# Dashboard Setup & Deployment Guide

## What We Built

A full-stack React + Node.js dashboard for the sponsor-pathfinder CLI tool with:

- **Frontend**: React + Vite + Tailwind CSS
- **Backend**: Vercel Serverless Functions (6 API endpoints)
- **Database**: Vercel Postgres
- **Auth**: Basic password protection

## Project Structure

```
brand-finder/
├── api/                         # Vercel serverless API functions
│   ├── companies.ts            # GET /api/companies (list & detail)
│   ├── discover.ts             # POST /api/discover
│   ├── qualify.ts              # POST /api/qualify?id={id}
│   ├── generate-message.ts     # POST /api/generate-message?id={id}
│   └── update-status.ts        # PATCH /api/update-status?id={id}
├── frontend/                    # React dashboard
│   ├── src/
│   │   ├── pages/
│   │   │   ├── DashboardPage.tsx
│   │   │   └── CompanyPage.tsx
│   │   ├── lib/
│   │   │   └── api.ts          # API client
│   │   └── types/
│   │       └── index.ts        # TypeScript types
│   └── package.json
├── lib/                         # Shared backend logic
│   ├── db.ts                   # Postgres connection + helpers
│   └── discovery.ts            # Wikipedia discovery logic
├── middleware.ts                # Basic auth middleware
├── vercel.json                  # Vercel deployment config
└── postgres-schema.sql          # Database schema

```

## Deployment Steps

### 1. Create Vercel Account & Install CLI

```bash
npm install -g vercel
vercel login
```

### 2. Create Vercel Postgres Database

1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Create a new project or select your existing project
3. Go to the "Storage" tab
4. Click "Create Database" → Select "Postgres"
5. Follow the setup wizard (choose a region close to you)
6. Copy the connection string (POSTGRES_URL)

### 3. Run the Database Schema

Once your Postgres database is created, run the schema to create tables:

**Option A: Using Vercel Dashboard**
1. Go to your Postgres database in Vercel dashboard
2. Click on the "Query" tab
3. Copy and paste the contents of `postgres-schema.sql`
4. Click "Run Query"

**Option B: Using psql CLI**
```bash
# Get the POSTGRES_URL from Vercel dashboard
psql "YOUR_POSTGRES_URL_HERE" < postgres-schema.sql
```

### 4. Set Environment Variables

Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

Edit `.env` and add your values:

```env
OPENAI_API_KEY=sk-...                           # Your OpenAI API key
POSTGRES_URL=postgres://user:pass@host/db       # From Vercel Postgres (step 2)
DASHBOARD_PASSWORD=your-secure-password         # Choose a password
```

**Also set these in Vercel Dashboard:**
1. Go to your project → Settings → Environment Variables
2. Add:
   - `OPENAI_API_KEY` (your OpenAI key)
   - `DASHBOARD_PASSWORD` (your chosen password)
   - `POSTGRES_URL` will be auto-set by Vercel when you link the database

### 5. Deploy to Vercel

```bash
# From the project root
vercel

# Follow the prompts:
# - Set up and deploy? Yes
# - Which scope? Your account
# - Link to existing project? No (first time)
# - What's your project's name? brand-finder (or your choice)
# - In which directory is your code located? ./
# - Want to modify settings? No

# For production deployment:
vercel --prod
```

### 6. Link Postgres Database to Project

In the Vercel dashboard:
1. Go to your deployed project
2. Go to Settings → Storage
3. Connect your Postgres database to the project
4. Vercel will automatically inject `POSTGRES_URL` environment variable

### 7. Access the Dashboard

Once deployed, Vercel will give you a URL like: `https://brand-finder.vercel.app`

Open the URL in your browser. You'll be prompted for a password (use the `DASHBOARD_PASSWORD` you set).

## Features

### Dashboard Page (/)
- View all companies in a sortable table
- Filter by status (qualified/unqualified/rejected)
- Filter by minimum qualification score
- Search by company name or website
- "Discover Companies" button to add new companies via Wikipedia keywords
- "Qualify" button to run qualification pipeline on unqualified companies
- Quick stats: Total companies, Qualified count, Average score

### Company Detail Page (/companies/:id)
- View company details (name, website, score, status)
- See all sponsorship signals found (partnership, youth, sport, etc.)
- View contact paths (emails, forms, agencies) with confidence scores
- List decision makers (if found)
- Generate AI-powered outreach messages with OpenAI
- Copy subject and body to clipboard
- Re-qualify company (re-run the qualification pipeline)
- Update company status (qualified/unqualified/rejected)

## API Endpoints

All endpoints support CORS and return JSON.

**GET /api/companies**
- List companies with optional filters
- Query params: `status`, `minScore`, `search`, `limit`, `offset`

**GET /api/companies?id={id}**
- Get single company with all related data (signals, contacts, people, outreach)

**POST /api/discover**
- Discover companies from Wikipedia
- Body: `{ keywords: string, region?: string, limit?: number }`
- Example: `{ "keywords": "sportswear", "limit": 20 }`

**POST /api/qualify?id={id}**
- Run qualification pipeline on a company
- Creates signals and contact paths
- Updates qualification score and status

**POST /api/generate-message?id={id}**
- Generate AI-powered outreach message
- Uses OpenAI GPT-4o-mini
- Saves to `outreach` table

**PATCH /api/update-status?id={id}**
- Update company status and/or score
- Body: `{ status?: string, qualification_score?: number }`

## Local Development

### Run Frontend Dev Server

```bash
cd frontend
npm run dev
```

Frontend will run on `http://localhost:5173`

### Run API Locally with Vercel Dev

```bash
# From project root
vercel dev
```

This will:
- Start API functions on `http://localhost:3000`
- Auto-load environment variables from `.env`
- Simulate Vercel's serverless environment

### Test Full Stack

1. Start Vercel dev server: `vercel dev`
2. In another terminal, start frontend: `cd frontend && npm run dev`
3. Update frontend `.env` to point to local API:
   ```
   # frontend/.env
   VITE_API_BASE=http://localhost:3000
   ```
4. Open `http://localhost:5173` in browser

## Troubleshooting

### "Cannot connect to database"
- Ensure `POSTGRES_URL` is set correctly in Vercel dashboard
- Check that your IP is allowed (Vercel Postgres allows all IPs by default)
- Verify the database exists and schema has been run

### "Authentication required" on every page
- Check that `DASHBOARD_PASSWORD` environment variable is set in Vercel
- Redeploy after setting environment variables: `vercel --prod`

### "OPENAI_API_KEY not set"
- Add your OpenAI API key to Vercel environment variables
- Redeploy: `vercel --prod`

### API returns CORS errors
- The API endpoints have CORS enabled by default (`Access-Control-Allow-Origin: *`)
- If still seeing errors, check `vercel.json` headers configuration

### Qualification doesn't work / shows placeholder data
- The current implementation uses simplified qualification logic
- Full crawler/analyzer logic can be added later by extracting from CLI code

## Next Steps

### Enhance Qualification Pipeline
Currently, the `/api/qualify` endpoint creates placeholder signals and contacts. To add full qualification:

1. Extract remaining CLI logic:
   - `src/qualification/crawler.ts` → `lib/crawler.ts`
   - `src/qualification/analyzer.ts` → `lib/analyzer.ts`
   - `src/contacts/extractor.ts` → `lib/contacts.ts`
   - `src/people/extractor.ts` → `lib/people.ts`

2. Update `api/qualify.ts` to use the full pipeline

### Add Features
- Bulk qualification (select multiple companies)
- Export companies to CSV
- Advanced filtering (by category, region)
- Charts and analytics on Overview page
- Email sending integration (SendGrid, Mailgun)
- Scheduled discovery/qualification jobs

## Support

For issues or questions:
- Check the [main README](README.md)
- Review the [plan file](.claude/plans/zazzy-munching-meteor.md)
- File an issue or ask for help

---

Built with Claude Code ✨
