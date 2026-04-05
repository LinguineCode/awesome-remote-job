import OpenAI from "openai";
import type { Listing, SearchProfile, AIFilterResult } from "./types";

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}

const FILTER_SYSTEM_PROMPT = `You are a car buying assistant. Evaluate whether a listing matches the user's criteria.

Return ONLY a JSON object:
{
  "score": 0.0-1.0,
  "summary": "One-line summary of this car",
  "flags": ["possible_scam" | "price_below_market" | "rare_spec" | "salvage_title" | "flood_damage" | "high_mileage" | "dealer_listing" | "no_photos" | "vague_description"],
  "reasoning": "Brief explanation"
}

Scoring:
- 0.9-1.0: Perfect match, all criteria met including freeform notes
- 0.7-0.89: Strong match, minor deviations
- 0.5-0.69: Partial match, notable gaps
- 0.3-0.49: Weak match
- 0.0-0.29: Not a match or spam

Be strict. The user wants precision, not volume. Flag anything suspicious.`;

function buildCriteria(profile: SearchProfile): string {
  return [
    `Make/Model: ${profile.makes?.join(", ") || "Any"} / ${profile.models?.join(", ") || "Any"}`,
    profile.yearMin || profile.yearMax
      ? `Year: ${profile.yearMin || "Any"}-${profile.yearMax || "Any"}`
      : null,
    profile.priceMin || profile.priceMax
      ? `Budget: $${profile.priceMin || 0}-$${profile.priceMax || "No limit"}`
      : null,
    profile.mileageMax ? `Max Mileage: ${profile.mileageMax.toLocaleString()} mi` : null,
    profile.transmission ? `Transmission: ${profile.transmission}` : null,
    profile.drivetrain ? `Drivetrain: ${profile.drivetrain}` : null,
    profile.excludeDealers ? "Exclude dealer listings" : null,
    profile.excludeSalvage ? "Exclude salvage/rebuilt titles" : null,
    profile.aiNotes ? `\nAdditional Notes: ${profile.aiNotes}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function buildListingText(listing: Listing): string {
  return [
    `Title: ${listing.title || "N/A"}`,
    `Price: ${listing.price ? `$${listing.price.toLocaleString()}` : "Unknown"}`,
    `Year: ${listing.year || "Unknown"}`,
    `Make: ${listing.make || "Unknown"}`,
    `Model: ${listing.model || "Unknown"}`,
    `Mileage: ${listing.mileage ? `${listing.mileage.toLocaleString()} mi` : "Unknown"}`,
    `Transmission: ${listing.transmission || "Unknown"}`,
    `Location: ${listing.location || "Unknown"}`,
    `Seller Type: ${listing.sellerType || "Unknown"}`,
    `Photos: ${listing.imageUrls?.length || 0}`,
    listing.description ? `\nDescription:\n${listing.description.slice(0, 1500)}` : "",
  ].join("\n");
}

export async function aiFilterSingle(
  profile: SearchProfile,
  listing: Listing
): Promise<AIFilterResult> {
  try {
    const response = await getOpenAI().chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: FILTER_SYSTEM_PROMPT },
        {
          role: "user",
          content: `SEARCH CRITERIA:\n${buildCriteria(profile)}\n\nLISTING:\n${buildListingText(listing)}`,
        },
      ],
      temperature: 0.2,
      max_tokens: 400,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return { score: 0, summary: "AI evaluation failed", flags: [], reasoning: "No response" };

    return JSON.parse(content) as AIFilterResult;
  } catch (error) {
    console.warn("AI filter error:", error);
    return { score: 0, summary: "AI error", flags: [], reasoning: String(error) };
  }
}

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
    const criteria = buildCriteria(profile);

    const listingsText = batch
      .map((l, idx) => `--- LISTING ${idx + 1} ---\n${buildListingText(l)}`)
      .join("\n\n");

    try {
      const response = await getOpenAI().chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `${FILTER_SYSTEM_PROMPT}\n\nYou will evaluate multiple listings. Return a JSON object with key "results" containing an array of evaluation results, one per listing, in order.`,
          },
          {
            role: "user",
            content: `SEARCH CRITERIA:\n${criteria}\n\nEvaluate each listing:\n\n${listingsText}`,
          },
        ],
        temperature: 0.2,
        max_tokens: 2000,
        response_format: { type: "json_object" },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        allResults.push(...batch.map(() => ({ score: 0, summary: "Batch failed", flags: [] as string[], reasoning: "No response" })));
        continue;
      }

      const parsed = JSON.parse(content);
      const batchResults: AIFilterResult[] = parsed.results || [parsed];
      for (let j = 0; j < batch.length; j++) {
        allResults.push(batchResults[j] || { score: 0, summary: "Missing", flags: [], reasoning: "Missing from batch" });
      }
    } catch (error) {
      console.warn("Batch filter error:", error);
      allResults.push(...batch.map(() => ({ score: 0, summary: "Error", flags: [] as string[], reasoning: String(error) })));
    }
  }

  return allResults;
}
