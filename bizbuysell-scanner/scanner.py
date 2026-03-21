#!/usr/bin/env python3
"""
BizBuySell Listing Scanner
===========================
Scans bizbuysell.com for business listings based on your config.yaml filters.
Outputs clean HTML and CSV reports.

Usage:
    python scanner.py                    # Uses config.yaml in same directory
    python scanner.py --config my.yaml   # Uses a custom config file
    python scanner.py --dry-run          # Show what would be scanned without scraping
"""

import argparse
import asyncio
import csv
import hashlib
import json
import os
import random
import re
import sys
from datetime import datetime, timedelta
from pathlib import Path

import yaml
from playwright.async_api import async_playwright

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
BASE_URL = "https://www.bizbuysell.com"
SCRIPT_DIR = Path(__file__).resolve().parent
SEEN_FILE = SCRIPT_DIR / ".seen_listings.json"

# All US states in URL-slug format
ALL_STATES = [
    "alabama", "alaska", "arizona", "arkansas", "california", "colorado",
    "connecticut", "delaware", "florida", "georgia", "hawaii", "idaho",
    "illinois", "indiana", "iowa", "kansas", "kentucky", "louisiana",
    "maine", "maryland", "massachusetts", "michigan", "minnesota",
    "mississippi", "missouri", "montana", "nebraska", "nevada",
    "new-hampshire", "new-jersey", "new-mexico", "new-york",
    "north-carolina", "north-dakota", "ohio", "oklahoma", "oregon",
    "pennsylvania", "rhode-island", "south-carolina", "south-dakota",
    "tennessee", "texas", "utah", "vermont", "virginia", "washington",
    "west-virginia", "wisconsin", "wyoming",
]


# ---------------------------------------------------------------------------
# Config loader
# ---------------------------------------------------------------------------
def load_config(path: str) -> dict:
    with open(path, "r") as f:
        cfg = yaml.safe_load(f)
    return cfg


# ---------------------------------------------------------------------------
# URL builder
# ---------------------------------------------------------------------------
def build_search_urls(cfg: dict) -> list[str]:
    """Build the list of search URLs from config filters."""
    categories = cfg.get("categories") or [""]
    states = cfg.get("states") or [""]

    urls = []
    for cat in categories:
        for state in states:
            parts = []
            if state:
                parts.append(state)
            if cat:
                parts.append(cat)
            parts.append("businesses-for-sale")
            slug = "-".join(parts)
            urls.append(f"{BASE_URL}/{slug}/")
    return urls


# ---------------------------------------------------------------------------
# Parsing helpers
# ---------------------------------------------------------------------------
def parse_money(text: str) -> int | None:
    """Parse '$1,234,567' into 1234567."""
    if not text:
        return None
    cleaned = re.sub(r"[^\d]", "", text)
    return int(cleaned) if cleaned else None


def extract_listing_data(card) -> dict | None:
    """Extract structured data from a listing card element (Playwright locator)."""
    return card  # placeholder - actual extraction in async function


