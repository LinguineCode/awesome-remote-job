import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
  ScanCommand,
  BatchWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import type { Profile, SearchProfile, Listing, SearchResult } from "./types";

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

const PROFILES = process.env.PROFILES_TABLE!;
const SEARCHES = process.env.SEARCHES_TABLE!;
const LISTINGS = process.env.LISTINGS_TABLE!;
const RESULTS = process.env.RESULTS_TABLE!;
const NOTIF_LOG = process.env.NOTIF_LOG_TABLE!;

// --- Profiles ---

export async function getProfileById(id: string): Promise<Profile | null> {
  const { Item } = await ddb.send(new GetCommand({ TableName: PROFILES, Key: { id } }));
  return (Item as Profile) || null;
}

export async function getProfileByEmail(email: string): Promise<Profile | null> {
  const { Items } = await ddb.send(
    new QueryCommand({
      TableName: PROFILES,
      IndexName: "email-index",
      KeyConditionExpression: "email = :email",
      ExpressionAttributeValues: { ":email": email },
      Limit: 1,
    })
  );
  return (Items?.[0] as Profile) || null;
}

export async function putProfile(profile: Profile): Promise<void> {
  await ddb.send(new PutCommand({ TableName: PROFILES, Item: profile }));
}

export async function updateProfile(
  id: string,
  updates: Partial<Profile>
): Promise<void> {
  const expressions: string[] = [];
  const names: Record<string, string> = {};
  const values: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(updates)) {
    if (key === "id") continue;
    const attr = `#${key}`;
    const val = `:${key}`;
    expressions.push(`${attr} = ${val}`);
    names[attr] = key;
    values[val] = value;
  }

  if (expressions.length === 0) return;

  await ddb.send(
    new UpdateCommand({
      TableName: PROFILES,
      Key: { id },
      UpdateExpression: `SET ${expressions.join(", ")}`,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
    })
  );
}

// --- Search Profiles ---

export async function getSearchesByUser(userId: string): Promise<SearchProfile[]> {
  const { Items } = await ddb.send(
    new QueryCommand({
      TableName: SEARCHES,
      KeyConditionExpression: "userId = :userId",
      ExpressionAttributeValues: { ":userId": userId },
    })
  );
  return (Items as SearchProfile[]) || [];
}

export async function getSearchProfile(
  userId: string,
  id: string
): Promise<SearchProfile | null> {
  const { Item } = await ddb.send(
    new GetCommand({ TableName: SEARCHES, Key: { userId, id } })
  );
  return (Item as SearchProfile) || null;
}

export async function putSearchProfile(profile: SearchProfile): Promise<void> {
  await ddb.send(new PutCommand({ TableName: SEARCHES, Item: profile }));
}

export async function deleteSearchProfile(userId: string, id: string): Promise<void> {
  await ddb.send(new DeleteCommand({ TableName: SEARCHES, Key: { userId, id } }));
}

export async function getAllActiveSearchProfiles(): Promise<SearchProfile[]> {
  const { Items } = await ddb.send(
    new ScanCommand({
      TableName: SEARCHES,
      FilterExpression: "isActive = :true",
      ExpressionAttributeValues: { ":true": true },
    })
  );
  return (Items as SearchProfile[]) || [];
}

// --- Listings ---

export async function getListing(url: string): Promise<Listing | null> {
  const { Item } = await ddb.send(new GetCommand({ TableName: LISTINGS, Key: { url } }));
  return (Item as Listing) || null;
}

export async function putListing(listing: Listing): Promise<void> {
  await ddb.send(new PutCommand({ TableName: LISTINGS, Item: listing }));
}

export async function getListingsBatch(urls: string[]): Promise<Listing[]> {
  if (urls.length === 0) return [];
  // DynamoDB BatchGetItem supports max 100 keys
  const results: Listing[] = [];
  for (let i = 0; i < urls.length; i += 100) {
    const batch = urls.slice(i, i + 100);
    const { Responses } = await ddb.send(
      new (await import("@aws-sdk/lib-dynamodb")).BatchGetCommand({
        RequestItems: {
          [LISTINGS]: { Keys: batch.map((url) => ({ url })) },
        },
      })
    );
    if (Responses?.[LISTINGS]) {
      results.push(...(Responses[LISTINGS] as Listing[]));
    }
  }
  return results;
}

// --- Search Results ---

export async function getResultsBySearchProfile(
  searchProfileId: string,
  limit = 50
): Promise<SearchResult[]> {
  const { Items } = await ddb.send(
    new QueryCommand({
      TableName: RESULTS,
      KeyConditionExpression: "searchProfileId = :spId",
      ExpressionAttributeValues: { ":spId": searchProfileId },
      ScanIndexForward: false,
      Limit: limit,
    })
  );
  return (Items as SearchResult[]) || [];
}

export async function getResultsByUser(userId: string, limit = 50): Promise<SearchResult[]> {
  const { Items } = await ddb.send(
    new QueryCommand({
      TableName: RESULTS,
      IndexName: "userId-index",
      KeyConditionExpression: "userId = :userId",
      ExpressionAttributeValues: { ":userId": userId },
      Limit: limit,
    })
  );
  return (Items as SearchResult[]) || [];
}

export async function getUnnotifiedResultsByUser(userId: string): Promise<SearchResult[]> {
  const { Items } = await ddb.send(
    new QueryCommand({
      TableName: RESULTS,
      IndexName: "userId-index",
      KeyConditionExpression: "userId = :userId",
      FilterExpression: "isNotified = :false",
      ExpressionAttributeValues: { ":userId": userId, ":false": false },
    })
  );
  return (Items as SearchResult[]) || [];
}

export async function putSearchResult(result: SearchResult): Promise<void> {
  await ddb.send(new PutCommand({ TableName: RESULTS, Item: result }));
}

export async function markResultsNotified(results: SearchResult[]): Promise<void> {
  const now = new Date().toISOString();
  for (const result of results) {
    await ddb.send(
      new UpdateCommand({
        TableName: RESULTS,
        Key: { searchProfileId: result.searchProfileId, listingUrl: result.listingUrl },
        UpdateExpression: "SET isNotified = :true, notifiedAt = :now",
        ExpressionAttributeValues: { ":true": true, ":now": now },
      })
    );
  }
}

export async function updateResultRating(
  searchProfileId: string,
  listingUrl: string,
  rating: string
): Promise<void> {
  await ddb.send(
    new UpdateCommand({
      TableName: RESULTS,
      Key: { searchProfileId, listingUrl },
      UpdateExpression: "SET userRating = :rating",
      ExpressionAttributeValues: { ":rating": rating },
    })
  );
}

export async function resultExists(
  searchProfileId: string,
  listingUrl: string
): Promise<boolean> {
  const { Item } = await ddb.send(
    new GetCommand({
      TableName: RESULTS,
      Key: { searchProfileId, listingUrl },
      ProjectionExpression: "searchProfileId",
    })
  );
  return !!Item;
}

// --- Notification Log ---

export async function logNotification(
  userId: string,
  emailTo: string,
  resultCount: number,
  status: string
): Promise<void> {
  await ddb.send(
    new PutCommand({
      TableName: NOTIF_LOG,
      Item: {
        userId,
        sentAt: new Date().toISOString(),
        emailTo,
        resultCount,
        status,
      },
    })
  );
}
