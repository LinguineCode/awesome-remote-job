import { describe, it, expect, vi, beforeEach } from "vitest";

process.env.PROFILES_TABLE = "profiles";
process.env.SEARCHES_TABLE = "searches";
process.env.LISTINGS_TABLE = "listings";
process.env.RESULTS_TABLE = "results";
process.env.NOTIF_LOG_TABLE = "notif-log";
process.env.SERPER_API_KEY = "test-key";
process.env.FIRECRAWL_API_KEY = "test-key";
process.env.OPENAI_API_KEY = "test-key";
process.env.SES_FROM_EMAIL = "test@carfinder.app";

vi.mock("../shared/google", () => ({
  searchGoogle: vi.fn(),
}));

vi.mock("../shared/scraper", () => ({
  extractListingsBatch: vi.fn(),
}));

vi.mock("../shared/ai", () => ({
  aiFilterBatch: vi.fn(),
}));

vi.mock("../shared/email", () => ({
  sendDigestForUser: vi.fn(),
}));

vi.mock("../shared/db", () => ({
  getAllActiveSearchProfiles: vi.fn(),
  getListing: vi.fn(),
  putListing: vi.fn(),
  putSearchResult: vi.fn(),
  resultExists: vi.fn(),
  getProfileById: vi.fn(),
}));

import { handler } from "./daily-pipeline";
import * as google from "../shared/google";
import * as scraper from "../shared/scraper";
import * as ai from "../shared/ai";
import * as email from "../shared/email";
import * as db from "../shared/db";
import type { SearchProfile, FirecrawlExtraction } from "../shared/types";

