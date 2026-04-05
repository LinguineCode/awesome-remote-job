import { NextRequest, NextResponse } from "next/server";
import { sendDailyDigests } from "@/lib/notifications/email";

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    console.log("Sending daily digests...");
    const { sent, failed } = await sendDailyDigests();

    const result = {
      success: true,
      emails_sent: sent,
      emails_failed: failed,
      timestamp: new Date().toISOString(),
    };

    console.log("Notification complete:", result);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Notify cron failed:", error);
    return NextResponse.json(
      { error: "Notification failed", details: String(error) },
      { status: 500 }
    );
  }
}
