import { NextRequest, NextResponse } from "next/server";
import { filterAllProfiles } from "@/lib/matching/soft-filter";

export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    console.log("Starting daily filter...");
    const { totalProfiles, totalMatched, totalEvaluated } =
      await filterAllProfiles();

    const result = {
      success: true,
      profiles_processed: totalProfiles,
      listings_evaluated: totalEvaluated,
      listings_matched: totalMatched,
      timestamp: new Date().toISOString(),
    };

    console.log("Filter complete:", result);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Filter cron failed:", error);
    return NextResponse.json(
      { error: "Filter failed", details: String(error) },
      { status: 500 }
    );
  }
}
