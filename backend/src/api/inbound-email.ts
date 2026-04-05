import type { SESEvent } from "aws-lambda";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { parseIncomingEmail, applyModification } from "../shared/email-parser";
import {
  sendWelcome,
  sendSearchCreated,
  sendSearchList,
  sendSearchModified,
  sendConfirmation,
  sendHelp,
  sendError,
} from "../shared/email-responder";
import {
  getProfileByEmail,
  putProfile,
  updateProfile,
  getSearchesByUser,
  putSearchProfile,
  deleteSearchProfile,
} from "../shared/db";
import { signUnsubscribeToken } from "../shared/auth";
import { randomUUID } from "crypto";
import type { SearchProfile } from "../shared/types";

const s3 = new S3Client({});

export async function handler(event: SESEvent): Promise<void> {
  for (const record of event.Records) {
    const sesRecord = record.ses;
    const messageId = sesRecord.mail.messageId;
    const fromEmail = sesRecord.mail.source.toLowerCase().trim();
    const subject = sesRecord.mail.commonHeaders?.subject || "";

    console.log(`Inbound email from ${fromEmail}: "${subject}"`);

    // Fetch the full email body from S3
    let body = "";
    try {
      const bucket = process.env.SES_INBOUND_BUCKET!;
      const result = await s3.send(
        new GetObjectCommand({ Bucket: bucket, Key: messageId })
      );
      const rawEmail = await result.Body?.transformToString("utf-8");
      body = extractTextBody(rawEmail || "");
    } catch (error) {
      console.warn("Could not fetch email body from S3:", error);
      body = subject; // Fall back to just the subject
    }

    try {
      await processEmail(fromEmail, subject, body);
    } catch (error) {
      console.error(`Error processing email from ${fromEmail}:`, error);
      await sendError(fromEmail, "An unexpected error occurred. Please try again.");
    }
  }
}

