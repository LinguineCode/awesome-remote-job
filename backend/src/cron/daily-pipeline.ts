import type { ScheduledEvent } from "aws-lambda";
import { searchGoogle } from "../shared/google";
import { extractListingsBatch } from "../shared/scraper";
import { aiFilterBatch } from "../shared/ai";
import { sendDigestForUser } from "../shared/email";
import {
  getAllActiveSearchProfiles,
  getListing,
  putListing,
  putSearchResult,
  resultExists,
  getProfileById,
} from "../shared/db";
import type { Listing, SearchProfile } from "../shared/types";

const MIN_SCORE = 0.6;
const LISTING_TTL_DAYS = 30;

export async function handler(_event: ScheduledEvent): Promise<void> {
  console.log("Starting daily pipeline...");

  // Step 1: Get all active search profiles
  const searchProfiles = await getAllActiveSearchProfiles();
  console.log(`Found ${searchProfiles.length} active search profiles`);

  if (searchProfiles.length === 0) return;

  // Track which users need notifications
  const usersToNotify = new Set<string>();

  // Step 2: For each search profile, search Google → extract → filter → store
  for (const profile of searchProfiles) {
    try {
      console.log(`Processing search: "${profile.name}" (${profile.id})`);
      await processSearchProfile(profile, usersToNotify);
    } catch (error) {
      console.error(`Failed to process search "${profile.name}":`, error);
    }
  }

  // Step 3: Send email digests
  console.log(`Sending digests to ${usersToNotify.size} users...`);
  let sent = 0;
  let failed = 0;

  for (const userId of usersToNotify) {
    try {
      const success = await sendDigestForUser(userId);
      if (success) sent++;
    } catch (error) {
      console.error(`Failed to send digest for user ${userId}:`, error);
      failed++;
    }
  }

  console.log(
    `Pipeline complete: ${searchProfiles.length} searches, ${sent} digests sent, ${failed} failed`
  );
}

async function processSearchProfile(
  profile: SearchProfile,
  usersToNotify: Set<string>
): Promise<void> {
  // Step 2a: Search Google for listing URLs
  const googleResults = await searchGoogle(profile);
  console.log(`  Google: ${googleResults.length} results for "${profile.name}"`);

  if (googleResults.length === 0) return;

  // Step 2b: Filter out URLs we've already processed for this search
  const newResults = [];
  for (const result of googleResults) {
    const exists = await resultExists(profile.id, result.link);
    if (!exists) newResults.push(result);
  }
  console.log(`  New URLs: ${newResults.length} (${googleResults.length - newResults.length} already seen)`);

  if (newResults.length === 0) return;

  // Step 2c: Use Firecrawl to extract structured data from each listing page
  const extractions = await extractListingsBatch(newResults);
  console.log(`  Firecrawl: extracted ${extractions.size} listings`);

  // Step 2d: Store listings in DynamoDB
  const listings: Listing[] = [];
  const now = new Date().toISOString();
  const ttl = Math.floor(Date.now() / 1000) + LISTING_TTL_DAYS * 86400;

  for (const [url, extraction] of extractions) {
    const googleResult = newResults.find((r) => r.link === url);
    const listing: Listing = {
      url,
      title: googleResult?.title || `${extraction.year || ""} ${extraction.make || ""} ${extraction.model || ""}`.trim() || null,
      price: extraction.price,
      year: extraction.year,
      make: extraction.make,
      model: extraction.model,
      trimLevel: extraction.trimLevel,
      mileage: extraction.mileage,
      transmission: extraction.transmission,
      drivetrain: extraction.drivetrain,
      color: extraction.color,
      location: extraction.location,
      description: extraction.description,
      imageUrls: extraction.imageUrls || [],
      sellerType: extraction.sellerType,
      titleStatus: extraction.titleStatus,
      source: googleResult?.source || "google",
      firstSeenAt: now,
      lastSeenAt: now,
      expiresAt: ttl,
    };

    await putListing(listing);
    listings.push(listing);
  }

  if (listings.length === 0) return;

  // Step 2e: Hard filter — basic deterministic checks
  const candidates = hardFilter(profile, listings);
  console.log(`  Hard filter: ${candidates.length}/${listings.length} passed`);

  if (candidates.length === 0) return;

  // Step 2f: AI soft filter — score relevance
  const aiResults = await aiFilterBatch(profile, candidates);
  let matched = 0;

  for (let i = 0; i < candidates.length; i++) {
    const listing = candidates[i];
    const result = aiResults[i];

    if (result.score >= MIN_SCORE) {
      await putSearchResult({
        searchProfileId: profile.id,
        listingUrl: listing.url,
        userId: profile.userId,
        matchedAt: now,
        aiScore: result.score,
        aiSummary: result.summary,
        aiFlags: result.flags,
        aiReasoning: result.reasoning,
        isNotified: false,
        notifiedAt: null,
        userRating: null,
      });
      matched++;
      usersToNotify.add(profile.userId);
    }
  }

  console.log(`  AI filter: ${matched}/${candidates.length} matched (score >= ${MIN_SCORE})`);
}

/**
 * Deterministic pre-filter. Eliminates obviously non-matching listings
 * before spending AI tokens on them.
 */
function hardFilter(profile: SearchProfile, listings: Listing[]): Listing[] {
  return listings.filter((l) => {
    // Year range
    if (profile.yearMin && l.year && l.year < profile.yearMin) return false;
    if (profile.yearMax && l.year && l.year > profile.yearMax) return false;

    // Price range
    if (profile.priceMin && l.price && l.price < profile.priceMin) return false;
    if (profile.priceMax && l.price && l.price > profile.priceMax) return false;

    // Mileage
    if (profile.mileageMax && l.mileage && l.mileage > profile.mileageMax) return false;

    // Make (case-insensitive)
    if (profile.makes?.length && l.make) {
      const lowerMake = l.make.toLowerCase();
      if (!profile.makes.some((m) => m.toLowerCase() === lowerMake)) return false;
    }

    // Model (case-insensitive)
    if (profile.models?.length && l.model) {
      const lowerModel = l.model.toLowerCase();
      if (!profile.models.some((m) => m.toLowerCase() === lowerModel)) return false;
    }

    // Transmission
    if (profile.transmission && l.transmission && l.transmission !== profile.transmission) return false;

    // Drivetrain
    if (profile.drivetrain && l.drivetrain && l.drivetrain !== profile.drivetrain) return false;

    // Exclude dealers
    if (profile.excludeDealers && l.sellerType === "dealer") return false;

    // Exclude salvage
    if (profile.excludeSalvage && l.titleStatus && l.titleStatus !== "clean") return false;

    return true;
  });
}
