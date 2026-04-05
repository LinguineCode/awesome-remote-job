import type { RawListing, SearchProfile, Listing } from "@/types";
import type { Scraper } from "./types";
import { craigslistScraper } from "./craigslist";
import { autotempestScraper } from "./autotempest";
import { supabaseAdmin } from "@/lib/db";
import { aiExtract } from "@/lib/ai/extract";

const SCRAPERS: Record<string, Scraper> = {
  craigslist: craigslistScraper,
  autotempest: autotempestScraper,
};

export async function scrapeForProfile(profile: SearchProfile): Promise<number> {
  const sources = profile.sources?.length
    ? profile.sources
    : ["craigslist", "autotempest"];

  const allRawListings: RawListing[] = [];

  for (const source of sources) {
    const scraper = SCRAPERS[source];
    if (!scraper) {
      console.warn(`Unknown scraper: ${source}`);
      continue;
    }

    try {
      console.log(`Scraping ${source} for profile "${profile.name}"...`);
      const listings = await scraper.search(profile);
      console.log(`  Found ${listings.length} listings from ${source}`);
      allRawListings.push(...listings);
    } catch (error) {
      console.error(`Scraper ${source} failed for "${profile.name}":`, error);
    }
  }

  if (allRawListings.length === 0) return 0;

  // Deduplicate by source + source_id
  const seen = new Set<string>();
  const unique = allRawListings.filter((l) => {
    const key = `${l.source}:${l.source_id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Upsert into listings table
  let stored = 0;
  for (const raw of unique) {
    // Use AI to extract structured fields from messy listings
    let extracted = null;
    try {
      extracted = await aiExtract(raw);
    } catch (error) {
      console.warn("AI extraction failed for listing:", raw.title, error);
    }

    const record = {
      source: raw.source,
      source_id: raw.source_id,
      url: raw.url,
      title: raw.title,
      price: raw.price,
      year: extracted?.year ?? raw.year,
      make: extracted?.make ?? raw.make,
      model: extracted?.model ?? raw.model,
      trim_level: extracted?.trim_level ?? null,
      mileage: extracted?.mileage ?? raw.mileage,
      transmission: extracted?.transmission ?? null,
      drivetrain: extracted?.drivetrain ?? null,
      color: extracted?.color ?? null,
      location: raw.location,
      description: raw.description,
      image_urls: raw.image_urls,
      seller_type: extracted?.seller_type ?? raw.seller_type,
      title_status: extracted?.title_status ?? null,
      raw_data: raw.raw_data,
      last_seen_at: new Date().toISOString(),
      is_active: true,
    };

    const { error } = await supabaseAdmin
      .from("listings")
      .upsert(record, { onConflict: "source,source_id" });

    if (error) {
      console.warn("Failed to upsert listing:", error.message);
    } else {
      stored++;
    }
  }

  console.log(`Stored ${stored} listings for profile "${profile.name}"`);
  return stored;
}

export async function scrapeAllProfiles(): Promise<{
  totalProfiles: number;
  totalListings: number;
}> {
  const { data: profiles, error } = await supabaseAdmin
    .from("search_profiles")
    .select("*")
    .eq("is_active", true);

  if (error || !profiles) {
    console.error("Failed to fetch search profiles:", error);
    return { totalProfiles: 0, totalListings: 0 };
  }

  let totalListings = 0;
  for (const profile of profiles as SearchProfile[]) {
    const count = await scrapeForProfile(profile);
    totalListings += count;
  }

  return { totalProfiles: profiles.length, totalListings };
}

// Cross-source deduplication: find listings that are likely the same car
export async function deduplicateListings(): Promise<number> {
  const { data: listings, error } = await supabaseAdmin
    .from("listings")
    .select("id, year, make, model, price, location")
    .eq("is_active", true)
    .order("first_seen_at", { ascending: true });

  if (error || !listings) return 0;

  const seen = new Map<string, string>(); // fingerprint -> first listing id
  const duplicateIds: string[] = [];

  for (const listing of listings) {
    if (!listing.year || !listing.make || !listing.model) continue;
    // Create a fingerprint: year + make + model + price (within $500)
    const priceRange = listing.price ? Math.round(listing.price / 500) * 500 : 0;
    const fingerprint = `${listing.year}:${listing.make?.toLowerCase()}:${listing.model?.toLowerCase()}:${priceRange}`;

    if (seen.has(fingerprint)) {
      duplicateIds.push(listing.id);
    } else {
      seen.set(fingerprint, listing.id);
    }
  }

  if (duplicateIds.length > 0) {
    // Mark duplicates as inactive rather than deleting
    await supabaseAdmin
      .from("listings")
      .update({ is_active: false })
      .in("id", duplicateIds);
  }

  return duplicateIds.length;
}