async def extract_listing_from_element(el) -> dict:
    """Extract listing data from a Playwright element handle."""
    data = {}

    # Title and URL
    title_el = await el.query_selector("h3 a, .title a, .listing-title a, a.diamond-heading")
    if not title_el:
        title_el = await el.query_selector("a[href*='/businesses-for-sale/']")
    if title_el:
        data["title"] = (await title_el.inner_text()).strip()
        href = await title_el.get_attribute("href")
        if href:
            data["url"] = href if href.startswith("http") else BASE_URL + href
    else:
        data["title"] = ""
        data["url"] = ""

    # Location
    loc_el = await el.query_selector(".listing-location, .location, [class*='location']")
    data["location"] = (await loc_el.inner_text()).strip() if loc_el else ""

    # Get all the key-value pairs from the listing (price, cash flow, revenue, etc.)
    full_text = await el.inner_text()
    lines = [line.strip() for line in full_text.split("\n") if line.strip()]

    data["asking_price"] = None
    data["cash_flow"] = None
    data["gross_revenue"] = None
    data["ebitda"] = None
    data["description"] = ""

    for i, line in enumerate(lines):
        line_lower = line.lower()
        if "asking price" in line_lower or "price" in line_lower:
            # Price might be on same line or next line
            price_match = re.search(r"\$[\d,]+", line)
            if price_match:
                data["asking_price"] = parse_money(price_match.group())
            elif i + 1 < len(lines):
                price_match = re.search(r"\$[\d,]+", lines[i + 1])
                if price_match:
                    data["asking_price"] = parse_money(price_match.group())

        if "cash flow" in line_lower:
            cf_match = re.search(r"\$[\d,]+", line)
            if cf_match:
                data["cash_flow"] = parse_money(cf_match.group())
            elif i + 1 < len(lines):
                cf_match = re.search(r"\$[\d,]+", lines[i + 1])
                if cf_match:
                    data["cash_flow"] = parse_money(cf_match.group())

        if "gross revenue" in line_lower or "revenue" in line_lower:
            rev_match = re.search(r"\$[\d,]+", line)
            if rev_match:
                data["gross_revenue"] = parse_money(rev_match.group())
            elif i + 1 < len(lines):
                rev_match = re.search(r"\$[\d,]+", lines[i + 1])
                if rev_match:
                    data["gross_revenue"] = parse_money(rev_match.group())

        if "ebitda" in line_lower:
            ebitda_match = re.search(r"\$[\d,]+", line)
            if ebitda_match:
                data["ebitda"] = parse_money(ebitda_match.group())

    # Description - usually a paragraph-like text
    desc_el = await el.query_selector(".listing-description, .description, p")
    if desc_el:
        data["description"] = (await desc_el.inner_text()).strip()

    # Generate a unique ID for dedup
    id_source = f"{data.get('title', '')}-{data.get('url', '')}"
    data["id"] = hashlib.md5(id_source.encode()).hexdigest()[:12]

    data["scraped_at"] = datetime.now().isoformat()

    return data


# ---------------------------------------------------------------------------
# Filtering
# ---------------------------------------------------------------------------
def passes_filters(listing: dict, cfg: dict) -> bool:
    """Check if a listing passes all config filters."""
    price_cfg = cfg.get("price") or {}
    cf_cfg = cfg.get("cash_flow") or {}
    rev_cfg = cfg.get("gross_revenue") or {}
    kw_include = cfg.get("keywords_include") or []
    kw_exclude = cfg.get("keywords_exclude") or []

    # Price filter
    price = listing.get("asking_price")
    if price is not None:
        if price_cfg.get("min") and price < price_cfg["min"]:
            return False
        if price_cfg.get("max") and price > price_cfg["max"]:
            return False

    # Cash flow filter
    cf = listing.get("cash_flow")
    if cf is not None:
        if cf_cfg.get("min") and cf < cf_cfg["min"]:
            return False
        if cf_cfg.get("max") and cf > cf_cfg["max"]:
            return False

    # Revenue filter
    rev = listing.get("gross_revenue")
    if rev is not None:
        if rev_cfg.get("min") and rev < rev_cfg["min"]:
            return False
        if rev_cfg.get("max") and rev > rev_cfg["max"]:
            return False

    # Keyword include (any match)
    if kw_include:
        text = f"{listing.get('title', '')} {listing.get('description', '')}".lower()
        if not any(kw.lower() in text for kw in kw_include):
            return False

    # Keyword exclude (any match = reject)
    if kw_exclude:
        text = f"{listing.get('title', '')} {listing.get('description', '')}".lower()
        if any(kw.lower() in text for kw in kw_exclude):
            return False

    return True


# ---------------------------------------------------------------------------
# Deduplication: track seen listings
# ---------------------------------------------------------------------------
def load_seen() -> dict:
    if SEEN_FILE.exists():
        with open(SEEN_FILE, "r") as f:
            return json.load(f)
    return {}


