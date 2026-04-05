import { describe, it, expect, vi, beforeEach } from "vitest";

process.env.OPENAI_API_KEY = "test-openai-key";

const mockCreate = vi.fn();
vi.mock("openai", () => ({
  default: class {
    chat = { completions: { create: mockCreate } };
  },
}));

import { aiFilterSingle, aiFilterBatch } from "./ai";
import type { SearchProfile, Listing } from "./types";

const mockProfile: SearchProfile = {
  id: "search-1",
  userId: "user-1",
  name: "Test Search",
  isActive: true,
  makes: ["Porsche"],
  models: ["911"],
  yearMin: 2005,
  yearMax: 2008,
  priceMin: null,
  priceMax: 60000,
  mileageMax: 80000,
  transmission: "manual",
  bodyStyles: null,
  colors: null,
  drivetrain: null,
  zipCode: null,
  searchRadiusMiles: 100,
  states: null,
  excludeDealers: false,
  excludeSalvage: true,
  aiNotes: "Must be 997.1 generation",
  sources: ["google"],
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

const mockListing: Listing = {
  url: "https://example.com/car1",
  title: "2007 Porsche 911 Carrera S",
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
  description: "Excellent condition 997.1",
  imageUrls: ["https://img.com/1.jpg"],
  sellerType: "private",
  titleStatus: "clean",
  source: "google:cargurus.com",
  firstSeenAt: "2024-01-01T00:00:00Z",
  lastSeenAt: "2024-01-01T00:00:00Z",
  expiresAt: 9999999999,
};

beforeEach(() => {
  mockCreate.mockReset();
});

describe("aiFilterSingle", () => {
  it("should return AI filter result for a listing", async () => {
    const aiResult = { score: 0.92, summary: "Perfect 997.1", flags: ["rare_spec"], reasoning: "Exact match" };
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(aiResult) } }],
    });

    const result = await aiFilterSingle(mockProfile, mockListing);
    expect(result.score).toBe(0.92);
    expect(result.summary).toBe("Perfect 997.1");
    expect(result.flags).toContain("rare_spec");
  });

  it("should return fallback when no content in response", async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: null } }],
    });

    const result = await aiFilterSingle(mockProfile, mockListing);
    expect(result.score).toBe(0);
    expect(result.summary).toBe("AI evaluation failed");
  });

  it("should return fallback when empty choices", async () => {
    mockCreate.mockResolvedValue({ choices: [] });

    const result = await aiFilterSingle(mockProfile, mockListing);
    expect(result.score).toBe(0);
  });

  it("should return fallback on API error", async () => {
    mockCreate.mockRejectedValue(new Error("API rate limit"));

    const result = await aiFilterSingle(mockProfile, mockListing);
    expect(result.score).toBe(0);
    expect(result.reasoning).toContain("API rate limit");
  });

  it("should handle listing with no optional fields", async () => {
    const minimalListing: Listing = {
      ...mockListing,
      title: null,
      price: null,
      year: null,
      mileage: null,
      transmission: null,
      location: null,
      sellerType: null,
      description: null,
      imageUrls: [],
    };

    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ score: 0.3, summary: "Sparse", flags: ["vague_description"], reasoning: "Missing data" }) } }],
    });

    const result = await aiFilterSingle(mockProfile, minimalListing);
    expect(result.score).toBe(0.3);
  });

  it("should handle profile with all optional fields populated", async () => {
    const fullProfile = {
      ...mockProfile,
      priceMin: 30000,
      drivetrain: "rwd",
      excludeDealers: true,
      excludeSalvage: true,
    };

    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ score: 0.85, summary: "Good match", flags: [], reasoning: "Meets criteria" }) } }],
    });

    const result = await aiFilterSingle(fullProfile, mockListing);
    expect(result.score).toBe(0.85);
  });

  it("should handle profile with only yearMin (no yearMax)", async () => {
    const profile = { ...mockProfile, yearMin: 2005, yearMax: null };
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ score: 0.7, summary: "Ok", flags: [], reasoning: "Match" }) } }],
    });
    const result = await aiFilterSingle(profile, mockListing);
    expect(result.score).toBe(0.7);
  });

  it("should handle profile with only yearMax (no yearMin)", async () => {
    const profile = { ...mockProfile, yearMin: null, yearMax: 2010 };
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ score: 0.7, summary: "Ok", flags: [], reasoning: "Match" }) } }],
    });
    const result = await aiFilterSingle(profile, mockListing);
    expect(result.score).toBe(0.7);
  });

  it("should handle profile with only priceMin (no priceMax)", async () => {
    const profile = { ...mockProfile, priceMin: 30000, priceMax: null };
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ score: 0.7, summary: "Ok", flags: [], reasoning: "Match" }) } }],
    });
    const result = await aiFilterSingle(profile, mockListing);
    expect(result.score).toBe(0.7);
  });

  it("should handle listing with description to truncate", async () => {
    const longDescListing = { ...mockListing, description: "x".repeat(2000) };
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ score: 0.7, summary: "Ok", flags: [], reasoning: "Match" }) } }],
    });
    const result = await aiFilterSingle(mockProfile, longDescListing);
    expect(result.score).toBe(0.7);
  });

  it("should handle profile with no aiNotes", async () => {
    const noNotesProfile = { ...mockProfile, aiNotes: null };
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ score: 0.7, summary: "Match", flags: [], reasoning: "Ok" }) } }],
    });

    const result = await aiFilterSingle(noNotesProfile, mockListing);
    expect(result.score).toBe(0.7);
  });

  it("should handle profile with no makes or models", async () => {
    const noMakesProfile = { ...mockProfile, makes: null, models: null };
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ score: 0.5, summary: "Ok", flags: [], reasoning: "Ok" }) } }],
    });
    const result = await aiFilterSingle(noMakesProfile, mockListing);
    expect(result.score).toBe(0.5);
  });

  it("should handle profile with no year range or price range or mileage", async () => {
    const noRange = { ...mockProfile, yearMin: null, yearMax: null, priceMin: null, priceMax: null, mileageMax: null, transmission: null, drivetrain: null, excludeDealers: false, excludeSalvage: false, aiNotes: null };
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ score: 0.5, summary: "Ok", flags: [], reasoning: "Ok" }) } }],
    });
    const result = await aiFilterSingle(noRange, mockListing);
    expect(result.score).toBe(0.5);
  });

  it("should build criteria with only yearMin", async () => {
    const profile = { ...mockProfile, yearMin: 2005, yearMax: null, priceMin: null, priceMax: 60000 };
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ score: 0.7, summary: "Ok", flags: [], reasoning: "Ok" }) } }],
    });
    await aiFilterSingle(profile, mockListing);
    expect(mockCreate).toHaveBeenCalled();
  });

  it("should format listing text with all null fields", async () => {
    const nullListing: Listing = {
      url: "https://test.com",
      title: null,
      price: null,
      year: null,
      make: null,
      model: null,
      trimLevel: null,
      mileage: null,
      transmission: null,
      drivetrain: null,
      color: null,
      location: null,
      description: null,
      imageUrls: [],
      sellerType: null,
      titleStatus: null,
      source: "google",
      firstSeenAt: "",
      lastSeenAt: "",
      expiresAt: 0,
    };
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ score: 0.3, summary: "Sparse", flags: [], reasoning: "No data" }) } }],
    });
    const result = await aiFilterSingle(mockProfile, nullListing);
    expect(result.score).toBe(0.3);
  });
});

