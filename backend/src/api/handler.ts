import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { signJWT, getUserIdFromCookies, verifyUnsubscribeToken } from "../shared/auth";
import {
  getProfileById,
  getProfileByEmail,
  putProfile,
  updateProfile,
  getSearchesByUser,
  getSearchProfile,
  putSearchProfile,
  deleteSearchProfile,
  getResultsByUser,
  getResultsBySearchProfile,
  getListingsBatch,
  updateResultRating,
} from "../shared/db";
import { randomUUID } from "crypto";
import { signUnsubscribeToken } from "../shared/auth";

type Response = APIGatewayProxyResultV2;

function json(body: unknown, status = 200, headers?: Record<string, string>): Response {
  return {
    statusCode: status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Credentials": "true",
      ...headers,
    },
    body: JSON.stringify(body),
  };
}

function setCookie(name: string, value: string, maxAge: number): string {
  return `${name}=${value}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
}

export async function handler(
  event: APIGatewayProxyEventV2
): Promise<Response> {
  const method = event.requestContext.http.method;
  const path = event.rawPath;
  const cookies = event.headers?.cookie;

  // --- Auth routes ---

  if (path === "/api/auth/login" && method === "POST") {
    const body = JSON.parse(event.body || "{}");
    const email = body.email?.toLowerCase()?.trim();
    if (!email || !email.includes("@")) {
      return json({ error: "Valid email required" }, 400);
    }

    let profile = await getProfileByEmail(email);
    if (!profile) {
      const id = randomUUID();
      profile = {
        id,
        email,
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

    const token = signJWT(profile.id, profile.email);
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": setCookie("token", token, 30 * 86400),
      },
      body: JSON.stringify({ success: true, user: profile }),
    };
  }

  if (path === "/api/auth/me" && method === "GET") {
    const userId = getUserIdFromCookies(cookies);
    if (!userId) return json({ user: null });
    const profile = await getProfileById(userId);
    return json({ user: profile });
  }

  if (path === "/api/auth/logout" && method === "POST") {
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": setCookie("token", "", 0),
      },
      body: JSON.stringify({ success: true }),
    };
  }

  // --- Unsubscribe (one-click from email) ---

  if (path === "/api/unsubscribe" && method === "GET") {
    const token = event.queryStringParameters?.token;
    if (!token) return json({ error: "Missing token" }, 400);

    const userId = verifyUnsubscribeToken(token);
    if (!userId) return json({ error: "Invalid or expired token" }, 400);

    await updateProfile(userId, {
      notificationsEnabled: false,
      updatedAt: new Date().toISOString(),
    });

    return json({ success: true, message: "You have been unsubscribed." });
  }

  if (path === "/api/resubscribe" && method === "POST") {
    const userId = getUserIdFromCookies(cookies);
    if (!userId) return json({ error: "Unauthorized" }, 401);

    await updateProfile(userId, {
      notificationsEnabled: true,
      updatedAt: new Date().toISOString(),
    });

    return json({ success: true });
  }

  // --- Protected routes (require auth) ---

  const userId = getUserIdFromCookies(cookies);
  if (!userId) return json({ error: "Unauthorized" }, 401);

  // --- Profile update ---

  if (path === "/api/profile" && method === "PUT") {
    const body = JSON.parse(event.body || "{}");
    await updateProfile(userId, {
      displayName: body.displayName ?? undefined,
      notificationHour: body.notificationHour ?? undefined,
      timezone: body.timezone ?? undefined,
      notificationsEnabled: body.notificationsEnabled ?? undefined,
      updatedAt: new Date().toISOString(),
    });
    const updated = await getProfileById(userId);
    return json(updated);
  }

  // --- Search profiles ---

  if (path === "/api/searches" && method === "GET") {
    const searches = await getSearchesByUser(userId);
    return json(searches);
  }

  if (path === "/api/searches" && method === "POST") {
    const body = JSON.parse(event.body || "{}");
    const search = {
      id: randomUUID(),
      userId,
      name: body.name || "Untitled Search",
      isActive: true,
      makes: body.makes || null,
      models: body.models || null,
      yearMin: body.yearMin || null,
      yearMax: body.yearMax || null,
      priceMin: body.priceMin || null,
      priceMax: body.priceMax || null,
      mileageMax: body.mileageMax || null,
      transmission: body.transmission || null,
      bodyStyles: body.bodyStyles || null,
      colors: body.colors || null,
      drivetrain: body.drivetrain || null,
      zipCode: body.zipCode || null,
      searchRadiusMiles: body.searchRadiusMiles || 100,
      states: body.states || null,
      excludeDealers: body.excludeDealers ?? false,
      excludeSalvage: body.excludeSalvage ?? true,
      aiNotes: body.aiNotes || null,
      sources: body.sources || ["google"],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await putSearchProfile(search);
    return json(search, 201);
  }

  if (path === "/api/searches" && method === "PUT") {
    const body = JSON.parse(event.body || "{}");
    if (!body.id) return json({ error: "Missing ID" }, 400);

    const existing = await getSearchProfile(userId, body.id);
    if (!existing) return json({ error: "Not found" }, 404);

    const updated = { ...existing, ...body, userId, updatedAt: new Date().toISOString() };
    await putSearchProfile(updated);
    return json(updated);
  }

  if (path === "/api/searches" && method === "DELETE") {
    const id = event.queryStringParameters?.id;
    if (!id) return json({ error: "Missing ID" }, 400);

    const existing = await getSearchProfile(userId, id);
    if (!existing) return json({ error: "Not found" }, 404);

    await deleteSearchProfile(userId, id);
    return json({ success: true });
  }

  // --- Results ---

  if (path === "/api/results" && method === "GET") {
    const searchProfileId = event.queryStringParameters?.search_profile_id;
    const limit = parseInt(event.queryStringParameters?.limit || "50", 10);

    let results;
    if (searchProfileId) {
      results = await getResultsBySearchProfile(searchProfileId, limit);
    } else {
      results = await getResultsByUser(userId, limit);
    }

    // Hydrate with listing data
    const urls = results.map((r) => r.listingUrl);
    const listings = await getListingsBatch(urls);
    const listingMap = new Map(listings.map((l) => [l.url, l]));

    const hydrated = results.map((r) => ({
      ...r,
      listing: listingMap.get(r.listingUrl) || null,
    }));

    return json(hydrated);
  }

  if (path === "/api/results" && method === "PATCH") {
    const body = JSON.parse(event.body || "{}");
    if (!body.searchProfileId || !body.listingUrl || !body.userRating) {
      return json({ error: "Missing fields" }, 400);
    }
    await updateResultRating(body.searchProfileId, body.listingUrl, body.userRating);
    return json({ success: true });
  }

  return json({ error: "Not found" }, 404);
}