def save_seen(seen: dict):
    with open(SEEN_FILE, "w") as f:
        json.dump(seen, f)


def is_new_listing(listing: dict, seen: dict) -> bool:
    return listing["id"] not in seen


def mark_seen(listing: dict, seen: dict):
    seen[listing["id"]] = listing.get("scraped_at", datetime.now().isoformat())


# ---------------------------------------------------------------------------
# Main scanner
# ---------------------------------------------------------------------------
async def scan_page(page, url: str, cfg: dict) -> list[dict]:
    """Scan a single search results page and return listings."""
    scanner_cfg = cfg.get("scanner") or {}
    max_pages = scanner_cfg.get("max_pages", 10)
    min_delay = scanner_cfg.get("min_delay", 2)
    max_delay = scanner_cfg.get("max_delay", 5)

    all_listings = []

    for page_num in range(1, max_pages + 1):
        page_url = url if page_num == 1 else f"{url}{page_num}/"
        print(f"  Scanning: {page_url}")

        try:
            await page.goto(page_url, wait_until="domcontentloaded", timeout=30000)
            await page.wait_for_timeout(2000)  # Let dynamic content load
        except Exception as e:
            print(f"  Error loading {page_url}: {e}")
            break

        # Find listing cards - bizbuysell uses various selectors
        cards = await page.query_selector_all(
            ".listing, .search-result, [class*='listing-card'], "
            "[class*='BusinessListings'], .result-card, "
            "div[class*='result'] > div[class*='listing']"
        )

        # Fallback: try broader selectors if nothing found
        if not cards:
            cards = await page.query_selector_all(
                "#search-results .card, .search-results-container > div, "
                "[data-listing-id]"
            )

        if not cards:
            print(f"  No listings found on page {page_num}, stopping pagination.")
            break

        print(f"  Found {len(cards)} listing cards on page {page_num}")

        for card in cards:
            try:
                listing = await extract_listing_from_element(card)
                if listing.get("title"):  # Only keep listings with a title
                    all_listings.append(listing)
            except Exception as e:
                print(f"  Error extracting listing: {e}")
                continue

        # Check if there's a next page
        next_btn = await page.query_selector(
            "a.next, a[rel='next'], .pagination .next, "
            "[class*='pager'] a:has-text('Next'), [class*='pager'] a:has-text('›')"
        )
        if not next_btn:
            break

        # Respectful delay
        delay = random.uniform(min_delay, max_delay)
        await page.wait_for_timeout(int(delay * 1000))

    return all_listings


async def run_scanner(cfg: dict, dry_run: bool = False) -> list[dict]:
    """Run the full scanner pipeline."""
    urls = build_search_urls(cfg)

    if dry_run:
        print("\n--- DRY RUN: Would scan these URLs ---")
        for u in urls:
            print(f"  {u}")
        print(f"\nTotal search URLs: {len(urls)}")
        print("Filters active:")
        if cfg.get("price", {}).get("min") or cfg.get("price", {}).get("max"):
            print(f"  Price: {cfg['price']}")
        if cfg.get("cash_flow", {}).get("min") or cfg.get("cash_flow", {}).get("max"):
            print(f"  Cash Flow: {cfg['cash_flow']}")
        if cfg.get("gross_revenue", {}).get("min") or cfg.get("gross_revenue", {}).get("max"):
            print(f"  Revenue: {cfg['gross_revenue']}")
        if cfg.get("keywords_include"):
            print(f"  Keywords include: {cfg['keywords_include']}")
        if cfg.get("keywords_exclude"):
            print(f"  Keywords exclude: {cfg['keywords_exclude']}")
        return []

    scanner_cfg = cfg.get("scanner") or {}
    headless = scanner_cfg.get("headless", True)

    seen = load_seen()
    all_listings = []

    print(f"\nStarting BizBuySell scanner at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Scanning {len(urls)} search URL(s)...\n")

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=headless)
        context = await browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
            ),
            viewport={"width": 1920, "height": 1080},
        )
        page = await context.new_page()

        for url in urls:
            print(f"\n--- Scanning: {url} ---")
            try:
                listings = await scan_page(page, url, cfg)
                all_listings.extend(listings)
            except Exception as e:
                print(f"Error scanning {url}: {e}")

            # Delay between different search URLs
            delay = random.uniform(3, 6)
            await page.wait_for_timeout(int(delay * 1000))

        await browser.close()

    # Deduplicate
    unique = {}
    for listing in all_listings:
        unique[listing["id"]] = listing
    all_listings = list(unique.values())

    print(f"\nTotal unique listings scraped: {len(all_listings)}")

    # Apply filters
    filtered = [l for l in all_listings if passes_filters(l, cfg)]
    print(f"Listings after filters: {len(filtered)}")

    # Mark new vs seen
    new_listings = [l for l in filtered if is_new_listing(l, seen)]
    print(f"New listings (not seen before): {len(new_listings)}")

    # Update seen
    for listing in filtered:
        mark_seen(listing, seen)
    save_seen(seen)

    return filtered


