import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import type { Profile, SearchProfile, SearchResult, Listing } from "./types";
import { buildDigestHTML } from "../templates/daily-digest";
import {
  getUnnotifiedResultsByUser,
  getListingsBatch,
  getSearchesByUser,
  markResultsNotified,
  logNotification,
  getProfileById,
} from "./db";

const ses = new SESClient({});

interface SearchGroup {
  searchProfile: SearchProfile;
  results: (SearchResult & { listing: Listing })[];
}

export async function sendDigestForUser(userId: string): Promise<boolean> {
  const profile = await getProfileById(userId);
  if (!profile || !profile.isActive || !profile.notificationsEnabled) return false;

  const unnotified = await getUnnotifiedResultsByUser(userId);
  if (unnotified.length === 0) return false;

  // Hydrate results with listing data
  const listingUrls = unnotified.map((r) => r.listingUrl);
  const listings = await getListingsBatch(listingUrls);
  const listingMap = new Map(listings.map((l) => [l.url, l]));

  // Group by search profile
  const searches = await getSearchesByUser(userId);
  const searchMap = new Map(searches.map((s) => [s.id, s]));

  const groups: SearchGroup[] = [];
  const groupMap = new Map<string, SearchGroup>();

  for (const result of unnotified) {
    const listing = listingMap.get(result.listingUrl);
    const searchProfile = searchMap.get(result.searchProfileId);
    if (!listing || !searchProfile) continue;

    if (!groupMap.has(result.searchProfileId)) {
      const group: SearchGroup = { searchProfile, results: [] };
      groupMap.set(result.searchProfileId, group);
      groups.push(group);
    }

    groupMap.get(result.searchProfileId)!.results.push({
      ...result,
      listing,
    });
  }

  if (groups.length === 0) return false;

  const totalResults = groups.reduce((sum, g) => sum + g.results.length, 0);
  const searchNames = groups.map((g) => g.searchProfile.name).join(", ");

  const html = buildDigestHTML(groups);

  try {
    await ses.send(
      new SendEmailCommand({
        Source: process.env.SES_FROM_EMAIL,
        Destination: { ToAddresses: [profile.email] },
        Message: {
          Subject: {
            Data: `CarFinder: ${totalResults} new match${totalResults !== 1 ? "es" : ""} for ${searchNames}`,
          },
          Body: {
            Html: { Data: html },
          },
        },
        // List-Unsubscribe header for one-click unsubscribe in email clients
        Tags: [
          { Name: "Environment", Value: process.env.ENVIRONMENT || "production" },
        ],
      })
    );

    await markResultsNotified(unnotified);
    await logNotification(userId, profile.email, totalResults, "sent");
    return true;
  } catch (error) {
    console.error(`Failed to send digest to ${profile.email}:`, error);
    await logNotification(userId, profile.email, totalResults, "failed");
    return false;
  }
}