const mockSearch: SearchProfile = {
  id: "search-1",
  userId: "user-1",
  name: "Porsche 997",
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
  aiNotes: null,
  sources: ["google"],
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

const mockExtraction: FirecrawlExtraction = {
  year: 2007,
  make: "Porsche",
  model: "911",
  trimLevel: "Carrera S",
  price: 55000,
  mileage: 45000,
  transmission: "manual",
  drivetrain: "rwd",
  color: "Silver",
  location: "LA, CA",
  description: "Great car",
  sellerType: "private",
  titleStatus: "clean",
  imageUrls: ["https://img.com/1.jpg"],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("daily-pipeline handler", () => {
  it("should exit early when no active search profiles", async () => {
    vi.mocked(db.getAllActiveSearchProfiles).mockResolvedValue([]);
    await handler({} as any);
    expect(google.searchGoogle).not.toHaveBeenCalled();
  });

  it("should run full pipeline: search → extract → filter → store → notify", async () => {
    vi.mocked(db.getAllActiveSearchProfiles).mockResolvedValue([mockSearch]);
    vi.mocked(google.searchGoogle).mockResolvedValue([
      { title: "2007 Porsche 911", link: "https://cargurus.com/123", snippet: "Great", source: "cargurus.com" },
    ]);
    vi.mocked(db.resultExists).mockResolvedValue(false);

    const extractionMap = new Map([["https://cargurus.com/123", mockExtraction]]);
    vi.mocked(scraper.extractListingsBatch).mockResolvedValue(extractionMap);
    vi.mocked(db.putListing).mockResolvedValue(undefined);
    vi.mocked(ai.aiFilterBatch).mockResolvedValue([
      { score: 0.92, summary: "Perfect match", flags: ["rare_spec"], reasoning: "Exact criteria" },
    ]);
    vi.mocked(db.putSearchResult).mockResolvedValue(undefined);
    vi.mocked(email.sendDigestForUser).mockResolvedValue(true);

    await handler({} as any);

    expect(google.searchGoogle).toHaveBeenCalledWith(mockSearch);
    expect(scraper.extractListingsBatch).toHaveBeenCalled();
    expect(ai.aiFilterBatch).toHaveBeenCalled();
    expect(db.putSearchResult).toHaveBeenCalled();
    expect(email.sendDigestForUser).toHaveBeenCalledWith("user-1");
  });

  it("should skip already-seen URLs", async () => {
    vi.mocked(db.getAllActiveSearchProfiles).mockResolvedValue([mockSearch]);
    vi.mocked(google.searchGoogle).mockResolvedValue([
      { title: "Seen Car", link: "https://cargurus.com/seen", snippet: "", source: "cargurus.com" },
    ]);
    vi.mocked(db.resultExists).mockResolvedValue(true);

    await handler({} as any);

    expect(scraper.extractListingsBatch).not.toHaveBeenCalled();
  });

  it("should skip search with zero Google results", async () => {
    vi.mocked(db.getAllActiveSearchProfiles).mockResolvedValue([mockSearch]);
    vi.mocked(google.searchGoogle).mockResolvedValue([]);

    await handler({} as any);

    expect(scraper.extractListingsBatch).not.toHaveBeenCalled();
  });

  it("should skip when extraction returns empty", async () => {
    vi.mocked(db.getAllActiveSearchProfiles).mockResolvedValue([mockSearch]);
    vi.mocked(google.searchGoogle).mockResolvedValue([
      { title: "Car", link: "https://cargurus.com/1", snippet: "", source: "cargurus.com" },
    ]);
    vi.mocked(db.resultExists).mockResolvedValue(false);
    vi.mocked(scraper.extractListingsBatch).mockResolvedValue(new Map());

    await handler({} as any);

    expect(ai.aiFilterBatch).not.toHaveBeenCalled();
  });

  it("should not store results below MIN_SCORE threshold", async () => {
    vi.mocked(db.getAllActiveSearchProfiles).mockResolvedValue([mockSearch]);
    vi.mocked(google.searchGoogle).mockResolvedValue([
      { title: "Car", link: "https://cargurus.com/1", snippet: "", source: "cargurus.com" },
    ]);
    vi.mocked(db.resultExists).mockResolvedValue(false);

    const extractionMap = new Map([["https://cargurus.com/1", mockExtraction]]);
    vi.mocked(scraper.extractListingsBatch).mockResolvedValue(extractionMap);
    vi.mocked(db.putListing).mockResolvedValue(undefined);
    vi.mocked(ai.aiFilterBatch).mockResolvedValue([
      { score: 0.3, summary: "Poor match", flags: [], reasoning: "Doesn't meet criteria" },
    ]);

    await handler({} as any);

    expect(db.putSearchResult).not.toHaveBeenCalled();
    expect(email.sendDigestForUser).not.toHaveBeenCalled();
  });

  it("should handle errors in individual search profiles gracefully", async () => {
    const search2 = { ...mockSearch, id: "search-2", name: "BMW M3" };
    vi.mocked(db.getAllActiveSearchProfiles).mockResolvedValue([mockSearch, search2]);
    vi.mocked(google.searchGoogle)
      .mockRejectedValueOnce(new Error("API error"))
      .mockResolvedValueOnce([]);

    await handler({} as any);

    // Should continue to second profile despite first failing
    expect(google.searchGoogle).toHaveBeenCalledTimes(2);
  });

  it("should handle digest send failures", async () => {
    vi.mocked(db.getAllActiveSearchProfiles).mockResolvedValue([mockSearch]);
    vi.mocked(google.searchGoogle).mockResolvedValue([
      { title: "Car", link: "https://cargurus.com/1", snippet: "", source: "cargurus.com" },
    ]);
    vi.mocked(db.resultExists).mockResolvedValue(false);

    const extractionMap = new Map([["https://cargurus.com/1", mockExtraction]]);
    vi.mocked(scraper.extractListingsBatch).mockResolvedValue(extractionMap);
    vi.mocked(db.putListing).mockResolvedValue(undefined);
    vi.mocked(ai.aiFilterBatch).mockResolvedValue([
      { score: 0.92, summary: "Match", flags: [], reasoning: "Good" },
    ]);
    vi.mocked(db.putSearchResult).mockResolvedValue(undefined);
    vi.mocked(email.sendDigestForUser).mockRejectedValue(new Error("SES error"));

    // Should not throw — errors are caught
    await handler({} as any);
    expect(email.sendDigestForUser).toHaveBeenCalled();
  });

  describe("hardFilter", () => {
    it("should filter out listings below yearMin", async () => {
      const profile = { ...mockSearch, yearMin: 2006 };
      vi.mocked(db.getAllActiveSearchProfiles).mockResolvedValue([profile]);
      vi.mocked(google.searchGoogle).mockResolvedValue([
        { title: "Car", link: "https://cargurus.com/1", snippet: "", source: "cargurus.com" },
      ]);
      vi.mocked(db.resultExists).mockResolvedValue(false);

      const oldExtraction = { ...mockExtraction, year: 2004 };
      vi.mocked(scraper.extractListingsBatch).mockResolvedValue(
        new Map([["https://cargurus.com/1", oldExtraction]])
      );
      vi.mocked(db.putListing).mockResolvedValue(undefined);

      await handler({} as any);

      // Hard filter should eliminate the listing — aiFilterBatch should not be called
      expect(ai.aiFilterBatch).not.toHaveBeenCalled();
    });

    it("should filter out listings above yearMax", async () => {
      const profile = { ...mockSearch, yearMax: 2008 };
      vi.mocked(db.getAllActiveSearchProfiles).mockResolvedValue([profile]);
      vi.mocked(google.searchGoogle).mockResolvedValue([
        { title: "Car", link: "https://cargurus.com/1", snippet: "", source: "cargurus.com" },
      ]);
      vi.mocked(db.resultExists).mockResolvedValue(false);

      const newExtraction = { ...mockExtraction, year: 2012 };
      vi.mocked(scraper.extractListingsBatch).mockResolvedValue(
        new Map([["https://cargurus.com/1", newExtraction]])
      );
      vi.mocked(db.putListing).mockResolvedValue(undefined);

      await handler({} as any);
      expect(ai.aiFilterBatch).not.toHaveBeenCalled();
    });

    it("should filter out listings below priceMin", async () => {
      const profile = { ...mockSearch, priceMin: 40000 };
      vi.mocked(db.getAllActiveSearchProfiles).mockResolvedValue([profile]);
      vi.mocked(google.searchGoogle).mockResolvedValue([
        { title: "Car", link: "https://cargurus.com/1", snippet: "", source: "cargurus.com" },
      ]);
      vi.mocked(db.resultExists).mockResolvedValue(false);

      const cheapExtraction = { ...mockExtraction, price: 20000 };
      vi.mocked(scraper.extractListingsBatch).mockResolvedValue(
        new Map([["https://cargurus.com/1", cheapExtraction]])
      );
      vi.mocked(db.putListing).mockResolvedValue(undefined);

      await handler({} as any);
      expect(ai.aiFilterBatch).not.toHaveBeenCalled();
    });

    it("should filter out listings above priceMax", async () => {
      const profile = { ...mockSearch, priceMax: 50000 };
      vi.mocked(db.getAllActiveSearchProfiles).mockResolvedValue([profile]);
      vi.mocked(google.searchGoogle).mockResolvedValue([
        { title: "Car", link: "https://cargurus.com/1", snippet: "", source: "cargurus.com" },
      ]);
      vi.mocked(db.resultExists).mockResolvedValue(false);

      const expensiveExtraction = { ...mockExtraction, price: 75000 };
      vi.mocked(scraper.extractListingsBatch).mockResolvedValue(
        new Map([["https://cargurus.com/1", expensiveExtraction]])
      );
      vi.mocked(db.putListing).mockResolvedValue(undefined);

      await handler({} as any);
      expect(ai.aiFilterBatch).not.toHaveBeenCalled();
    });

    it("should filter out listings above mileageMax", async () => {
      const profile = { ...mockSearch, mileageMax: 50000 };
      vi.mocked(db.getAllActiveSearchProfiles).mockResolvedValue([profile]);
      vi.mocked(google.searchGoogle).mockResolvedValue([
        { title: "Car", link: "https://cargurus.com/1", snippet: "", source: "cargurus.com" },
      ]);
      vi.mocked(db.resultExists).mockResolvedValue(false);

      const highMileExtraction = { ...mockExtraction, mileage: 100000 };
      vi.mocked(scraper.extractListingsBatch).mockResolvedValue(
        new Map([["https://cargurus.com/1", highMileExtraction]])
      );
      vi.mocked(db.putListing).mockResolvedValue(undefined);

      await handler({} as any);
      expect(ai.aiFilterBatch).not.toHaveBeenCalled();
    });

    it("should filter out wrong make", async () => {
      vi.mocked(db.getAllActiveSearchProfiles).mockResolvedValue([mockSearch]);
      vi.mocked(google.searchGoogle).mockResolvedValue([
        { title: "Car", link: "https://cargurus.com/1", snippet: "", source: "cargurus.com" },
      ]);
      vi.mocked(db.resultExists).mockResolvedValue(false);

      const bmwExtraction = { ...mockExtraction, make: "BMW" };
      vi.mocked(scraper.extractListingsBatch).mockResolvedValue(
        new Map([["https://cargurus.com/1", bmwExtraction]])
      );
      vi.mocked(db.putListing).mockResolvedValue(undefined);

      await handler({} as any);
      expect(ai.aiFilterBatch).not.toHaveBeenCalled();
    });

    it("should filter out wrong model", async () => {
      vi.mocked(db.getAllActiveSearchProfiles).mockResolvedValue([mockSearch]);
      vi.mocked(google.searchGoogle).mockResolvedValue([
        { title: "Car", link: "https://cargurus.com/1", snippet: "", source: "cargurus.com" },
      ]);
      vi.mocked(db.resultExists).mockResolvedValue(false);

      const wrongModel = { ...mockExtraction, model: "Cayenne" };
      vi.mocked(scraper.extractListingsBatch).mockResolvedValue(
        new Map([["https://cargurus.com/1", wrongModel]])
      );
      vi.mocked(db.putListing).mockResolvedValue(undefined);

      await handler({} as any);
      expect(ai.aiFilterBatch).not.toHaveBeenCalled();
    });

    it("should filter out wrong transmission", async () => {
      const profile = { ...mockSearch, transmission: "manual" };
      vi.mocked(db.getAllActiveSearchProfiles).mockResolvedValue([profile]);
      vi.mocked(google.searchGoogle).mockResolvedValue([
        { title: "Car", link: "https://cargurus.com/1", snippet: "", source: "cargurus.com" },
      ]);
      vi.mocked(db.resultExists).mockResolvedValue(false);

      const autoExtraction = { ...mockExtraction, transmission: "automatic" };
      vi.mocked(scraper.extractListingsBatch).mockResolvedValue(
        new Map([["https://cargurus.com/1", autoExtraction]])
      );
      vi.mocked(db.putListing).mockResolvedValue(undefined);

      await handler({} as any);
      expect(ai.aiFilterBatch).not.toHaveBeenCalled();
    });

    it("should filter out wrong drivetrain", async () => {
      const profile = { ...mockSearch, drivetrain: "rwd" };
      vi.mocked(db.getAllActiveSearchProfiles).mockResolvedValue([profile]);
      vi.mocked(google.searchGoogle).mockResolvedValue([
        { title: "Car", link: "https://cargurus.com/1", snippet: "", source: "cargurus.com" },
      ]);
      vi.mocked(db.resultExists).mockResolvedValue(false);

      const awdExtraction = { ...mockExtraction, drivetrain: "awd" };
      vi.mocked(scraper.extractListingsBatch).mockResolvedValue(
        new Map([["https://cargurus.com/1", awdExtraction]])
      );
      vi.mocked(db.putListing).mockResolvedValue(undefined);

      await handler({} as any);
      expect(ai.aiFilterBatch).not.toHaveBeenCalled();
    });

    it("should filter out dealer listings when excludeDealers is true", async () => {
      const profile = { ...mockSearch, excludeDealers: true };
      vi.mocked(db.getAllActiveSearchProfiles).mockResolvedValue([profile]);
      vi.mocked(google.searchGoogle).mockResolvedValue([
        { title: "Car", link: "https://cargurus.com/1", snippet: "", source: "cargurus.com" },
      ]);
      vi.mocked(db.resultExists).mockResolvedValue(false);

      const dealerExtraction = { ...mockExtraction, sellerType: "dealer" };
      vi.mocked(scraper.extractListingsBatch).mockResolvedValue(
        new Map([["https://cargurus.com/1", dealerExtraction]])
      );
      vi.mocked(db.putListing).mockResolvedValue(undefined);

      await handler({} as any);
      expect(ai.aiFilterBatch).not.toHaveBeenCalled();
    });

    it("should filter out salvage titles when excludeSalvage is true", async () => {
      vi.mocked(db.getAllActiveSearchProfiles).mockResolvedValue([mockSearch]); // excludeSalvage: true
      vi.mocked(google.searchGoogle).mockResolvedValue([
        { title: "Car", link: "https://cargurus.com/1", snippet: "", source: "cargurus.com" },
      ]);
      vi.mocked(db.resultExists).mockResolvedValue(false);

      const salvageExtraction = { ...mockExtraction, titleStatus: "salvage" };
      vi.mocked(scraper.extractListingsBatch).mockResolvedValue(
        new Map([["https://cargurus.com/1", salvageExtraction]])
      );
      vi.mocked(db.putListing).mockResolvedValue(undefined);

      await handler({} as any);
      expect(ai.aiFilterBatch).not.toHaveBeenCalled();
    });

    it("should pass listings with null fields through hard filter", async () => {
      vi.mocked(db.getAllActiveSearchProfiles).mockResolvedValue([mockSearch]);
      vi.mocked(google.searchGoogle).mockResolvedValue([
        { title: "Car", link: "https://cargurus.com/1", snippet: "", source: "cargurus.com" },
      ]);
      vi.mocked(db.resultExists).mockResolvedValue(false);

      // Listing with all null values should pass all filters
      const nullExtraction: FirecrawlExtraction = {
        year: null,
        make: null,
        model: null,
        trimLevel: null,
        price: null,
        mileage: null,
        transmission: null,
        drivetrain: null,
        color: null,
        location: null,
        description: null,
        sellerType: null,
        titleStatus: null,
        imageUrls: [],
      };
      vi.mocked(scraper.extractListingsBatch).mockResolvedValue(
        new Map([["https://cargurus.com/1", nullExtraction]])
      );
      vi.mocked(db.putListing).mockResolvedValue(undefined);
      vi.mocked(ai.aiFilterBatch).mockResolvedValue([
        { score: 0.7, summary: "Ok", flags: [], reasoning: "Match" },
      ]);
      vi.mocked(db.putSearchResult).mockResolvedValue(undefined);

      await handler({} as any);
      expect(ai.aiFilterBatch).toHaveBeenCalled();
    });

    it("should use Google result title as fallback when no extraction title", async () => {
      vi.mocked(db.getAllActiveSearchProfiles).mockResolvedValue([mockSearch]);
      vi.mocked(google.searchGoogle).mockResolvedValue([
        { title: "Google Title", link: "https://cargurus.com/1", snippet: "", source: "cargurus.com" },
      ]);
      vi.mocked(db.resultExists).mockResolvedValue(false);

      const extractionMap = new Map([["https://cargurus.com/1", mockExtraction]]);
      vi.mocked(scraper.extractListingsBatch).mockResolvedValue(extractionMap);
      vi.mocked(db.putListing).mockResolvedValue(undefined);
      vi.mocked(ai.aiFilterBatch).mockResolvedValue([
        { score: 0.92, summary: "Match", flags: [], reasoning: "Good" },
      ]);
      vi.mocked(db.putSearchResult).mockResolvedValue(undefined);
      vi.mocked(email.sendDigestForUser).mockResolvedValue(true);

      await handler({} as any);

      const putCall = vi.mocked(db.putListing).mock.calls[0][0];
      expect(putCall.title).toBe("Google Title");
    });
  });
});
