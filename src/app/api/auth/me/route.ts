import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/db";
import { cookies } from "next/headers";

export async function GET() {
  const cookieStore = await cookies();
  const userId = cookieStore.get("user_id")?.value;

  if (!userId) {
    return NextResponse.json({ user: null });
  }

  const { data: user } = await supabaseAdmin
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  return NextResponse.json({ user });
}
