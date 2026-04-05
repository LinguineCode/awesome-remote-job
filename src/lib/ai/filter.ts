import type { Listing, SearchProfile, AIFilterResult } from "@/types";
import { FILTER_SYSTEM_PROMPT, buildFilterUserPrompt, buildBatchFilterUserPrompt } from "./prompts";
import { getOpenAI } from "./client";

function profileToCriteria(profile: SearchProfile) {
  return {
    makes: profile.makes || undefined,
    models: profile.models || undefined,
    yearMin: profile.year_min || undefined,
    yearMax: profile.year_max || undefined,
    priceMin: profile.price_min || undefined,
    priceMax: profile.price_max || undefined,
    mileageMax: profile.mileage_max || undefined,
    transmission: profile.transmission || undefined,
    drivetrain: profile.drivetrain || undefined,
    bodyStyles: profile.body_styles || undefined,
    colors: profile.colors || undefined,
    excludeDealers: profile.exclude_dealers,
    excludeSalvage: profile.exclude_salvage,
    aiNotes: profile.ai_notes || undefined,
  };
}

function listingToInput(listing: Listing) {
  return {
    title: listing.title || "Untitled",
    price: listing.price,
    year: listing.year,
    make: listing.make,
    model: listing.model,
    mileage: listing.mileage,
    transmission: listing.transmission,
    location: listing.location,
    description: listing.description,
    sellerType: listing.seller_type,
    imageCount: listing.image_urls?.length || 0,
  };
}

export async function aiFilterSingle(
  profile: SearchProfile,
  listing: Listing
): Promise<AIFilterResult> {
  const criteria = profileToCriteria(profile);
  const input = listingToInput(listing);
  const userPrompt = buildFilterUserPrompt(criteria, input);

  try {
    const response = await getOpenAI().chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: FILTER_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.2,
      max_tokens: 400,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return { score: 0, summary: "AI evaluation failed", flags: [], reasoning: "No response" };
    }

    return JSON.parse(content) as AIFilterResult;
  } catch (error) {
    console.warn("AI filter error:", error);
    return { score: 0, summary: "AI evaluation error", flags: [], reasoning: String(error) };
  }
}

// Batch filter for cost efficiency — up to 10 listings at once
export async function aiFilterBatch(
  profile: SearchProfile,
  listings: Listing[]
): Promise<AIFilterResult[]> {
  if (listings.length === 0) return [];
  if (listings.length === 1) return [await aiFilterSingle(profile, listings[0])];

  const BATCH_SIZE = 10;
  const allResults: AIFilterResult[] = [];

  for (let i = 0; i < listings.length; i += BATCH_SIZE) {
    const batch = listings.slice(i, i + BATCH_SIZE);
    const criteria = profileToCriteria(profile);
    const inputs = batch.map(listingToInput);
    const userPrompt = buildBatchFilterUserPrompt(criteria, inputs);

    try {
      const response = await getOpenAI().chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `${FILTER_SYSTEM_PROMPT}\n\nYou will evaluate multiple listings. Return a JSON object with key "results" containing an array of evaluation results, one per listing, in order.`,
          },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.2,
        max_tokens: 2000,
        response_format: { type: "json_object" },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        allResults.push(
          ...batch.map(() => ({
            score: 0,
            summary: "Batch evaluation failed",
            flags: [] as string[],
            reasoning: "No response",
          }))
        );
        continue;
      }

      const parsed = JSON.parse(content);
      const batchResults: AIFilterResult[] = parsed.results || [parsed];
      for (let j = 0; j < batch.length; j++) {
        allResults.push(
          batchResults[j] || {
            score: 0,
            summary: "Missing result",
            flags: [],
            reasoning: "Result missing from batch",
          }
        );
      }
    } catch (error) {
      console.warn("Batch filter error:", error);
      allResults.push(
        ...batch.map(() => ({
          score: 0,
          summary: "Batch evaluation error",
          flags: [] as string[],
          reasoning: String(error),
        }))
      );
    }
  }

  return allResults;
}
