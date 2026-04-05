import { Resend } from "resend";
import { supabaseAdmin } from "@/lib/db";
import type { Profile, SearchProfile, SearchResult, Listing } from "@/types";
import { buildDigestHTML } from "./templates/daily-digest";

let _resend: Resend | null = null;
function getResend(): Resend {
  if (_resend) return _resend;
  _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

interface UserDigest {
  profile: Profile;
  searches: {
    searchProfile: SearchProfile;
    results: (SearchResult & { listing: Listing })[];
  }[];
}

export async function sendDailyDigests(): Promise<{
  sent: number;
  failed: number;
}> {
  // Get all unnotified results grouped by user
  const { data: unnotifiedResults, error } = await supabaseAdmin
    .from("search_results")
    .select(
      `
      *,
      listing:listings(*),
      search_profile:search_profiles(*, user:profiles(*))
    `
    )
    .eq("is_notified", false)
    .order("ai_score", { ascending: false });

  if (error || !unnotifiedResults?.length) {
    console.log("No unnotified results to send");
    return { sent: 0, failed: 0 };
  }

  // Group by user
  const userDigests = new Map<string, UserDigest>();

  for (const result of unnotifiedResults) {
    const searchProfile = result.search_profile as unknown as SearchProfile & {
      user: Profile;
    };
    const user = searchProfile.user;
    if (!user?.is_active) continue;

    if (!userDigests.has(user.id)) {
      userDigests.set(user.id, {
        profile: user,
        searches: [],
      });
    }

    const digest = userDigests.get(user.id)!;
    let searchGroup = digest.searches.find(
      (s) => s.searchProfile.id === searchProfile.id
    );
    if (!searchGroup) {
      searchGroup = {
        searchProfile: searchProfile,
        results: [],
      };
      digest.searches.push(searchGroup);
    }

    searchGroup.results.push({
      ...result,
      listing: result.listing as unknown as Listing,
    });
  }

  let sent = 0;
  let failed = 0;

  for (const [userId, digest] of userDigests) {
    const totalResults = digest.searches.reduce(
      (sum, s) => sum + s.results.length,
      0
    );

    try {
      const html = buildDigestHTML(digest.searches);
      const searchNames = digest.searches
        .map((s) => s.searchProfile.name)
        .join(", ");

      await getResend().emails.send({
        from: "CarFinder <notifications@carfinder.app>",
        to: digest.profile.email,
        subject: `CarFinder: ${totalResults} new match${totalResults !== 1 ? "es" : ""} for ${searchNames}`,
        html,
      });

      // Mark all results as notified
      const resultIds = digest.searches.flatMap((s) =>
        s.results.map((r) => r.id)
      );
      await supabaseAdmin
        .from("search_results")
        .update({ is_notified: true, notified_at: new Date().toISOString() })
        .in("id", resultIds);

      // Log notification
      await supabaseAdmin.from("notification_log").insert({
        user_id: userId,
        email_to: digest.profile.email,
        result_count: totalResults,
        status: "sent",
      });

      sent++;
    } catch (error) {
      console.error(`Failed to send digest to ${digest.profile.email}:`, error);
      await supabaseAdmin.from("notification_log").insert({
        user_id: userId,
        email_to: digest.profile.email,
        result_count: totalResults,
        status: "failed",
      });
      failed++;
    }
  }

  return { sent, failed };
}
