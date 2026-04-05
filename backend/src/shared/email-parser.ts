import OpenAI from "openai";
import type { SearchProfile } from "./types";

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}

export type EmailIntent =
  | { type: "create_search"; data: Partial<SearchProfile> }
  | { type: "modify_search"; searchName: string | null; modifications: string }
  | { type: "list_searches" }
  | { type: "pause_search"; searchName: string | null }
  | { type: "resume_search"; searchName: string | null }
  | { type: "delete_search"; searchName: string | null }
  | { type: "unsubscribe" }
  | { type: "resubscribe" }
  | { type: "help" }
  | { type: "unknown"; rawText: string };

const PARSE_SYSTEM_PROMPT = `You are an email parser for CarFinder, a car listing search service. Users email you to create and manage car searches.

Parse the user's email and determine their intent. Return ONLY a JSON object.

If creating a new search, extract all car criteria:
{
  "type": "create_search",
  "data": {
    "name": "Short descriptive name for this search",
    "makes": ["Porsche"],
    "models": ["911"],
    "yearMin": 2005,
    "yearMax": 2008,
    "priceMin": null,
    "priceMax": 60000,
    "mileageMax": 80000,
    "transmission": "manual",
    "drivetrain": "rwd",
    "colors": ["Grey", "Silver"],
    "excludeDealers": false,
    "excludeSalvage": true,
    "aiNotes": "Must be 997.1 generation. Prefer sport chrono package. No sunroof."
  }
}

For modifications to an existing search:
{ "type": "modify_search", "searchName": "Porsche 997 Search" or null, "modifications": "add: must have sport chrono, remove color preference" }

For other intents:
{ "type": "list_searches" }
{ "type": "pause_search", "searchName": "name or null" }
{ "type": "resume_search", "searchName": "name or null" }
{ "type": "delete_search", "searchName": "name or null" }
{ "type": "unsubscribe" }
{ "type": "resubscribe" }
{ "type": "help" }
{ "type": "unknown", "rawText": "..." }

Rules:
- If the email is clearly about finding a specific car, it's "create_search"
- Put EVERYTHING subjective into aiNotes — that's where the magic is
- Infer reasonable defaults (excludeSalvage: true, etc.)
- If they say "stop", "unsubscribe", "cancel" → unsubscribe
- If they say "pause" without specifying which → pause all
- Generate a short, descriptive name for the search
- Be generous with aiNotes — copy over any specific requirements the user mentions`;

export async function parseIncomingEmail(
  subject: string,
  body: string,
  fromEmail: string
): Promise<EmailIntent> {
  const emailContent = `Subject: ${subject}\n\nBody:\n${body.slice(0, 3000)}`;

  try {
    const response = await getOpenAI().chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: PARSE_SYSTEM_PROMPT },
        { role: "user", content: emailContent },
      ],
      temperature: 0.1,
      max_tokens: 800,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return { type: "unknown", rawText: emailContent };

    return JSON.parse(content) as EmailIntent;
  } catch (error) {
    console.error("Email parse error:", error);
    return { type: "unknown", rawText: emailContent };
  }
}

const MODIFY_SYSTEM_PROMPT = `You are updating a car search profile based on a user's request. Given the current search profile and the user's modification request, return the updated profile fields as a JSON object.

Only return the fields that need to change. Keep everything else as-is.

For aiNotes: APPEND the new requirements to existing notes, don't replace them (unless the user explicitly says to remove something).

Return ONLY a JSON object with the changed fields.`;

export async function applyModification(
  currentSearch: SearchProfile,
  modification: string
): Promise<Partial<SearchProfile>> {
  try {
    const response = await getOpenAI().chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: MODIFY_SYSTEM_PROMPT },
        {
          role: "user",
          content: `Current search profile:\n${JSON.stringify(currentSearch, null, 2)}\n\nUser's modification request: ${modification}`,
        },
      ],
      temperature: 0.1,
      max_tokens: 500,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return {};

    return JSON.parse(content) as Partial<SearchProfile>;
  } catch (error) {
    console.error("Modification error:", error);
    return {};
  }
}
