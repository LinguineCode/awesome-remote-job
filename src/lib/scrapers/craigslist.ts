import type { RawListing, SearchProfile } from "@/types";
import type { Scraper } from "./types";
import { DEFAULT_SCRAPER_CONFIG, buildSearchQuery, delay } from "./types";
import { parsePrice, parseYear } from "@/lib/utils/normalize";

// Major Craigslist cities by region
const CRAIGSLIST_CITIES = [
  "newyork", "losangeles", "chicago", "houston", "phoenix",
  "philadelphia", "sanantonio", "sandiego", "dallas", "sfbay",
  "seattle", "denver", "boston", "atlanta", "miami",
  "minneapolis", "detroit", "portland", "austin", "nashville",
];

function getCitiesForStates(states: string[] | null): string[] {
  // If no states specified, search top 10 cities
  if (!states?.length) return CRAIGSLIST_CITIES.slice(0, 10);
  // Otherwise search all cities (state filtering happens at result time)
  return CRAIGSLIST_CITIES;
}

function buildCraigslistUrl(city: string, profile: SearchProfile): string {
  const query = buildSearchQuery(profile);
  const params = new URLSearchParams({
    query,
    format: "rss",
    sort: "date",
  });

  if (profile.price_min) params.set("min_price", String(profile.price_min));
  if (profile.price_max) params.set("max_price", String(profile.price_max));
  if (profile.year_min) params.set("min_auto_year", String(profile.year_min));
  if (profile.year_max) params.set("max_auto_year", String(profile.year_max));
  if (profile.mileage_max) params.set("max_auto_miles", String(profile.mileage_max));

  if (profile.transmission === "manual") params.set("auto_transmission", "1");
  else if (profile.transmission === "automatic") params.set("auto_transmission", "2");

  return `https://${city}.craigslist.org/search/cta?${params.toString()}`;
}

async function parseCraigslistRSS(xml: string, city: string): Promise<RawListing[]> {
  const listings: RawListing[] = [];

  // Simple XML parsing without heavy dependencies
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const item = match[1];
    const title = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1]
      || item.match(/<title>(.*?)<\/title>/)?.[1]
      || "";
    const link = item.match(/<link>(.*?)<\/link>/)?.[1] || "";
    const description = item.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/)?.[1]
      || item.match(/<description>(.*?)<\/description>/)?.[1]
      || "";

    // Extract source_id from URL
    const sourceId = link.match(/\/(\d+)\.html/)?.[1];
    if (!sourceId || !link) continue;

    // Try to extract price from title (e.g., "$25,000")
    const priceMatch = title.match(/\$[\d,]+/);
    const price = priceMatch ? parsePrice(priceMatch[0]) : null;

    // Try to extract year from title
    const year = parseYear(title);

    // Extract images from description HTML
    const imageUrls: string[] = [];
    const imgRegex = /src="(https:\/\/images\.craigslist\.org\/[^"]+)"/g;
    let imgMatch;
    while ((imgMatch = imgRegex.exec(description)) !== null) {
      imageUrls.push(imgMatch[1]);
    }

    listings.push({
      source: "craigslist",
      source_id: sourceId,
      url: link,
      title: title.replace(/\$[\d,]+\s*/, "").trim(),
      price,
      year,
      make: null, // Will be extracted by AI
      model: null,
      mileage: null,
      location: city,
      description: description.replace(/<[^>]*>/g, "").trim(),
      image_urls: imageUrls,
      seller_type: null,
      raw_data: { city, title, link, description },
    });
  }

  return listings;
}

export const craigslistScraper: Scraper = {
  name: "craigslist",

  async search(profile: SearchProfile): Promise<RawListing[]> {
    const cities = getCitiesForStates(profile.states);
    const allListings: RawListing[] = [];

    for (const city of cities) {
      try {
        const url = buildCraigslistUrl(city, profile);
        const response = await fetch(url, {
          headers: { "User-Agent": DEFAULT_SCRAPER_CONFIG.userAgent },
          signal: AbortSignal.timeout(15000),
        });

        if (!response.ok) {
          console.warn(`Craigslist ${city}: HTTP ${response.status}`);
          continue;
        }

        const xml = await response.text();
        const listings = await parseCraigslistRSS(xml, city);
        allListings.push(...listings);

        if (allListings.length >= DEFAULT_SCRAPER_CONFIG.maxResultsPerSource) break;
        await delay(DEFAULT_SCRAPER_CONFIG.requestDelayMs);
      } catch (error) {
        console.warn(`Craigslist ${city} failed:`, error);
        continue;
      }
    }

    return allListings.slice(0, DEFAULT_SCRAPER_CONFIG.maxResultsPerSource);
  },
};
