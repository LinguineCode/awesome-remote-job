# CarFinder

AI-powered car listing search. Finds the exact cars you want — no junk, no digging.

## Architecture

100% AWS serverless, managed with Terraform.

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  CloudFront  │────▸│  S3 Bucket   │     │  EventBridge │
│  (CDN + SPA) │     │  (Frontend)  │     │  (Daily Cron)│
└──────┬───────┘     └──────────────┘     └──────┬───────┘
       │ /api/*                                   │
       ▼                                          ▼
┌──────────────┐                         ┌──────────────────┐
│ API Gateway  │────▸ Lambda (API)       │ Lambda (Pipeline)│
│  (HTTP API)  │                         │ Search → Scrape  │
└──────────────┘                         │ → Filter → Email │
       │                                 └────────┬─────────┘
       ▼                                          │
┌──────────────┐     ┌──────────┐     ┌───────────▼─────┐
│   DynamoDB   │     │   SES    │     │  External APIs  │
│  (5 tables)  │     │ (Email)  │     │ Serper, Firecrawl│
└──────────────┘     └──────────┘     │ OpenAI          │
                                      └─────────────────┘
```

## Daily Pipeline

```
EventBridge (6 AM UTC)
  → Lambda: For each active search profile:
    1. Google Search (via Serper.dev) → find listing URLs
    2. Firecrawl → AI-extract structured data from each page
    3. Hard filter → eliminate obvious non-matches
    4. AI soft filter (GPT-4o-mini) → score relevance + eval AI notes
    5. Store matches in DynamoDB
  → Send daily digest emails via SES
```

## The Killer Feature: AI Notes

Write search criteria in plain English:

> "Must be a 997.1 (2005-2008). No Carrera 4 or 4S. Prefer Seal Grey or Arctic Silver. Must have sport chrono. Manual only."

The AI reads every listing and evaluates it against your notes.

## Tech Stack

| Component | Service | Cost |
|-----------|---------|------|
| Frontend | S3 + CloudFront | ~$0 |
| API | API Gateway + Lambda | ~$0 (free tier) |
| Database | DynamoDB (on-demand) | ~$0 |
| Cron | EventBridge Scheduler | $0 |
| Email | SES | $0.10/1000 emails |
| Google Search | Serper.dev | $50/50k searches |
| Web Scraping | Firecrawl | $19/mo (500 pages) |
| AI Filtering | OpenAI GPT-4o-mini | ~$1-2/mo |
| **Total** | | **~$20-25/mo** |

## Getting Started

### 1. Prerequisites

- AWS CLI configured
- Terraform >= 1.5
- Node.js >= 20
- API keys: Serper.dev, Firecrawl, OpenAI

### 2. Deploy Infrastructure

```bash
cd infrastructure
terraform init
terraform plan -var-file=terraform.tfvars
terraform apply -var-file=terraform.tfvars
```

### 3. Build & Deploy Backend

```bash
cd backend
npm install
npm run build
# Zip files are created at dist/api.zip and dist/cron.zip
# Terraform references these — re-run terraform apply
```

### 4. Build & Deploy Frontend

```bash
npm install
npm run build
# Deploy the `out/` directory to S3
aws s3 sync out/ s3://$(terraform -chdir=infrastructure output -raw frontend_bucket) --delete
aws cloudfront create-invalidation --distribution-id $(terraform -chdir=infrastructure output -raw cloudfront_distribution_id) --paths "/*"
```

### 5. Verify SES Email

Before sending emails, verify your sender email in SES:
```bash
aws ses verify-email-identity --email-address notifications@carfinder.app
```

## Unsubscribe Flow

1. Every email footer has **Unsubscribe** | **Manage Searches** | **Settings** links
2. Clicking "Unsubscribe" is a one-click GET with a signed JWT — no login required
3. Lands on a confirmation page with option to resubscribe
4. Settings page has an explicit email notifications toggle
5. Individual searches can be paused independently

## Project Structure

```
infrastructure/     Terraform (DynamoDB, Lambda, API GW, EventBridge, SES, S3+CF)
backend/            Lambda functions (TypeScript, esbuild)
  src/shared/       DB, auth, Google search, Firecrawl, AI filter, email
  src/api/          API Gateway handler (auth, searches, results, unsubscribe)
  src/cron/         Daily pipeline (search → scrape → filter → notify)
  src/templates/    Email digest HTML template
src/                Next.js frontend (static export)
  app/              Pages (dashboard, searches, settings, unsubscribe)
  components/       React components
  lib/              API client
  types/            TypeScript types
```
