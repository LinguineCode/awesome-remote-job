import type { RawListing, AIExtractionResult } from "@/types";
import { EXTRACTION_SYSTEM_PROMPT } from "./prompts";
import { getOpenAI } from "./client";

export async function aiExtract(listing: RawListing): Promise<AIExtractionResult | null> {
  const userPrompt = [
    `Title: ${listing.title}`,
    listing.price ? `Price: $${listing.price}` : null,
    listing.description ? `Description: ${listing.description.slice(0, 800)}` : null,
    listing.location ? `Location: ${listing.location}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const response = await getOpenAI().chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.1,
      max_tokens: 300,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return null;

    return JSON.parse(content) as AIExtractionResult;
  } catch (error) {
    console.warn("AI extraction error:", error);
    return null;
  }
}

// Batch extraction for efficiency
export async function aiExtractBatch(
  listings: RawListing[]
): Promise<(AIExtractionResult | null)[]> {
  if (listings.length === 0) return [];

  // Process in batches of 5 for cost efficiency
  const BATCH_SIZE = 5;
  const results: (AIExtractionResult | null)[] = [];

  for (let i = 0; i < listings.length; i += BATCH_SIZE) {
    const batch = listings.slice(i, i + BATCH_SIZE);

    if (batch.length === 1) {
      results.push(await aiExtract(batch[0]));
      continue;
    }

    const batchPrompt = batch
      .map(
        (l, idx) =>
          `--- Listing ${idx + 1} ---\nTitle: ${l.title}\n${l.price ? `Price: $${l.price}` : ""}\n${l.description ? `Description: ${l.description.slice(0, 500)}` : ""}`
      )
      .join("\n\n");

    try {
      const response = await getOpenAI().chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `${EXTRACTION_SYSTEM_PROMPT}\n\nYou will receive multiple listings. Return a JSON object with key "results" containing an array of extraction results, one per listing, in order.`,
          },
          { role: "user", content: batchPrompt },
        ],
        temperature: 0.1,
        max_tokens: 1500,
        response_format: { type: "json_object" },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        results.push(...batch.map(() => null));
        continue;
      }

      const parsed = JSON.parse(content);
      const batchResults = parsed.results || [parsed];
      for (let j = 0; j < batch.length; j++) {
        results.push(batchResults[j] || null);
      }
    } catch (error) {
      console.warn("Batch extraction error:", error);
      results.push(...batch.map(() => null));
    }
  }

  return results;
}
