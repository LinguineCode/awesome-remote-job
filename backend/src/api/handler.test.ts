import { describe, it, expect, vi, beforeEach } from "vitest";

process.env.JWT_SECRET = "test-secret-key-for-jwt-signing";
process.env.PROFILES_TABLE = "profiles";
process.env.SEARCHES_TABLE = "searches";
process.env.LISTINGS_TABLE = "listings";
process.env.RESULTS_TABLE = "results";
process.env.NOTIF_LOG_TABLE = "notif-log";

// Mock db module
vi.mock("../shared/db", () => ({
  getProfileById: vi.fn(),
  getProfileByEmail: vi.fn(),
  putProfile: vi.fn(),
  updateProfile: vi.fn(),
  getSearchesByUser: vi.fn(),
  getSearchProfile: vi.fn(),
  putSearchProfile: vi.fn(),
  deleteSearchProfile: vi.fn(),
  getResultsByUser: vi.fn(),
  getResultsBySearchProfile: vi.fn(),
  getListingsBatch: vi.fn(),
  updateResultRating: vi.fn(),
}));

// Mock auth module - use actual implementation
vi.mock("../shared/auth", async () => {
  const actual = await vi.importActual("../shared/auth");
  return actual;
});

// Mock crypto.randomUUID
vi.mock("crypto", async () => {
  const actual = await vi.importActual("crypto");
  return {
    ...actual,
    randomUUID: () => "test-uuid-1234",
  };
});

import { handler as rawHandler } from "./handler";
import * as db from "../shared/db";
import { signJWT } from "../shared/auth";
import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda";

// handler returns APIGatewayProxyResultV2 which is a union of string | structured result.
// Our handler always returns the structured variant, so narrow the type for test convenience.
const handler = rawHandler as (...args: Parameters<typeof rawHandler>) => Promise<APIGatewayProxyStructuredResultV2>;

