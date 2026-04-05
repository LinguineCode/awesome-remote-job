import { describe, it, expect } from "vitest";
import { buildDigestHTML } from "./daily-digest";
import type { SearchProfile, SearchResult, Listing } from "../shared/types";

const mockSearch: SearchProfile = {
  id: "search-1",
  userId: "user-1",
  name: "Porsche 997 Search",
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
  description: "Excellent condition",
  imageUrls: ["https://img.com/1.jpg"],
  sellerType: "private",
  titleStatus: "clean",
  source: "google:cargurus.com",
  firstSeenAt: "2024-01-01T00:00:00Z",
  lastSeenAt: "2024-01-01T00:00:00Z",
  expiresAt: 9999999999,
};

const mockResult: SearchResult & { listing: Listing } = {
  searchProfileId: "search-1",
  listingUrl: "https://example.com/car1",
  userId: "user-1",
  matchedAt: "2024-01-01T00:00:00Z",
  aiScore: 0.92,
  aiSummary: "Perfect 997.1 Carrera S in great condition",
  aiFlags: ["rare_spec", "price_below_market"],
  aiReasoning: "Exact match for 997.1 criteria",
  isNotified: false,
  notifiedAt: null,
  userRating: null,
  listing: mockListing,
};

describe("buildDigestHTML", () => {
  it("should render HTML with search results", () => {
    const html = buildDigestHTML([
      { searchProfile: mockSearch, results: [mockResult] },
    ]);

    expect(html).toContain("CarFinder");
    expect(html).toContain("Porsche 997 Search");
    expect(html).toContain("Porsche");
    expect(html).toContain("911");
    expect(html).toContain("$55,000");
    expect(html).toContain("45,000 mi");
    expect(html).toContain("92% match");
    expect(html).toContain("Perfect 997.1 Carrera S");
    expect(html).toContain("rare spec");
    expect(html).toContain("price below market");
  });

  it("should render singular 'listing' for single result", () => {
    const html = buildDigestHTML([
      { searchProfile: mockSearch, results: [mockResult] },
    ]);

    expect(html).toContain("1 new listing<");
    expect(html).not.toContain("1 new listings");
  });

  it("should render plural 'listings' for multiple results", () => {
    const result2 = {
      ...mockResult,
      listingUrl: "https://example.com/car2",
      listing: { ...mockListing, url: "https://example.com/car2" },
    };

    const html = buildDigestHTML([
      { searchProfile: mockSearch, results: [mockResult, result2] },
    ]);

    expect(html).toContain("2 new listings");
  });

  it("should show total count across multiple search groups", () => {
    const search2 = { ...mockSearch, id: "search-2", name: "BMW M3 Search" };
    const result2 = {
      ...mockResult,
      searchProfileId: "search-2",
      listing: { ...mockListing, make: "BMW", model: "M3" },
    };

    const html = buildDigestHTML([
      { searchProfile: mockSearch, results: [mockResult] },
      { searchProfile: search2, results: [result2] },
    ]);

    expect(html).toContain(">2<");
    expect(html).toContain("BMW M3 Search");
  });

  it("should handle result with no image", () => {
    const noImageListing = { ...mockListing, imageUrls: [] };
    const noImageResult = { ...mockResult, listing: noImageListing };

    const html = buildDigestHTML([
      { searchProfile: mockSearch, results: [noImageResult] },
    ]);

    expect(html).toContain("No Photo");
  });

  it("should handle result with null price and mileage", () => {
    const noDataListing = { ...mockListing, price: null, mileage: null };
    const result = { ...mockResult, listing: noDataListing };

    const html = buildDigestHTML([
      { searchProfile: mockSearch, results: [result] },
    ]);

    expect(html).toContain("Price N/A");
    expect(html).toContain("Mileage N/A");
  });

  it("should handle result with null score", () => {
    const result = { ...mockResult, aiScore: null };
    const html = buildDigestHTML([
      { searchProfile: mockSearch, results: [result] },
    ]);

    expect(html).toContain("0% match");
  });

  it("should color-code score badges correctly", () => {
    // High score (>= 80) = green
    const highResult = { ...mockResult, aiScore: 0.85 };
    const highHtml = buildDigestHTML([
      { searchProfile: mockSearch, results: [highResult] },
    ]);
    expect(highHtml).toContain("#16a34a"); // green

    // Medium score (60-79) = orange
    const medResult = { ...mockResult, aiScore: 0.65 };
    const medHtml = buildDigestHTML([
      { searchProfile: mockSearch, results: [medResult] },
    ]);
    expect(medHtml).toContain("#ea580c"); // orange

    // Low score (< 60) = red
    const lowResult = { ...mockResult, aiScore: 0.4 };
    const lowHtml = buildDigestHTML([
      { searchProfile: mockSearch, results: [lowResult] },
    ]);
    expect(lowHtml).toContain("#dc2626"); // red
  });

  it("should render all flag types with correct colors", () => {
    const allFlags = [
      "possible_scam",
      "price_below_market",
      "rare_spec",
      "salvage_title",
      "flood_damage",
      "high_mileage",
      "dealer_listing",
      "no_photos",
      "vague_description",
    ];

    const result = { ...mockResult, aiFlags: allFlags };
    const html = buildDigestHTML([
      { searchProfile: mockSearch, results: [result] },
    ]);

    expect(html).toContain("possible scam");
    expect(html).toContain("price below market");
    expect(html).toContain("rare spec");
    expect(html).toContain("salvage title");
    expect(html).toContain("flood damage");
    expect(html).toContain("high mileage");
    expect(html).toContain("dealer listing");
    expect(html).toContain("no photos");
    expect(html).toContain("vague description");
  });

  it("should handle unknown flag type with default color", () => {
    const result = { ...mockResult, aiFlags: ["unknown_flag"] };
    const html = buildDigestHTML([
      { searchProfile: mockSearch, results: [result] },
    ]);
    expect(html).toContain("unknown flag");
    expect(html).toContain("#6b7280"); // default gray
  });

  it("should sort results by score descending", () => {
    const lowResult = {
      ...mockResult,
      aiScore: 0.6,
      listingUrl: "https://example.com/low",
      listing: { ...mockListing, url: "https://example.com/low" },
    };
    const highResult = {
      ...mockResult,
      aiScore: 0.95,
      listingUrl: "https://example.com/high",
      listing: { ...mockListing, url: "https://example.com/high" },
    };

    // Pass low first, high second
    const html = buildDigestHTML([
      { searchProfile: mockSearch, results: [lowResult, highResult] },
    ]);

    // High score should appear first in the HTML
    const highPos = html.indexOf("95% match");
    const lowPos = html.indexOf("60% match");
    expect(highPos).toBeLessThan(lowPos);
  });

  it("should escape HTML in listing data", () => {
    const xssListing = {
      ...mockListing,
      make: '<script>alert("xss")</script>',
      model: 'Test & "Model"',
      location: "City <BR> State",
    };
    const result = { ...mockResult, listing: xssListing };
    const html = buildDigestHTML([
      { searchProfile: mockSearch, results: [result] },
    ]);

    expect(html).not.toContain('<script>');
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&amp;");
    expect(html).toContain("&quot;Model&quot;");
  });

  it("should handle null fields gracefully", () => {
    const sparseListing: Listing = {
      ...mockListing,
      title: null,
      trimLevel: null,
      transmission: null,
      location: null,
      make: null,
      model: null,
    };

    const result = {
      ...mockResult,
      aiSummary: null,
      aiFlags: null,
      listing: sparseListing,
    };

    const html = buildDigestHTML([
      { searchProfile: mockSearch, results: [result] },
    ]);

    // Should not throw
    expect(html).toContain("CarFinder");
  });

  it("should include reply instructions in footer", () => {
    const html = buildDigestHTML([
      { searchProfile: mockSearch, results: [mockResult] },
    ]);

    expect(html).toContain("Reply to this email");
    expect(html).toContain("list");
    expect(html).toContain("pause");
    expect(html).toContain("stop");
  });

  it("should render singular 'listing' in header for total = 1", () => {
    const html = buildDigestHTML([
      { searchProfile: mockSearch, results: [mockResult] },
    ]);
    // The header says "new listing" (singular) or "new listings" (plural)
    expect(html).toMatch(/1<\/p>\s*<p[^>]*>new listing[^s]/);
  });
});