# ---------------------------------------------------------------------------
# Report generators
# ---------------------------------------------------------------------------
def format_currency(val) -> str:
    if val is None:
        return "N/A"
    return f"${val:,.0f}"


def generate_csv(listings: list[dict], output_dir: Path):
    output_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y-%m-%d")
    filepath = output_dir / f"bizbuysell-{timestamp}.csv"

    fields = [
        "title", "location", "asking_price", "cash_flow",
        "gross_revenue", "ebitda", "description", "url", "scraped_at",
    ]

    with open(filepath, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        for listing in listings:
            row = {**listing}
            row["asking_price"] = format_currency(row.get("asking_price"))
            row["cash_flow"] = format_currency(row.get("cash_flow"))
            row["gross_revenue"] = format_currency(row.get("gross_revenue"))
            row["ebitda"] = format_currency(row.get("ebitda"))
            writer.writerow(row)

    print(f"CSV report saved: {filepath}")
    return filepath


def generate_html(listings: list[dict], output_dir: Path, cfg: dict):
    output_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y-%m-%d")
    filepath = output_dir / f"bizbuysell-{timestamp}.html"

    # Sort by asking price descending (None values at end)
    listings_sorted = sorted(
        listings,
        key=lambda x: x.get("asking_price") or 0,
        reverse=True,
    )

    rows_html = ""
    for i, l in enumerate(listings_sorted, 1):
        title = l.get("title", "Untitled")
        url = l.get("url", "#")
        rows_html += f"""
        <tr>
            <td>{i}</td>
            <td><a href="{url}" target="_blank">{title}</a></td>
            <td>{l.get('location', 'N/A')}</td>
            <td>{format_currency(l.get('asking_price'))}</td>
            <td>{format_currency(l.get('cash_flow'))}</td>
            <td>{format_currency(l.get('gross_revenue'))}</td>
            <td class="desc">{l.get('description', '')[:200]}</td>
        </tr>"""

    # Build active filters summary
    filters_summary = []
    price_cfg = cfg.get("price") or {}
    if price_cfg.get("min") or price_cfg.get("max"):
        filters_summary.append(
            f"Price: {format_currency(price_cfg.get('min'))} - {format_currency(price_cfg.get('max'))}"
        )
    cf_cfg = cfg.get("cash_flow") or {}
    if cf_cfg.get("min") or cf_cfg.get("max"):
        filters_summary.append(
            f"Cash Flow: {format_currency(cf_cfg.get('min'))} - {format_currency(cf_cfg.get('max'))}"
        )
    if cfg.get("categories"):
        filters_summary.append(f"Categories: {', '.join(cfg['categories'])}")
    if cfg.get("states"):
        filters_summary.append(f"States: {', '.join(cfg['states'])}")
    if cfg.get("keywords_include"):
        filters_summary.append(f"Keywords: {', '.join(cfg['keywords_include'])}")
    if cfg.get("keywords_exclude"):
        filters_summary.append(f"Excluding: {', '.join(cfg['keywords_exclude'])}")

    filters_html = "".join(f"<li>{f}</li>" for f in filters_summary)
    if not filters_html:
        filters_html = "<li>No filters active (showing all results)</li>"

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>BizBuySell Scanner Report - {timestamp}</title>
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f5f5f5; color: #333; padding: 2rem;
        }}
        .container {{ max-width: 1400px; margin: 0 auto; }}
        h1 {{ font-size: 1.8rem; margin-bottom: 0.5rem; color: #1a1a2e; }}
        .meta {{ color: #666; margin-bottom: 1.5rem; font-size: 0.9rem; }}
        .filters {{
            background: #e8f4f8; border-radius: 8px; padding: 1rem 1.5rem;
            margin-bottom: 1.5rem;
        }}
        .filters h3 {{ font-size: 0.95rem; color: #2c3e50; margin-bottom: 0.5rem; }}
        .filters ul {{ list-style: none; display: flex; flex-wrap: wrap; gap: 0.5rem; }}
        .filters li {{
            background: #fff; padding: 0.3rem 0.8rem; border-radius: 20px;
            font-size: 0.85rem; border: 1px solid #b8d4e3;
        }}
        .stats {{
            display: flex; gap: 1rem; margin-bottom: 1.5rem; flex-wrap: wrap;
        }}
        .stat-card {{
            background: #fff; padding: 1rem 1.5rem; border-radius: 8px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1); flex: 1; min-width: 150px;
        }}
        .stat-card .number {{ font-size: 1.5rem; font-weight: 700; color: #2c3e50; }}
        .stat-card .label {{ font-size: 0.8rem; color: #888; text-transform: uppercase; }}
        table {{
            width: 100%; border-collapse: collapse; background: #fff;
            border-radius: 8px; overflow: hidden;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }}
        th {{
            background: #2c3e50; color: #fff; padding: 0.8rem 1rem;
            text-align: left; font-size: 0.85rem; text-transform: uppercase;
            letter-spacing: 0.05em;
        }}
        td {{
            padding: 0.7rem 1rem; border-bottom: 1px solid #eee;
            font-size: 0.9rem; vertical-align: top;
        }}
        tr:hover {{ background: #f8f9fa; }}
        td a {{ color: #2980b9; text-decoration: none; font-weight: 500; }}
        td a:hover {{ text-decoration: underline; }}
        .desc {{ max-width: 300px; font-size: 0.8rem; color: #666; }}
        .empty {{ text-align: center; padding: 3rem; color: #999; }}

        /* Sortable headers */
        th.sortable {{ cursor: pointer; user-select: none; }}
        th.sortable:hover {{ background: #34495e; }}
        th.sortable::after {{ content: ' \\2195'; opacity: 0.5; }}

        /* Search box */
        .search-box {{
            margin-bottom: 1rem;
        }}
        .search-box input {{
            width: 100%; max-width: 400px; padding: 0.6rem 1rem;
            border: 1px solid #ddd; border-radius: 6px; font-size: 0.95rem;
        }}
        .search-box input:focus {{ outline: none; border-color: #2980b9; }}
    </style>
</head>
<body>
    <div class="container">
        <h1>BizBuySell Listing Scanner</h1>
        <p class="meta">Report generated: {datetime.now().strftime('%B %d, %Y at %I:%M %p')}</p>

        <div class="filters">
            <h3>Active Filters</h3>
            <ul>{filters_html}</ul>
        </div>

        <div class="stats">
            <div class="stat-card">
                <div class="number">{len(listings_sorted)}</div>
                <div class="label">Total Listings</div>
            </div>
            <div class="stat-card">
                <div class="number">{format_currency(
                    sum(l.get('asking_price') or 0 for l in listings_sorted) / max(len(listings_sorted), 1)
                ) if listings_sorted else 'N/A'}</div>
                <div class="label">Avg Asking Price</div>
            </div>
            <div class="stat-card">
                <div class="number">{format_currency(
                    sum(l.get('cash_flow') or 0 for l in listings_sorted if l.get('cash_flow')) /
                    max(len([l for l in listings_sorted if l.get('cash_flow')]), 1)
                ) if any(l.get('cash_flow') for l in listings_sorted) else 'N/A'}</div>
                <div class="label">Avg Cash Flow</div>
            </div>
        </div>

        <div class="search-box">
            <input type="text" id="searchInput" placeholder="Filter results... (type to search)" onkeyup="filterTable()">
        </div>

        <table id="listingsTable">
            <thead>
                <tr>
                    <th>#</th>
                    <th class="sortable" onclick="sortTable(1)">Business</th>
                    <th class="sortable" onclick="sortTable(2)">Location</th>
                    <th class="sortable" onclick="sortTable(3)">Asking Price</th>
                    <th class="sortable" onclick="sortTable(4)">Cash Flow</th>
                    <th class="sortable" onclick="sortTable(5)">Revenue</th>
                    <th>Description</th>
                </tr>
            </thead>
            <tbody>
                {rows_html if rows_html else '<tr><td colspan="7" class="empty">No listings found matching your filters.</td></tr>'}
            </tbody>
        </table>
    </div>

    <script>
        // Client-side table search
        function filterTable() {{
            const input = document.getElementById('searchInput').value.toLowerCase();
            const rows = document.querySelectorAll('#listingsTable tbody tr');
            rows.forEach(row => {{
                const text = row.textContent.toLowerCase();
                row.style.display = text.includes(input) ? '' : 'none';
            }});
        }}

        // Client-side column sorting
        let sortDir = {{}};
        function sortTable(col) {{
            const table = document.getElementById('listingsTable');
            const tbody = table.querySelector('tbody');
            const rows = Array.from(tbody.querySelectorAll('tr'));
            sortDir[col] = !sortDir[col];
            rows.sort((a, b) => {{
                let aVal = a.cells[col]?.textContent.trim() || '';
                let bVal = b.cells[col]?.textContent.trim() || '';
                // Try numeric sort for price columns
                const aNum = parseFloat(aVal.replace(/[^\\d.-]/g, ''));
                const bNum = parseFloat(bVal.replace(/[^\\d.-]/g, ''));
                if (!isNaN(aNum) && !isNaN(bNum)) {{
                    return sortDir[col] ? aNum - bNum : bNum - aNum;
                }}
                return sortDir[col] ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
            }});
            rows.forEach(row => tbody.appendChild(row));
        }}
    </script>
</body>
</html>"""

    with open(filepath, "w", encoding="utf-8") as f:
        f.write(html)

    print(f"HTML report saved: {filepath}")
    return filepath


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
async def main():
    parser = argparse.ArgumentParser(description="BizBuySell Listing Scanner")
    parser.add_argument(
        "--config", default=str(SCRIPT_DIR / "config.yaml"),
        help="Path to config YAML file",
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Show what would be scanned without actually scraping",
    )
    parser.add_argument(
        "--reset-seen", action="store_true",
        help="Clear the seen listings cache (treat all as new)",
    )
    args = parser.parse_args()

    if not os.path.exists(args.config):
        print(f"Config file not found: {args.config}")
        sys.exit(1)

    cfg = load_config(args.config)

    if args.reset_seen and SEEN_FILE.exists():
        SEEN_FILE.unlink()
        print("Seen listings cache cleared.")

    listings = await run_scanner(cfg, dry_run=args.dry_run)

    if args.dry_run:
        return

    if not listings:
        print("\nNo listings found matching your criteria.")
        return

    # Generate reports
    output_cfg = cfg.get("output") or {}
    output_dir = Path(args.config).parent / (output_cfg.get("directory", "./reports"))

    if output_cfg.get("csv", True):
        generate_csv(listings, output_dir)

    if output_cfg.get("html", True):
        generate_html(listings, output_dir, cfg)

    print(f"\nDone! Found {len(listings)} listings.")


if __name__ == "__main__":
    asyncio.run(main())