const mockProfile = {
  id: "user-1",
  email: "test@example.com",
  displayName: null,
  notificationHour: 8,
  timezone: "America/New_York",
  isActive: true,
  notificationsEnabled: true,
  unsubscribeToken: "tok",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

const mockSearch = {
  id: "search-1",
  userId: "user-1",
  name: "Test",
  isActive: true,
  makes: ["Porsche"],
  models: ["911"],
  yearMin: null,
  yearMax: null,
  priceMin: null,
  priceMax: null,
  mileageMax: null,
  transmission: null,
  bodyStyles: null,
  colors: null,
  drivetrain: null,
  zipCode: null,
  searchRadiusMiles: 100,
  states: null,
  excludeDealers: false,
  excludeSalvage: true,
  aiNotes: null,
  sources: ["google"],
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

function makeEvent(
  method: string,
  path: string,
  opts: { body?: any; cookies?: string; query?: Record<string, string> } = {}
): APIGatewayProxyEventV2 {
  return {
    requestContext: { http: { method } } as any,
    rawPath: path,
    headers: opts.cookies ? { cookie: opts.cookies } : {},
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    queryStringParameters: opts.query || undefined,
  } as any;
}

function getAuthCookie(): string {
  const token = signJWT("user-1", "test@example.com");
  return `token=${token}`;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("API handler", () => {
  describe("POST /api/auth/login", () => {
    it("should create new user and return token", async () => {
      vi.mocked(db.getProfileByEmail).mockResolvedValue(null);
      vi.mocked(db.putProfile).mockResolvedValue(undefined);

      const res = await handler(makeEvent("POST", "/api/auth/login", { body: { email: "new@example.com" } }));
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body as string);
      expect(body.success).toBe(true);
      expect(body.user.email).toBe("new@example.com");
      expect(res.headers?.["Set-Cookie"]).toContain("token=");
    });

    it("should login existing user", async () => {
      vi.mocked(db.getProfileByEmail).mockResolvedValue(mockProfile);

      const res = await handler(makeEvent("POST", "/api/auth/login", { body: { email: "test@example.com" } }));
      expect(res.statusCode).toBe(200);
    });

    it("should reject invalid email", async () => {
      const res = await handler(makeEvent("POST", "/api/auth/login", { body: { email: "invalid" } }));
      expect(res.statusCode).toBe(400);
    });

    it("should reject missing email", async () => {
      const res = await handler(makeEvent("POST", "/api/auth/login", { body: {} }));
      expect(res.statusCode).toBe(400);
    });

    it("should handle empty body", async () => {
      const res = await handler({
        requestContext: { http: { method: "POST" } } as any,
        rawPath: "/api/auth/login",
        headers: {},
        body: undefined,
      } as any);
      expect(res.statusCode).toBe(400);
    });
  });

  describe("GET /api/auth/me", () => {
    it("should return user when authenticated", async () => {
      vi.mocked(db.getProfileById).mockResolvedValue(mockProfile);
      const res = await handler(makeEvent("GET", "/api/auth/me", { cookies: getAuthCookie() }));
      const body = JSON.parse(res.body as string);
      expect(body.user).toEqual(mockProfile);
    });

    it("should return null user when not authenticated", async () => {
      const res = await handler(makeEvent("GET", "/api/auth/me"));
      const body = JSON.parse(res.body as string);
      expect(body.user).toBeNull();
    });
  });

  describe("POST /api/auth/logout", () => {
    it("should clear token cookie", async () => {
      const res = await handler(makeEvent("POST", "/api/auth/logout"));
      expect(res.statusCode).toBe(200);
      expect(res.headers?.["Set-Cookie"]).toContain("Max-Age=0");
    });
  });

  describe("GET /api/unsubscribe", () => {
    it("should unsubscribe with valid token", async () => {
      const { signUnsubscribeToken } = await import("../shared/auth");
      const token = signUnsubscribeToken("user-1");
      vi.mocked(db.updateProfile).mockResolvedValue(undefined);

      const res = await handler(makeEvent("GET", "/api/unsubscribe", { query: { token } }));
      expect(res.statusCode).toBe(200);
      expect(db.updateProfile).toHaveBeenCalled();
    });

    it("should reject missing token", async () => {
      const res = await handler(makeEvent("GET", "/api/unsubscribe"));
      expect(res.statusCode).toBe(400);
    });

    it("should reject invalid token", async () => {
      const res = await handler(makeEvent("GET", "/api/unsubscribe", { query: { token: "invalid" } }));
      expect(res.statusCode).toBe(400);
    });
  });

  describe("POST /api/resubscribe", () => {
    it("should resubscribe authenticated user", async () => {
      vi.mocked(db.updateProfile).mockResolvedValue(undefined);
      const res = await handler(makeEvent("POST", "/api/resubscribe", { cookies: getAuthCookie() }));
      expect(res.statusCode).toBe(200);
      expect(db.updateProfile).toHaveBeenCalled();
    });

    it("should reject unauthenticated user", async () => {
      const res = await handler(makeEvent("POST", "/api/resubscribe"));
      expect(res.statusCode).toBe(401);
    });
  });

  describe("PUT /api/profile", () => {
    it("should update profile", async () => {
      vi.mocked(db.updateProfile).mockResolvedValue(undefined);
      vi.mocked(db.getProfileById).mockResolvedValue({ ...mockProfile, displayName: "Test" });

      const res = await handler(
        makeEvent("PUT", "/api/profile", {
          cookies: getAuthCookie(),
          body: { displayName: "Test", notificationHour: 9, timezone: "UTC", notificationsEnabled: false },
        })
      );
      expect(res.statusCode).toBe(200);
    });

    it("should handle partial body (some fields undefined)", async () => {
      vi.mocked(db.updateProfile).mockResolvedValue(undefined);
      vi.mocked(db.getProfileById).mockResolvedValue(mockProfile);

      const res = await handler(
        makeEvent("PUT", "/api/profile", {
          cookies: getAuthCookie(),
          body: {},
        })
      );
      expect(res.statusCode).toBe(200);
    });

    it("should reject unauthenticated request", async () => {
      const res = await handler(makeEvent("PUT", "/api/profile", { body: { displayName: "Test" } }));
      expect(res.statusCode).toBe(401);
    });
  });

  describe("GET /api/searches", () => {
    it("should return user searches", async () => {
      vi.mocked(db.getSearchesByUser).mockResolvedValue([mockSearch]);
      const res = await handler(makeEvent("GET", "/api/searches", { cookies: getAuthCookie() }));
      const body = JSON.parse(res.body as string);
      expect(body).toHaveLength(1);
    });
  });

  describe("POST /api/searches", () => {
    it("should create a new search", async () => {
      vi.mocked(db.putSearchProfile).mockResolvedValue(undefined);
      const res = await handler(
        makeEvent("POST", "/api/searches", {
          cookies: getAuthCookie(),
          body: { name: "New Search", makes: ["BMW"], models: ["M3"] },
        })
      );
      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body as string);
      expect(body.name).toBe("New Search");
      expect(body.userId).toBe("user-1");
    });

    it("should use defaults for missing fields", async () => {
      vi.mocked(db.putSearchProfile).mockResolvedValue(undefined);
      const res = await handler(
        makeEvent("POST", "/api/searches", { cookies: getAuthCookie(), body: {} })
      );
      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body as string);
      expect(body.name).toBe("Untitled Search");
      expect(body.excludeSalvage).toBe(true);
    });
  });

  describe("PUT /api/searches", () => {
    it("should update an existing search", async () => {
      vi.mocked(db.getSearchProfile).mockResolvedValue(mockSearch);
      vi.mocked(db.putSearchProfile).mockResolvedValue(undefined);

      const res = await handler(
        makeEvent("PUT", "/api/searches", {
          cookies: getAuthCookie(),
          body: { id: "search-1", name: "Updated" },
        })
      );
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body as string);
      expect(body.name).toBe("Updated");
      expect(body.userId).toBe("user-1");
    });

    it("should reject missing ID", async () => {
      const res = await handler(
        makeEvent("PUT", "/api/searches", { cookies: getAuthCookie(), body: {} })
      );
      expect(res.statusCode).toBe(400);
    });

    it("should reject when search not found", async () => {
      vi.mocked(db.getSearchProfile).mockResolvedValue(null);
      const res = await handler(
        makeEvent("PUT", "/api/searches", {
          cookies: getAuthCookie(),
          body: { id: "nonexistent" },
        })
      );
      expect(res.statusCode).toBe(404);
    });
  });

  describe("DELETE /api/searches", () => {
    it("should delete a search", async () => {
      vi.mocked(db.getSearchProfile).mockResolvedValue(mockSearch);
      vi.mocked(db.deleteSearchProfile).mockResolvedValue(undefined);

      const res = await handler(
        makeEvent("DELETE", "/api/searches", {
          cookies: getAuthCookie(),
          query: { id: "search-1" },
        })
      );
      expect(res.statusCode).toBe(200);
    });

    it("should reject missing ID", async () => {
      const res = await handler(
        makeEvent("DELETE", "/api/searches", { cookies: getAuthCookie() })
      );
      expect(res.statusCode).toBe(400);
    });

    it("should reject when search not found", async () => {
      vi.mocked(db.getSearchProfile).mockResolvedValue(null);
      const res = await handler(
        makeEvent("DELETE", "/api/searches", {
          cookies: getAuthCookie(),
          query: { id: "nonexistent" },
        })
      );
      expect(res.statusCode).toBe(404);
    });
  });

  describe("GET /api/results", () => {
    it("should return results for user", async () => {
      vi.mocked(db.getResultsByUser).mockResolvedValue([]);
      vi.mocked(db.getListingsBatch).mockResolvedValue([]);

      const res = await handler(makeEvent("GET", "/api/results", { cookies: getAuthCookie() }));
      expect(res.statusCode).toBe(200);
    });

    it("should filter by search_profile_id", async () => {
      vi.mocked(db.getResultsBySearchProfile).mockResolvedValue([]);
      vi.mocked(db.getListingsBatch).mockResolvedValue([]);

      const res = await handler(
        makeEvent("GET", "/api/results", {
          cookies: getAuthCookie(),
          query: { search_profile_id: "search-1" },
        })
      );
      expect(res.statusCode).toBe(200);
      expect(db.getResultsBySearchProfile).toHaveBeenCalledWith("search-1", 50);
    });

    it("should accept custom limit", async () => {
      vi.mocked(db.getResultsByUser).mockResolvedValue([]);
      vi.mocked(db.getListingsBatch).mockResolvedValue([]);

      await handler(
        makeEvent("GET", "/api/results", {
          cookies: getAuthCookie(),
          query: { limit: "10" },
        })
      );
      expect(db.getResultsByUser).toHaveBeenCalledWith("user-1", 10);
    });

    it("should hydrate results with listing data", async () => {
      const mockResult = {
        searchProfileId: "search-1",
        listingUrl: "https://example.com/car1",
        userId: "user-1",
        matchedAt: "2024-01-01T00:00:00Z",
        aiScore: 0.85,
        aiSummary: "Great",
        aiFlags: [],
        aiReasoning: "Match",
        isNotified: false,
        notifiedAt: null,
        userRating: null,
      };
      const mockListing = {
        url: "https://example.com/car1",
        title: "Car",
        price: 50000,
        year: 2007,
        make: "Porsche",
        model: "911",
        trimLevel: null,
        mileage: 45000,
        transmission: "manual",
        drivetrain: "rwd",
        color: null,
        location: null,
        description: null,
        imageUrls: [],
        sellerType: null,
        titleStatus: null,
        source: "google",
        firstSeenAt: "2024-01-01T00:00:00Z",
        lastSeenAt: "2024-01-01T00:00:00Z",
        expiresAt: 9999999999,
      };

      vi.mocked(db.getResultsByUser).mockResolvedValue([mockResult]);
      vi.mocked(db.getListingsBatch).mockResolvedValue([mockListing]);

      const res = await handler(makeEvent("GET", "/api/results", { cookies: getAuthCookie() }));
      const body = JSON.parse(res.body as string);
      expect(body[0].listing).toEqual(mockListing);
    });

    it("should set listing to null when not found", async () => {
      const mockResult = {
        searchProfileId: "search-1",
        listingUrl: "https://example.com/missing",
        userId: "user-1",
        matchedAt: "2024-01-01T00:00:00Z",
        aiScore: 0.85,
        aiSummary: "Match",
        aiFlags: [],
        aiReasoning: "Ok",
        isNotified: false,
        notifiedAt: null,
        userRating: null,
      };

      vi.mocked(db.getResultsByUser).mockResolvedValue([mockResult]);
      vi.mocked(db.getListingsBatch).mockResolvedValue([]);

      const res = await handler(makeEvent("GET", "/api/results", { cookies: getAuthCookie() }));
      const body = JSON.parse(res.body as string);
      expect(body[0].listing).toBeNull();
    });
  });

  describe("PATCH /api/results", () => {
    it("should update result rating", async () => {
      vi.mocked(db.updateResultRating).mockResolvedValue(undefined);
      const res = await handler(
        makeEvent("PATCH", "/api/results", {
          cookies: getAuthCookie(),
          body: { searchProfileId: "search-1", listingUrl: "https://example.com/car1", userRating: "thumbs_up" },
        })
      );
      expect(res.statusCode).toBe(200);
    });

    it("should reject missing fields", async () => {
      const res = await handler(
        makeEvent("PATCH", "/api/results", {
          cookies: getAuthCookie(),
          body: { searchProfileId: "search-1" },
        })
      );
      expect(res.statusCode).toBe(400);
    });
  });

  describe("404", () => {
    it("should return 404 for unknown routes", async () => {
      const res = await handler(makeEvent("GET", "/api/unknown", { cookies: getAuthCookie() }));
      expect(res.statusCode).toBe(404);
    });
  });
});
