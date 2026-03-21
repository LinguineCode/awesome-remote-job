# BizBuySell Listing Scanner

Scans [bizbuysell.com](https://www.bizbuysell.com) daily for business-for-sale listings. Fully configurable filters. Outputs clean HTML reports (with search + sort) and CSV.

Uses **Playwright** (headless Chromium) — the modern standard for reliable web scraping that handles bot protection and JavaScript-rendered pages.

## Quick Start

```bash
# 1. Install dependencies
pip install -r requirements.txt
playwright install chromium

# 2. Edit your filters
nano config.yaml

# 3. Run the scanner
python scanner.py

# 4. Open the report
open reports/bizbuysell-*.html
```

## Configuration

All filters are in **`config.yaml`**. Edit it to control exactly what you see:

| Filter | Example | Description |
|--------|---------|-------------|
| `price.min` / `price.max` | `50000` / `500000` | Asking price range |
| `cash_flow.min` / `cash_flow.max` | `100000` / `null` | Annual cash flow range |
| `gross_revenue.min` / `gross_revenue.max` | `200000` / `null` | Annual revenue range |
| `categories` | `[restaurants-and-food]` | Industry categories (see config for full list) |
| `states` | `[california, texas]` | US states (empty = nationwide) |
| `keywords_include` | `[SaaS, franchise]` | Only show listings with these words |
| `keywords_exclude` | `[consulting]` | Hide listings with these words |
| `max_listing_age_days` | `7` | Only recent listings |

## CLI Options

```bash
python scanner.py                     # Normal scan
python scanner.py --dry-run           # Preview what URLs will be scanned
python scanner.py --config my.yaml    # Use a custom config
python scanner.py --reset-seen        # Clear seen cache, treat all as new
```

## Daily Cron Job

Run automatically every day at 8 AM:

```bash
# Edit your crontab
crontab -e

# Add this line (adjust the path):
0 8 * * * cd /path/to/bizbuysell-scanner && /usr/bin/python3 scanner.py >> /var/log/bizbuysell-scanner.log 2>&1
```

## Output

Reports are saved to `./reports/`:

- **HTML** — Open in any browser. Includes search bar, sortable columns, stats summary.
- **CSV** — Open in Excel, Google Sheets, or any spreadsheet app.

The scanner tracks previously seen listings in `.seen_listings.json` so you can spot new ones.

## How It Works

1. Builds search URLs from your config (categories + states)
2. Launches headless Chromium via Playwright
3. Scrapes listing cards from each search results page
4. Applies your price, cash flow, revenue, and keyword filters
5. Deduplicates against previously seen listings
6. Generates HTML + CSV reports
