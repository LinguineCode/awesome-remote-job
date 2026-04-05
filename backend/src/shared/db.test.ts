import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock AWS SDK
const { mockSend } = vi.hoisted(() => {
  const fn = vi.fn();
  return { mockSend: fn };
});

vi.mock("@aws-sdk/client-dynamodb", () => ({
  DynamoDBClient: class MockDDB {},
}));

vi.mock("@aws-sdk/lib-dynamodb", () => {
  const ddbDocMock = { send: mockSend };
  return {
    DynamoDBDocumentClient: {
      from: () => ddbDocMock,
    },
    GetCommand: class { constructor(public input: any) {} },
    PutCommand: class { constructor(public input: any) {} },
    UpdateCommand: class { constructor(public input: any) {} },
    DeleteCommand: class { constructor(public input: any) {} },
    QueryCommand: class { constructor(public input: any) {} },
    ScanCommand: class { constructor(public input: any) {} },
    BatchWriteCommand: class { constructor(public input: any) {} },
    BatchGetCommand: class { constructor(public input: any) {} },
  };
});

// Set env vars before importing
process.env.PROFILES_TABLE = "profiles";
process.env.SEARCHES_TABLE = "searches";
process.env.LISTINGS_TABLE = "listings";
process.env.RESULTS_TABLE = "results";
process.env.NOTIF_LOG_TABLE = "notif-log";

import {
  getProfileById,
  getProfileByEmail,
  putProfile,
  updateProfile,
  getSearchesByUser,
  getSearchProfile,
  putSearchProfile,
  deleteSearchProfile,
  getAllActiveSearchProfiles,
  getListing,
  putListing,
  getListingsBatch,
  getResultsBySearchProfile,
  getResultsByUser,
  getUnnotifiedResultsByUser,
  putSearchResult,
  markResultsNotified,
  updateResultRating,
  resultExists,
  logNotification,
} from "./db";

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
  name: "Test Search",
  isActive: true,
  makes: ["Porsche"],
  models: ["911"],
  yearMin: 2005,
  yearMax: 2010,
  priceMin: null,
  priceMax: 60000,
  mileageMax: 80000,
  transmission: "manual",
  bodyStyles: null,
  colors: null,
  drivetrain: "rwd",
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

const mockResult = {
  searchProfileId: "search-1",
  listingUrl: "https://example.com/car1",
  userId: "user-1",
  matchedAt: "2024-01-01T00:00:00Z",
  aiScore: 0.85,
  aiSummary: "Great match",
  aiFlags: [],
  aiReasoning: "Perfect criteria match",
  isNotified: false,
  notifiedAt: null,
  userRating: null,
};

beforeEach(() => {
  mockSend.mockReset();
});

