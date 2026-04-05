import { supabaseAdmin } from "@/lib/db";
import type { Listing, SearchProfile } from "@/types";

/**
 * Deterministic pre-filter using SQL queries.
 * Eliminates obviously non-matching listings before the AI layer.
 * This keeps AI costs low by only evaluating plausible matches.
 */
export async function hardFilter(profile: SearchProfile): Promise<Listing[]> {
  let query = supabaseAdmin
    .from("listings")
    .select("*")
    .eq("is_active", true);

  // Year range
  if (profile.year_min) {
    query = query.gte("year", profile.year_min);
  }
  if (profile.year_max) {
    query = query.lte("year", profile.year_max);
  }

  // Price range
  if (profile.price_min) {
    query = query.gte("price", profile.price_min);
  }
  if (profile.price_max) {
    query = query.lte("price", profile.price_max);
  }

  // Max mileage
  if (profile.mileage_max) {
    query = query.lte("mileage", profile.mileage_max);
  }

  // Make filter (case-insensitive via ilike would be better, but contains works)
  if (profile.makes?.length) {
    query = query.in(
      "make",
      profile.makes.map((m) => m.trim())
    );
  }

  // Model filter
  if (profile.models?.length) {
    query = query.in(
      "model",
      profile.models.map((m) => m.trim())
    );
  }

  // Transmission
  if (profile.transmission) {
    query = query.eq("transmission", profile.transmission);
  }

  // Drivetrain
  if (profile.drivetrain) {
    query = query.eq("drivetrain", profile.drivetrain);
  }

  // Exclude dealers
  if (profile.exclude_dealers) {
    query = query.neq("seller_type", "dealer");
  }

  // Exclude salvage titles
  if (profile.exclude_salvage) {
    query = query.not("title_status", "in", '("salvage","rebuilt","flood")');
  }

  // Require photos
  if (profile.require_photos) {
    query = query.not("image_urls", "eq", "{}");
  }

  // Only get listings not already matched to this search profile
  const { data: existingResults } = await supabaseAdmin
    .from("search_results")
    .select("listing_id")
    .eq("search_profile_id", profile.id);

  const existingIds = existingResults?.map((r) => r.listing_id) || [];

  // Execute query
  const { data: listings, error } = await query
    .order("first_seen_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("Hard filter query error:", error);
    return [];
  }

  // Filter out already-matched listings in memory
  const filtered = (listings as Listing[]).filter(
    (l) => !existingIds.includes(l.id)
  );

  // Apply minimum description length filter
  if (profile.min_description_length > 0) {
    return filtered.filter(
      (l) => (l.description?.length || 0) >= profile.min_description_length
    );
  }

  return filtered;
}
