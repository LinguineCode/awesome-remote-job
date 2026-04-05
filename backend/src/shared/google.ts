import type { SearchProfile, GoogleSearchResult } from "./types";

const SERPER_API_URL = "https://google.serper.dev/search";

/**
 * Search Google via Serper.dev for car listings matching the search profile.
 * Google catches Facebook Marketplace, Craigslist, Cars.com, FB groups, etc.
 */
export async function searchGoogle(
  profile: SearchProfile
): Promise<GoogleSearchResult[]> {
  const queries = buildSearchQueries(profile);
  const allResults: GoogleSearchResult[] = [];
  const seenUrls = new Set<string>();

  for (const query of queries) {
    try {
      const response = await fetch(SERPER_API_URL, {
        method: "POST",
        headers: {
          "X-API-KEY": process.env.SERPER_API_KEY!,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          q: query,
          num: 20,
          gl: "us",
          hl: "en",
        }),
      });

      if (!response.ok) {
        console.warn(`Serper search failed for query "${query}": ${response.status}`);
        continue;
      }

      const data: any = await response.json();
      const organic = data.organic || [];

      for (const result of organic) {
        const url = result.link;
        if (!url || seenUrls.has(url)) continue;
        if (!isCarListingUrl(url)) continue;

        seenUrls.add(url);
        allResults.push({
          title: result.title || "",
          link: url,
          snippet: result.snippet || "",
          source: extractDomain(url),
        });
      }
    } catch (error) {
      console.error(`Google search error for "${query}":`, error);
    }
  }

  return allResults;
}

function buildSearchQueries(profile: SearchProfile): string[] {
  const queries: string[] = [];

  // Build the core car description
  const carParts: string[] = [];
  if (profile.makes?.length) carParts.push(profile.makes.join(" OR "));
  if (profile.models?.length) carParts.push(profile.models.join(" OR "));
  const carDesc = carParts.join(" ") || "car";

  // Price range
  let priceRange = "";
  if (profile.priceMin && profile.priceMax) {
    priceRange = ` $${profile.priceMin}-$${profile.priceMax}`;
  } else if (profile.priceMax) {
    priceRange = ` under $${profile.priceMax}`;
  }

  // Year range
  let yearRange = "";
  if (profile.yearMin && profile.yearMax) {
    yearRange = ` ${profile.yearMin}-${profile.yearMax}`;
  } else if (profile.yearMin) {
    yearRange = ` ${profile.yearMin}+`;
  }

  // Location
  const location = profile.states?.length
    ? ` ${profile.states.join(" OR ")}`
    : profile.zipCode
      ? ` near ${profile.zipCode}`
      : "";

  // Main search: broad Google query
  queries.push(`${carDesc}${yearRange} for sale${priceRange}${location}`);

  // Site-specific searches for better coverage
  const sites = [
    "facebook.com/marketplace",
    "craigslist.org",
    "cargurus.com",
    "cars.com",
    "autotrader.com",
  ];

  for (const site of sites) {
    queries.push(`site:${site} ${carDesc}${yearRange} for sale${priceRange}`);
  }

  // Facebook groups — goldmine for enthusiast cars
  if (profile.makes?.length) {
    for (const make of profile.makes) {
      queries.push(
        `site:facebook.com/groups ${make} ${profile.models?.join(" ") || ""} for sale`
      );
    }
  }

  return queries;
}

function isCarListingUrl(url: string): boolean {
  // Filter out non-listing URLs (search results pages, articles, etc.)
  const skipPatterns = [
    /google\.com/,
    /youtube\.com/,
    /wikipedia\.org/,
    /reddit\.com(?!.*comments)/, // allow reddit posts, skip subreddit pages
    /kbb\.com/,           // pricing guide, not listings
    /edmunds\.com\/car-reviews/, // reviews, not listings
    /news\./,
    /blog\./,
  ];

  for (const pattern of skipPatterns) {
    if (pattern.test(url)) return false;
  }

  // Positive signals: these are listing sites
  const listingSites = [
    "facebook.com/marketplace",
    "facebook.com/groups",
    "craigslist.org",
    "cargurus.com",
    "cars.com",
    "autotrader.com",
    "carfax.com",
    "truecar.com",
    "ebay.com/itm",
    "bringatrailer.com",
    "carsandbids.com",
    "hemmings.com",
    "classiccars.com",
    "offerup.com",
  ];

  return listingSites.some((site) => url.includes(site)) || url.includes("for-sale");
}

function extractDomain(url: string): string {
  try {
    const hostname = new URL(url).hostname.replace("www.", "");
    return hostname;
  } catch {
    return "unknown";
  }
}
