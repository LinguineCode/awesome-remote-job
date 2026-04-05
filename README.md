# CarFinder

AI-powered car listing search that finds the exact cars you want — no junk, no digging.

## What it does

CarFinder searches across Craigslist, AutoTempest, and other sources daily. It uses AI to:

1. **Extract structured data** from messy listings (normalizes misspelled makes, finds mileage buried in descriptions)
2. **Score relevance** against your criteria including freeform AI notes ("must be a 997.1, prefer sport chrono")
3. **Flag issues** like potential scams, below-market prices, salvage titles
4. **Send a daily digest** email with only high-confidence matches

## The Killer Feature: AI Notes

Normal car filters can't tell a 997.1 from a 997.2. CarFinder can. Write your search criteria in plain English:

> "Must be a 997.1 (2005-2008). No Carrera 4 or 4S. Prefer Seal Grey or Arctic Silver. Must have sport chrono package. Manual only."

The AI reads every listing description and evaluates it against your notes.

## Tech Stack

- **Next.js 15** (App Router) — frontend + API routes + cron endpoints
- **Supabase** (PostgreSQL) — database, free tier
- **OpenAI GPT-4o-mini** — AI extraction and filtering (~$0.001/listing)
- **Resend** — email notifications, 3k/month free
- **Tailwind CSS** — styling
- **Vercel** — hosting + cron jobs

## Getting Started

### 1. Clone and install

```bash
git clone <repo-url>
cd awesome-remote-job
npm install
```

### 2. Set up Supabase

1. Create a Supabase project at [supabase.com](https://supabase.com)
2. Run the migration: copy `supabase/migrations/001_initial_schema.sql` into the Supabase SQL editor and execute
3. Copy your project URL, anon key, and service role key

### 3. Configure environment

```bash
cp .env.local.example .env.local
# Fill in your keys
```

### 4. Run locally

```bash
npm run dev
```

### 5. Deploy to Vercel

```bash
vercel deploy
```

Set the same environment variables in Vercel's dashboard. The cron jobs in `vercel.json` will automatically run daily.

## Architecture

```
Daily Pipeline:
  6 AM → Scrape (Craigslist RSS, AutoTempest) → Store listings
  7 AM → Filter (Hard filter SQL → AI soft filter) → Store matches
  8 AM → Notify (Render email → Send via Resend) → Mark notified
```

## Cost

For ~50 users: **$0-5/month** (Vercel free, Supabase free, Resend free, OpenAI < $2)
