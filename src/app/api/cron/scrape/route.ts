import { NextRequest, NextResponse } from "next/server";
import { scrapeAllProfiles, deduplicateListings } from "@/lib/scrapers/orchestrator";

export const maxDuration = 300; // 5 min for Pro plan

export async function GET(request: NextRequest) {
  // Verify cron secret to prevent unauthorized access
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    console.log("Starting daily scrape...");
    const { totalProfiles, totalListings } = await scrapeAllProfiles();

    console.log("Running deduplication...");
    const duplicates = await deduplicateListings();

    const result = {
      success: true,
      profiles_processed: totalProfiles,
      listings_found: totalListings,
      duplicates_removed: duplicates,
      timestamp: new Date().toISOString(),
    };

    console.log("Scrape complete:", result);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Scrape cron failed:", error);
    return NextResponse.json(
      { error: "Scrape failed", details: String(error) },
      { status: 500 }
    );
  }
}