describe("db", () => {
  describe("profiles", () => {
    it("getProfileById returns profile when found", async () => {
      mockSend.mockResolvedValue({ Item: mockProfile });
      const result = await getProfileById("user-1");
      expect(result).toEqual(mockProfile);
    });

    it("getProfileById returns null when not found", async () => {
      mockSend.mockResolvedValue({});
      const result = await getProfileById("nonexistent");
      expect(result).toBeNull();
    });

    it("getProfileByEmail returns profile via GSI", async () => {
      mockSend.mockResolvedValue({ Items: [mockProfile] });
      const result = await getProfileByEmail("test@example.com");
      expect(result).toEqual(mockProfile);
    });

    it("getProfileByEmail returns null when no results", async () => {
      mockSend.mockResolvedValue({ Items: [] });
      const result = await getProfileByEmail("notfound@example.com");
      expect(result).toBeNull();
    });

    it("getProfileByEmail returns null when Items is undefined", async () => {
      mockSend.mockResolvedValue({});
      const result = await getProfileByEmail("notfound@example.com");
      expect(result).toBeNull();
    });

    it("putProfile calls ddb.send with PutCommand", async () => {
      mockSend.mockResolvedValue({});
      await putProfile(mockProfile);
      expect(mockSend).toHaveBeenCalledOnce();
    });

    it("updateProfile builds dynamic update expression", async () => {
      mockSend.mockResolvedValue({});
      await updateProfile("user-1", { displayName: "Test", timezone: "UTC" });
      expect(mockSend).toHaveBeenCalledOnce();
    });

    it("updateProfile skips when no updates provided (only id)", async () => {
      await updateProfile("user-1", { id: "user-1" } as any);
      expect(mockSend).not.toHaveBeenCalled();
    });

    it("updateProfile skips when empty updates provided", async () => {
      await updateProfile("user-1", {});
      expect(mockSend).not.toHaveBeenCalled();
    });
  });

  describe("search profiles", () => {
    it("getSearchesByUser returns list of searches", async () => {
      mockSend.mockResolvedValue({ Items: [mockSearch] });
      const result = await getSearchesByUser("user-1");
      expect(result).toEqual([mockSearch]);
    });

    it("getSearchesByUser returns empty array when no items", async () => {
      mockSend.mockResolvedValue({});
      const result = await getSearchesByUser("user-1");
      expect(result).toEqual([]);
    });

    it("getSearchProfile returns search when found", async () => {
      mockSend.mockResolvedValue({ Item: mockSearch });
      const result = await getSearchProfile("user-1", "search-1");
      expect(result).toEqual(mockSearch);
    });

    it("getSearchProfile returns null when not found", async () => {
      mockSend.mockResolvedValue({});
      const result = await getSearchProfile("user-1", "nonexistent");
      expect(result).toBeNull();
    });

    it("putSearchProfile calls ddb.send", async () => {
      mockSend.mockResolvedValue({});
      await putSearchProfile(mockSearch);
      expect(mockSend).toHaveBeenCalledOnce();
    });

    it("deleteSearchProfile calls ddb.send with DeleteCommand", async () => {
      mockSend.mockResolvedValue({});
      await deleteSearchProfile("user-1", "search-1");
      expect(mockSend).toHaveBeenCalledOnce();
    });

    it("getAllActiveSearchProfiles scans with filter", async () => {
      mockSend.mockResolvedValue({ Items: [mockSearch] });
      const result = await getAllActiveSearchProfiles();
      expect(result).toEqual([mockSearch]);
    });

    it("getAllActiveSearchProfiles returns empty when no items", async () => {
      mockSend.mockResolvedValue({});
      const result = await getAllActiveSearchProfiles();
      expect(result).toEqual([]);
    });
  });

  describe("listings", () => {
    const mockListing = {
      url: "https://example.com/car1",
      title: "2007 Porsche 911",
      price: 55000,
      year: 2007,
      make: "Porsche",
      model: "911",
      trimLevel: "Carrera S",
      mileage: 45000,
      transmission: "manual",
      drivetrain: "rwd",
      color: "Silver",
      location: "Los Angeles, CA",
      description: "Great car",
      imageUrls: ["https://img.com/1.jpg"],
      sellerType: "private",
      titleStatus: "clean",
      source: "google:cargurus.com",
      firstSeenAt: "2024-01-01T00:00:00Z",
      lastSeenAt: "2024-01-01T00:00:00Z",
      expiresAt: 9999999999,
    };

    it("getListing returns listing when found", async () => {
      mockSend.mockResolvedValue({ Item: mockListing });
      const result = await getListing("https://example.com/car1");
      expect(result).toEqual(mockListing);
    });

    it("getListing returns null when not found", async () => {
      mockSend.mockResolvedValue({});
      const result = await getListing("https://example.com/nonexistent");
      expect(result).toBeNull();
    });

    it("putListing calls ddb.send", async () => {
      mockSend.mockResolvedValue({});
      await putListing(mockListing);
      expect(mockSend).toHaveBeenCalledOnce();
    });

    it("getListingsBatch returns empty array for empty input", async () => {
      const result = await getListingsBatch([]);
      expect(result).toEqual([]);
      expect(mockSend).not.toHaveBeenCalled();
    });

    it("getListingsBatch returns listings in batches of 100", async () => {
      mockSend.mockImplementation(async (cmd: any) => {
        // Return the table name as key in Responses, extracted from the command input
        const tableName = Object.keys(cmd.input.RequestItems)[0];
        return {
          Responses: { [tableName]: [mockListing] },
        };
      });
      const result = await getListingsBatch(["https://example.com/car1"]);
      expect(mockSend).toHaveBeenCalledOnce();
      expect(result).toEqual([mockListing]);
    });

    it("getListingsBatch handles missing Responses", async () => {
      mockSend.mockResolvedValue({ Responses: {} });
      const result = await getListingsBatch(["https://example.com/car1"]);
      expect(result).toEqual([]);
    });

    it("getListingsBatch handles multiple batches for >100 URLs", async () => {
      const urls = Array.from({ length: 150 }, (_, i) => `https://example.com/car${i}`);
      let callCount = 0;
      mockSend.mockImplementation(async (cmd: any) => {
        const tableName = Object.keys(cmd.input.RequestItems)[0];
        callCount++;
        if (callCount === 1) {
          return { Responses: { [tableName]: [mockListing] } };
        }
        return { Responses: { [tableName]: [{ ...mockListing, url: "https://example.com/car100" }] } };
      });
      const result = await getListingsBatch(urls);
      expect(result).toHaveLength(2);
      expect(mockSend).toHaveBeenCalledTimes(2);
    });
  });

  describe("search results", () => {
    it("getResultsBySearchProfile returns results", async () => {
      mockSend.mockResolvedValue({ Items: [mockResult] });
      const result = await getResultsBySearchProfile("search-1");
      expect(result).toEqual([mockResult]);
    });

    it("getResultsBySearchProfile returns empty when undefined", async () => {
      mockSend.mockResolvedValue({});
      const result = await getResultsBySearchProfile("search-1");
      expect(result).toEqual([]);
    });

    it("getResultsBySearchProfile accepts custom limit", async () => {
      mockSend.mockResolvedValue({ Items: [mockResult] });
      const result = await getResultsBySearchProfile("search-1", 10);
      expect(result).toEqual([mockResult]);
    });

    it("getResultsByUser returns results via GSI", async () => {
      mockSend.mockResolvedValue({ Items: [mockResult] });
      const result = await getResultsByUser("user-1");
      expect(result).toEqual([mockResult]);
    });

    it("getResultsByUser returns empty when undefined", async () => {
      mockSend.mockResolvedValue({});
      const result = await getResultsByUser("user-1");
      expect(result).toEqual([]);
    });

    it("getResultsByUser accepts custom limit", async () => {
      mockSend.mockResolvedValue({ Items: [mockResult] });
      const result = await getResultsByUser("user-1", 10);
      expect(result).toEqual([mockResult]);
    });

    it("getUnnotifiedResultsByUser returns unnotified results", async () => {
      mockSend.mockResolvedValue({ Items: [mockResult] });
      const result = await getUnnotifiedResultsByUser("user-1");
      expect(result).toEqual([mockResult]);
    });

    it("getUnnotifiedResultsByUser returns empty when undefined", async () => {
      mockSend.mockResolvedValue({});
      const result = await getUnnotifiedResultsByUser("user-1");
      expect(result).toEqual([]);
    });

    it("putSearchResult calls ddb.send", async () => {
      mockSend.mockResolvedValue({});
      await putSearchResult(mockResult);
      expect(mockSend).toHaveBeenCalledOnce();
    });

    it("markResultsNotified updates each result", async () => {
      mockSend.mockResolvedValue({});
      await markResultsNotified([mockResult, { ...mockResult, listingUrl: "https://example.com/car2" }]);
      expect(mockSend).toHaveBeenCalledTimes(2);
    });

    it("updateResultRating sends update command", async () => {
      mockSend.mockResolvedValue({});
      await updateResultRating("search-1", "https://example.com/car1", "thumbs_up");
      expect(mockSend).toHaveBeenCalledOnce();
    });

    it("resultExists returns true when item exists", async () => {
      mockSend.mockResolvedValue({ Item: { searchProfileId: "search-1" } });
      const result = await resultExists("search-1", "https://example.com/car1");
      expect(result).toBe(true);
    });

    it("resultExists returns false when item not found", async () => {
      mockSend.mockResolvedValue({});
      const result = await resultExists("search-1", "https://example.com/nonexistent");
      expect(result).toBe(false);
    });
  });

  describe("notification log", () => {
    it("logNotification calls ddb.send with PutCommand", async () => {
      mockSend.mockResolvedValue({});
      await logNotification("user-1", "test@example.com", 5, "sent");
      expect(mockSend).toHaveBeenCalledOnce();
    });
  });
});
