import { supabaseAdmin } from "@/lib/db";
import { aiFilterBatch } from "@/lib/ai/filter";
import { hardFilter } from "./hard-filter";
import type { SearchProfile, Listing, SearchResult } from "@/types";

const MIN_SCORE = 0.6;

export async function filterForProfile(
  profile: SearchProfile
): Promise<{ matched: number; evaluated: number }> {
  // Step 1: Hard filter — get candidate listings
  const candidates = await hardFilter(profile);
  console.log(`  Hard filter: ${candidates.length} candidates for "${profile.name}"`);

  if (candidates.length === 0) {
    return { matched: 0, evaluated: 0 };
  }

  // Step 2: AI soft filter — score each candidate
  const results = await aiFilterBatch(profile, candidates);

  // Step 3: Store matches above threshold
  let matched = 0;
  for (let i = 0; i < candidates.length; i++) {
    const listing = candidates[i];
    const result = results[i];

    if (result.score >= MIN_SCORE) {
      const { error } = await supabaseAdmin.from("search_results").upsert(
        {
          search_profile_id: profile.id,
          listing_id: listing.id,
          ai_score: result.score,
          ai_summary: result.summary,
          ai_flags: result.flags,
          ai_reasoning: result.reasoning,
          is_notified: false,
        },
        { onConflict: "search_profile_id,listing_id" }
      );

      if (error) {
        console.warn("Failed to store search result:", error.message);
      } else {
        matched++;
      }
    }
  }

  console.log(
    `  Soft filter: ${matched}/${candidates.length} matched for "${profile.name}"`
  );
  return { matched, evaluated: candidates.length };
}

export async function filterAllProfiles(): Promise<{
  totalProfiles: number;
  totalMatched: number;
  totalEvaluated: number;
}> {
  const { data: profiles, error } = await supabaseAdmin
    .from("search_profiles")
    .select("*")
    .eq("is_active", true);

  if (error || !profiles) {
    console.error("Failed to fetch profiles:", error);
    return { totalProfiles: 0, totalMatched: 0, totalEvaluated: 0 };
  }

  let totalMatched = 0;
  let totalEvaluated = 0;

  for (const profile of profiles as SearchProfile[]) {
    const { matched, evaluated } = await filterForProfile(profile);
    totalMatched += matched;
    totalEvaluated += evaluated;
  }

  return {
    totalProfiles: profiles.length,
    totalMatched,
    totalEvaluated,
  };
}