async function processEmail(
  fromEmail: string,
  subject: string,
  body: string
): Promise<void> {
  // Find or create user
  let profile = await getProfileByEmail(fromEmail);
  const isNewUser = !profile;

  if (!profile) {
    const id = randomUUID();
    profile = {
      id,
      email: fromEmail,
      displayName: null,
      notificationHour: 8,
      timezone: "America/New_York",
      isActive: true,
      notificationsEnabled: true,
      unsubscribeToken: signUnsubscribeToken(id),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await putProfile(profile);
  }

  // If new user and just sent a generic "hello" or empty email, send welcome
  if (isNewUser && body.trim().length < 10) {
    await sendWelcome(fromEmail);
    return;
  }

  // Parse the email intent using AI
  const intent = await parseIncomingEmail(subject, body, fromEmail);
  console.log(`Intent: ${intent.type}`);

  switch (intent.type) {
    case "create_search": {
      const now = new Date().toISOString();
      const search: SearchProfile = {
        id: randomUUID(),
        userId: profile.id,
        name: intent.data.name || "My Search",
        isActive: true,
        makes: intent.data.makes || null,
        models: intent.data.models || null,
        yearMin: intent.data.yearMin || null,
        yearMax: intent.data.yearMax || null,
        priceMin: intent.data.priceMin || null,
        priceMax: intent.data.priceMax || null,
        mileageMax: intent.data.mileageMax || null,
        transmission: intent.data.transmission || null,
        bodyStyles: intent.data.bodyStyles || null,
        colors: intent.data.colors || null,
        drivetrain: intent.data.drivetrain || null,
        zipCode: null,
        searchRadiusMiles: 100,
        states: null,
        excludeDealers: intent.data.excludeDealers ?? false,
        excludeSalvage: intent.data.excludeSalvage ?? true,
        aiNotes: intent.data.aiNotes || null,
        sources: ["google"],
        createdAt: now,
        updatedAt: now,
      };

      await putSearchProfile(search);

      if (isNewUser) {
        await sendWelcome(fromEmail);
      }
      await sendSearchCreated(fromEmail, search);
      break;
    }

    case "modify_search": {
      const searches = await getSearchesByUser(profile.id);
      const target = findSearch(searches, intent.searchName);

      if (!target) {
        if (searches.length === 0) {
          await sendError(fromEmail, "You don't have any searches to modify. Send a car description to create one!");
        } else if (searches.length === 1) {
          // If only one search, modify it
          const mods = await applyModification(searches[0], intent.modifications);
          const updated = { ...searches[0], ...mods, updatedAt: new Date().toISOString() };
          await putSearchProfile(updated);
          await sendSearchModified(fromEmail, updated, "Your changes have been applied.");
        } else {
          await sendConfirmation(
            fromEmail,
            "Which search?",
            `You have ${searches.length} searches. Please specify which one to modify: ${searches.map((s) => `"${s.name}"`).join(", ")}`
          );
        }
        break;
      }

      const mods = await applyModification(target, intent.modifications);
      const updated = { ...target, ...mods, updatedAt: new Date().toISOString() };
      await putSearchProfile(updated);
      await sendSearchModified(fromEmail, updated, "Your changes have been applied.");
      break;
    }

    case "list_searches": {
      const searches = await getSearchesByUser(profile.id);
      await sendSearchList(fromEmail, searches);
      break;
    }

    case "pause_search": {
      const searches = await getSearchesByUser(profile.id);
      if (intent.searchName) {
        const target = findSearch(searches, intent.searchName);
        if (target) {
          await putSearchProfile({ ...target, isActive: false, updatedAt: new Date().toISOString() });
          await sendConfirmation(fromEmail, `Search paused: ${target.name}`, `"${target.name}" has been paused. Reply "resume ${target.name}" to start it again.`);
        } else {
          await sendError(fromEmail, `I couldn't find a search called "${intent.searchName}".`);
        }
      } else {
        // Pause all
        for (const s of searches) {
          await putSearchProfile({ ...s, isActive: false, updatedAt: new Date().toISOString() });
        }
        await sendConfirmation(fromEmail, "All searches paused", `All ${searches.length} searches have been paused. Reply "resume" to start them again.`);
      }
      break;
    }

    case "resume_search": {
      const searches = await getSearchesByUser(profile.id);
      if (intent.searchName) {
        const target = findSearch(searches, intent.searchName);
        if (target) {
          await putSearchProfile({ ...target, isActive: true, updatedAt: new Date().toISOString() });
          await sendConfirmation(fromEmail, `Search resumed: ${target.name}`, `"${target.name}" is active again.`);
        } else {
          await sendError(fromEmail, `I couldn't find a search called "${intent.searchName}".`);
        }
      } else {
        for (const s of searches) {
          await putSearchProfile({ ...s, isActive: true, updatedAt: new Date().toISOString() });
        }
        await sendConfirmation(fromEmail, "All searches resumed", `All ${searches.length} searches are active again.`);
      }
      break;
    }

    case "delete_search": {
      const searches = await getSearchesByUser(profile.id);
      const target = findSearch(searches, intent.searchName);
      if (target) {
        await deleteSearchProfile(profile.id, target.id);
        await sendConfirmation(fromEmail, `Search deleted: ${target.name}`, `"${target.name}" has been deleted. Your other searches are not affected.`);
      } else {
        await sendError(fromEmail, intent.searchName ? `I couldn't find a search called "${intent.searchName}".` : "Please specify which search to delete.");
      }
      break;
    }

    case "unsubscribe": {
      await updateProfile(profile.id, { notificationsEnabled: false, updatedAt: new Date().toISOString() });
      await sendConfirmation(
        fromEmail,
        "You've been unsubscribed",
        "You won't receive any more emails from CarFinder. Your searches are still saved. Reply \"resubscribe\" anytime to start receiving emails again."
      );
      break;
    }

    case "resubscribe": {
      await updateProfile(profile.id, { notificationsEnabled: true, updatedAt: new Date().toISOString() });
      await sendConfirmation(
        fromEmail,
        "Welcome back!",
        "You'll receive daily digest emails again starting tomorrow. Reply \"list\" to see your active searches."
      );
      break;
    }

    case "help": {
      await sendHelp(fromEmail);
      break;
    }

    case "unknown":
    default: {
      // If we can't parse it, assume they're trying to search for a car
      // Re-parse as a potential car search
      await sendError(
        fromEmail,
        "I wasn't sure what you meant. If you're looking for a car, try describing it more clearly (make, model, year, price range, etc.)."
      );
      break;
    }
  }
}

function findSearch(
  searches: SearchProfile[],
  name: string | null
): SearchProfile | null {
  if (!name) return null;
  const lower = name.toLowerCase();
  // Exact match first
  const exact = searches.find((s) => s.name.toLowerCase() === lower);
  if (exact) return exact;
  // Partial match
  return searches.find((s) => s.name.toLowerCase().includes(lower)) || null;
}

/**
 * Extract plain text body from raw MIME email
 */
function extractTextBody(rawEmail: string): string {
  // Simple extraction: look for text/plain part or strip HTML
  const parts = rawEmail.split(/\r?\n\r?\n/);
  if (parts.length < 2) return rawEmail;

  // Skip headers, get body
  const body = parts.slice(1).join("\n\n");

  // If it looks like MIME, try to find text/plain
  if (body.includes("Content-Type: text/plain")) {
    const textMatch = body.match(
      /Content-Type: text\/plain[^\r\n]*\r?\n\r?\n([\s\S]*?)(?:\r?\n--|\z)/
    );
    if (textMatch) return textMatch[1].trim();
  }

  // Strip HTML tags as fallback
  const stripped = body
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Remove common email reply markers
  const lines = stripped.split("\n");
  const cleanLines: string[] = [];
  for (const line of lines) {
    if (line.match(/^On .+ wrote:$/)) break;
    if (line.match(/^>+/)) continue;
    if (line.match(/^-{3,}$/)) break;
    cleanLines.push(line);
  }

  return cleanLines.join("\n").trim();
}