describe("aiFilterBatch", () => {
  it("should return empty array for empty input", async () => {
    const result = await aiFilterBatch(mockProfile, []);
    expect(result).toEqual([]);
  });

  it("should delegate to aiFilterSingle for single item", async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ score: 0.9, summary: "Great", flags: [], reasoning: "Match" }) } }],
    });

    const result = await aiFilterBatch(mockProfile, [mockListing]);
    expect(result).toHaveLength(1);
    expect(result[0].score).toBe(0.9);
  });

  it("should batch multiple listings", async () => {
    const batchResult = {
      results: [
        { score: 0.9, summary: "Great", flags: [], reasoning: "Match" },
        { score: 0.7, summary: "Good", flags: [], reasoning: "Partial" },
      ],
    };

    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(batchResult) } }],
    });

    const listings = [mockListing, { ...mockListing, url: "https://example.com/car2" }];
    const result = await aiFilterBatch(mockProfile, listings);
    expect(result).toHaveLength(2);
    expect(result[0].score).toBe(0.9);
    expect(result[1].score).toBe(0.7);
  });

  it("should handle batch with no content in response", async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: null } }],
    });

    const listings = [mockListing, { ...mockListing, url: "https://example.com/car2" }];
    const result = await aiFilterBatch(mockProfile, listings);
    expect(result).toHaveLength(2);
    expect(result[0].score).toBe(0);
  });

  it("should handle batch API error", async () => {
    mockCreate.mockRejectedValue(new Error("API error"));

    const listings = [mockListing, { ...mockListing, url: "https://example.com/car2" }];
    const result = await aiFilterBatch(mockProfile, listings);
    expect(result).toHaveLength(2);
    expect(result.every((r) => r.score === 0)).toBe(true);
  });

  it("should handle batch with fewer results than listings", async () => {
    const batchResult = {
      results: [
        { score: 0.9, summary: "Great", flags: [], reasoning: "Match" },
        // Missing second result
      ],
    };

    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(batchResult) } }],
    });

    const listings = [mockListing, { ...mockListing, url: "https://example.com/car2" }];
    const result = await aiFilterBatch(mockProfile, listings);
    expect(result).toHaveLength(2);
    expect(result[0].score).toBe(0.9);
    expect(result[1].score).toBe(0);
  });

  it("should handle response without results array (single object)", async () => {
    const singleResult = { score: 0.8, summary: "Match", flags: [], reasoning: "Ok" };

    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(singleResult) } }],
    });

    const listings = [mockListing, { ...mockListing, url: "https://example.com/car2" }];
    const result = await aiFilterBatch(mockProfile, listings);
    expect(result).toHaveLength(2);
    // When no results array, it wraps [parsed] — first item gets the result
    expect(result[0].score).toBe(0.8);
  });

  it("should process large batches in groups of 10", async () => {
    const batchOfResults = (count: number) => ({
      results: Array.from({ length: count }, (_, i) => ({
        score: 0.8,
        summary: `Match ${i}`,
        flags: [],
        reasoning: "Ok",
      })),
    });

    mockCreate
      .mockResolvedValueOnce({
        choices: [{ message: { content: JSON.stringify(batchOfResults(10)) } }],
      })
      .mockResolvedValueOnce({
        choices: [{ message: { content: JSON.stringify(batchOfResults(2)) } }],
      });

    const listings = Array.from({ length: 12 }, (_, i) => ({
      ...mockListing,
      url: `https://example.com/car${i}`,
    }));

    const result = await aiFilterBatch(mockProfile, listings);
    expect(result).toHaveLength(12);
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });
});
