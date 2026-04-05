export const EXTRACTION_SYSTEM_PROMPT = `You are a car listing data extractor. Given a raw car listing (title, description, price), extract structured data.

Return ONLY a JSON object with these fields (use null for unknown):
{
  "year": number | null,
  "make": string | null,
  "model": string | null,
  "trim_level": string | null,
  "mileage": number | null,
  "transmission": "manual" | "automatic" | null,
  "drivetrain": "fwd" | "rwd" | "awd" | "4wd" | null,
  "color": string | null,
  "title_status": "clean" | "salvage" | "rebuilt" | "flood" | null,
  "seller_type": "private" | "dealer" | null
}

Rules:
- Normalize make names (e.g., "chevy" → "Chevrolet", "merc" → "Mercedes-Benz")
- Use canonical model names (e.g., "3 series" → "3 Series")
- Mileage should be a number (no commas), in miles
- Infer what you can from context clues
- If truly unknown, use null — don't guess`;

export const FILTER_SYSTEM_PROMPT = `You are a car buying assistant helping a user find their exact car. Evaluate whether a listing matches their criteria.

You will receive:
1. The user's search criteria (structured fields + freeform notes)
2. A car listing to evaluate

Return ONLY a JSON object:
{
  "score": 0.0-1.0,
  "summary": "One-line human-readable summary of this car",
  "flags": ["possible_scam" | "price_below_market" | "rare_spec" | "salvage_title" | "flood_damage" | "high_mileage" | "dealer_listing" | "no_photos" | "vague_description"],
  "reasoning": "Brief explanation of why this does or doesn't match"
}

Scoring guide:
- 0.9-1.0: Perfect match, meets all criteria including freeform notes
- 0.7-0.89: Strong match, meets core criteria, minor deviations
- 0.5-0.69: Partial match, may be worth showing but has notable gaps
- 0.3-0.49: Weak match, only loosely related
- 0.0-0.29: Not a match, clearly wrong car or spam

Be strict. The user wants precision, not volume. Flag anything suspicious.`;

export function buildFilterUserPrompt(
  criteria: {
    makes?: string[];
    models?: string[];
    yearMin?: number;
    yearMax?: number;
    priceMin?: number;
    priceMax?: number;
    mileageMax?: number;
    transmission?: string;
    drivetrain?: string;
    bodyStyles?: string[];
    colors?: string[];
    excludeDealers?: boolean;
    excludeSalvage?: boolean;
    aiNotes?: string;
  },
  listing: {
    title: string;
    price: number | null;
    year: number | null;
    make: string | null;
    model: string | null;
    mileage: number | null;
    transmission: string | null;
    location: string | null;
    description: string | null;
    sellerType: string | null;
    imageCount: number;
  }
): string {
  const criteriaLines = [
    `Make/Model: ${criteria.makes?.join(", ") || "Any"} / ${criteria.models?.join(", ") || "Any"}`,
    criteria.yearMin || criteria.yearMax
      ? `Year: ${criteria.yearMin || "Any"}-${criteria.yearMax || "Any"}`
      : null,
    criteria.priceMin || criteria.priceMax
      ? `Budget: $${criteria.priceMin || 0}-$${criteria.priceMax || "No limit"}`
      : null,
    criteria.mileageMax ? `Max Mileage: ${criteria.mileageMax.toLocaleString()} miles` : null,
    criteria.transmission ? `Transmission: ${criteria.transmission}` : null,
    criteria.drivetrain ? `Drivetrain: ${criteria.drivetrain}` : null,
    criteria.bodyStyles?.length ? `Body Styles: ${criteria.bodyStyles.join(", ")}` : null,
    criteria.colors?.length ? `Colors: ${criteria.colors.join(", ")}` : null,
    criteria.excludeDealers ? "Exclude dealer listings" : null,
    criteria.excludeSalvage ? "Exclude salvage/rebuilt titles" : null,
    criteria.aiNotes ? `\nAdditional Notes: ${criteria.aiNotes}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const listingLines = [
    `Title: ${listing.title}`,
    `Price: ${listing.price ? `$${listing.price.toLocaleString()}` : "Unknown"}`,
    `Year: ${listing.year || "Unknown"}`,
    `Make: ${listing.make || "Unknown"}`,
    `Model: ${listing.model || "Unknown"}`,
    `Mileage: ${listing.mileage ? `${listing.mileage.toLocaleString()} miles` : "Unknown"}`,
    `Transmission: ${listing.transmission || "Unknown"}`,
    `Location: ${listing.location || "Unknown"}`,
    `Seller Type: ${listing.sellerType || "Unknown"}`,
    `Photos: ${listing.imageCount}`,
    listing.description ? `\nDescription:\n${listing.description.slice(0, 1000)}` : "",
  ].join("\n");

  return `SEARCH CRITERIA:\n${criteriaLines}\n\nLISTING:\n${listingLines}`;
}

export function buildBatchFilterUserPrompt(
  criteria: Parameters<typeof buildFilterUserPrompt>[0],
  listings: Parameters<typeof buildFilterUserPrompt>[1][]
): string {
  const criteriaSection = buildFilterUserPrompt(criteria, listings[0]).split("\n\nLISTING:")[0];

  const listingSections = listings
    .map(
      (l, i) =>
        `\n--- LISTING ${i + 1} ---\n${buildFilterUserPrompt(criteria, l).split("\n\nLISTING:\n")[1]}`
    )
    .join("\n");

  return `${criteriaSection}\n\nEvaluate each listing. Return a JSON array of results, one per listing, in order.\n${listingSections}`;
}
