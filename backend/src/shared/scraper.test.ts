import { describe, it, expect, vi, beforeEach } from "vitest";

process.env.FIRECRAWL_API_KEY = "test-firecrawl-key";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { extractListingData, extractListingsBatch } from "./scraper";
import type { GoogleSearchResult } from "./types";

const mockGoogleResult: GoogleSearchResult = {
  title: "2007 Porsche 911 Carrera S",
  link: "https://www.cargurus.com/listing/123",
  snippet: "Great car for sale",
  source: "cargurus.com",
};

const mockExtraction = {
  year: 2007,
  make: "Porsche",
  model: "911",
  trimLevel: "Carrera S",
  price: 55000,
  mileage: 45000,
  transmission: "manual",
  drivetrain: "rwd",
  color: "Silver",
  location: "Los Angeles, CA",
  description: "Excellent condition",
  sellerType: "private",
  titleStatus: "clean",
  imageUrls: ["https://img.com/1.jpg"],
};

beforeEach(() => {
  mockFetch.mockReset();
});

describe("extractListingData", () => {
  it("should extract structured data from a listing URL", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { extract: mockExtraction } }),
    });

    const result = await extractListingData(mockGoogleResult);
    expect(result).not.toBeNull();
    expect(result!.make).toBe("Porsche");
    expect(result!.model).toBe("911");
    expect(result!.price).toBe(55000);
  });

  it("should return null when API response is not ok", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 });
    const result = await extractListingData(mockGoogleResult);
    expect(result).toBeNull();
  });

  it("should return null when no car data is extracted", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { extract: {} } }),
    });

    const result = await extractListingData(mockGoogleResult);
    expect(result).toBeNull();
  });

  it("should return null when extract is null", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { extract: null } }),
    });

    const result = await extractListingData(mockGoogleResult);
    expect(result).toBeNull();
  });

  it("should return null on fetch error", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"));
    const result = await extractListingData(mockGoogleResult);
    expect(result).toBeNull();
  });

  it("should handle partial extraction (make only)", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          data: { extract: { make: "Porsche" } },
        }),
    });

    const result = await extractListingData(mockGoogleResult);
    expect(result).not.toBeNull();
    expect(result!.make).toBe("Porsche");
    expect(result!.model).toBeNull();
    expect(result!.price).toBeNull();
    expect(result!.imageUrls).toEqual([]);
  });

  it("should handle extraction with model only (no make)", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          data: { extract: { model: "911" } },
        }),
    });

    const result = await extractListingData(mockGoogleResult);
    expect(result).not.toBeNull();
    expect(result!.model).toBe("911");
  });

  it("should handle missing data.data", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: {} }),
    });

    const result = await extractListingData(mockGoogleResult);
    expect(result).toBeNull();
  });
});

describe("extractListingsBatch", () => {
  it("should extract data for multiple listings", async () => {
    vi.useFakeTimers();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { extract: mockExtraction } }),
    });

    const results = [
      mockGoogleResult,
      { ...mockGoogleResult, link: "https://www.cargurus.com/listing/456" },
    ];

    const promise = extractListingsBatch(results);
    // Advance timers for the 500ms delays
    await vi.advanceTimersByTimeAsync(1000);
    const extractions = await promise;
    expect(extractions.size).toBe(2);
    vi.useRealTimers();
  });

  it("should skip failed extractions", async () => {
    vi.useFakeTimers();
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: { extract: mockExtraction } }),
      })
      .mockResolvedValueOnce({ ok: false, status: 500 });

    const results = [
      mockGoogleResult,
      { ...mockGoogleResult, link: "https://www.cargurus.com/listing/456" },
    ];

    const promise = extractListingsBatch(results);
    await vi.advanceTimersByTimeAsync(1000);
    const extractions = await promise;
    expect(extractions.size).toBe(1);
    vi.useRealTimers();
  });

  it("should handle empty input", async () => {
    const extractions = await extractListingsBatch([]);
    expect(extractions.size).toBe(0);
  });
});
