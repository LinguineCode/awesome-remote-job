import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/db";
import { cookies } from "next/headers";

async function getUserId(request: NextRequest): Promise<string | null> {
  const cookieStore = await cookies();
  const userId = cookieStore.get("user_id")?.value;
  return userId || null;
}

export async function GET(request: NextRequest) {
  const userId = await getUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from("search_profiles")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const userId = await getUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();

  const { data, error } = await supabaseAdmin
    .from("search_profiles")
    .insert({
      user_id: userId,
      name: body.name,
      makes: body.makes || null,
      models: body.models || null,
      year_min: body.year_min || null,
      year_max: body.year_max || null,
      price_min: body.price_min || null,
      price_max: body.price_max || null,
      mileage_max: body.mileage_max || null,
      transmission: body.transmission || null,
      body_styles: body.body_styles || null,
      colors: body.colors || null,
      fuel_types: body.fuel_types || null,
      drivetrain: body.drivetrain || null,
      zip_code: body.zip_code || null,
      search_radius_miles: body.search_radius_miles || 100,
      states: body.states || null,
      exclude_dealers: body.exclude_dealers ?? false,
      exclude_salvage: body.exclude_salvage ?? true,
      require_photos: body.require_photos ?? true,
      min_description_length: body.min_description_length ?? 50,
      ai_notes: body.ai_notes || null,
      sources: body.sources || ["craigslist", "autotempest"],
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}

export async function PUT(request: NextRequest) {
  const userId = await getUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { id, ...updates } = body;

  if (!id) {
    return NextResponse.json({ error: "Missing search profile ID" }, { status: 400 });
  }

  // Verify ownership
  const { data: existing } = await supabaseAdmin
    .from("search_profiles")
    .select("user_id")
    .eq("id", id)
    .single();

  if (!existing || existing.user_id !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data, error } = await supabaseAdmin
    .from("search_profiles")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest) {
  const userId = await getUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Missing ID" }, { status: 400 });
  }

  // Verify ownership
  const { data: existing } = await supabaseAdmin
    .from("search_profiles")
    .select("user_id")
    .eq("id", id)
    .single();

  if (!existing || existing.user_id !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { error } = await supabaseAdmin
    .from("search_profiles")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
