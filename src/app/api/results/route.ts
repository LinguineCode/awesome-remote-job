import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/db";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const userId = cookieStore.get("user_id")?.value;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const searchProfileId = searchParams.get("search_profile_id");
  const limit = parseInt(searchParams.get("limit") || "50", 10);
  const offset = parseInt(searchParams.get("offset") || "0", 10);

  // First verify the search profile belongs to this user
  if (searchProfileId) {
    const { data: profile } = await supabaseAdmin
      .from("search_profiles")
      .select("user_id")
      .eq("id", searchProfileId)
      .single();

    if (!profile || profile.user_id !== userId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  }

  let query = supabaseAdmin
    .from("search_results")
    .select(
      `
      *,
      listing:listings(*),
      search_profile:search_profiles!inner(id, name, user_id)
    `
    )
    .eq("search_profile.user_id", userId)
    .order("matched_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (searchProfileId) {
    query = query.eq("search_profile_id", searchProfileId);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// Update user rating on a result
export async function PATCH(request: NextRequest) {
  const cookieStore = await cookies();
  const userId = cookieStore.get("user_id")?.value;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { result_id, user_rating } = body;

  if (!result_id || !user_rating) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  // Verify ownership through search profile
  const { data: result } = await supabaseAdmin
    .from("search_results")
    .select("search_profile:search_profiles(user_id)")
    .eq("id", result_id)
    .single();

  const searchProfile = result?.search_profile as unknown as { user_id: string } | null;
  if (!searchProfile || searchProfile.user_id !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data, error } = await supabaseAdmin
    .from("search_results")
    .update({ user_rating })
    .eq("id", result_id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
