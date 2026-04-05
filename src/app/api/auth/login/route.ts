import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/db";

export async function POST(request: NextRequest) {
  const { email } = await request.json();

  if (!email || typeof email !== "string" || !email.includes("@")) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }

  const normalizedEmail = email.toLowerCase().trim();

  // Find or create user
  let { data: user } = await supabaseAdmin
    .from("profiles")
    .select("*")
    .eq("email", normalizedEmail)
    .single();

  if (!user) {
    const { data: newUser, error } = await supabaseAdmin
      .from("profiles")
      .insert({ email: normalizedEmail })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: "Failed to create account" }, { status: 500 });
    }
    user = newUser;
  }

  // Simple token-based auth (in production, use magic links via Resend)
  // For now, set a secure cookie with the user ID
  const response = NextResponse.json({ success: true, user });
  response.cookies.set("user_id", user.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: "/",
  });

  return response;
}
