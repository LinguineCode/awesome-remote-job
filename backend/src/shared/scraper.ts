import type { FirecrawlExtraction, GoogleSearchResult } from "./types";

const FIRECRAWL_API_URL = "https://api.firecrawl.dev/v1";

/**
 * Use Firecrawl to extract structured car listing data from a URL.
 * Firecrawl handles JS rendering, anti-bot, and uses AI to extract
 * structured data from any page layout.
 */
export async function extractListingData(
  result: GoogleSearchResult
): Promise<FirecrawlExtraction | null> {
  try {
    const response = await fetch(`${FIRECRAWL_API_URL}/scrape`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.FIRECRAWL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: result.link,
        formats: ["extract"],
        extract: {
          schema: {
            type: "object",
            properties: {
              year: { type: "number", description: "Vehicle model year" },
              make: { type: "string", description: "Vehicle manufacturer (e.g., Porsche, BMW, Toyota)" },
              model: { type: "string", description: "Vehicle model name (e.g., 911, M3, Camry)" },
              trimLevel: { type: "string", description: "Trim/variant (e.g., Carrera S, Competition, TRD)" },
              price: { type: "number", description: "Asking price in USD (number only)" },
              mileage: { type: "number", description: "Odometer reading in miles (number only)" },
              transmission: {
                type: "string",
                enum: ["manual", "automatic"],
                description: "Transmission type",
              },
              drivetrain: {
                type: "string",
                enum: ["fwd", "rwd", "awd", "4wd"],
                description: "Drivetrain type",
              },
              color: { type: "string", description: "Exterior color" },
              location: { type: "string", description: "Seller location (city, state)" },
              description: {
                type: "string",
                description: "Full listing description text",
              },
              sellerType: {
                type: "string",
                enum: ["private", "dealer"],
                description: "Whether seller is private party or dealer",
              },
              titleStatus: {
                type: "string",
                enum: ["clean", "salvage", "rebuilt", "flood"],
                description: "Vehicle title status",
              },
              imageUrls: {
                type: "array",
                items: { type: "string" },
                description: "URLs of listing photos",
              },
            },
            required: ["make", "model"],
          },
        },
        timeout: 30000,
      }),
    });

    if (!response.ok) {
      console.warn(`Firecrawl failed for ${result.link}: ${response.status}`);
      return null;
    }

    const data: any = await response.json();
    const extracted = data.data?.extract;

    if (!extracted || (!extracted.make && !extracted.model)) {
      console.warn(`No car data extracted from ${result.link}`);
      return null;
    }

    return {
      year: extracted.year || null,
      make: extracted.make || null,
      model: extracted.model || null,
      trimLevel: extracted.trimLevel || null,
      price: extracted.price || null,
      mileage: extracted.mileage || null,
      transmission: extracted.transmission || null,
      drivetrain: extracted.drivetrain || null,
      color: extracted.color || null,
      location: extracted.location || null,
      description: extracted.description || null,
      sellerType: extracted.sellerType || null,
      titleStatus: extracted.titleStatus || null,
      imageUrls: extracted.imageUrls || [],
    };
  } catch (error) {
    console.error(`Firecrawl error for ${result.link}:`, error);
    return null;
  }
}

/**
 * Batch extract listings from multiple URLs.
 * Firecrawl is called per-URL but we add delays to be respectful.
 */
export async function extractListingsBatch(
  results: GoogleSearchResult[]
): Promise<Map<string, FirecrawlExtraction>> {
  const extractions = new Map<string, FirecrawlExtraction>();

  for (const result of results) {
    const data = await extractListingData(result);
    if (data) {
      extractions.set(result.link, data);
    }
    // Small delay between requests
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return extractions;
}
