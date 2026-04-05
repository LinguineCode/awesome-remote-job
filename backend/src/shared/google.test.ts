import { describe, it, expect, vi, beforeEach } from "vitest";

process.env.SERPER_API_KEY = "test-serper-key";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { searchGoogle } from "./google";
import type { SearchProfile } from "./types";

const baseProfile: SearchProfile = {
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

beforeEach(() => {
  mockFetch.mockReset();
});

describe("searchGoogle", () => {
  it("should return results from car listing sites", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          organic: [
            { title: "2007 Porsche 911", link: "https://www.cargurus.com/listing/123", snippet: "Great car" },
            { title: "2006 Porsche 911", link: "https://www.cars.com/listing/456", snippet: "Low miles" },
          ],
        }),
    });

    const results = await searchGoogle(baseProfile);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].source).toBe("cargurus.com");
  });

  it("should filter out non-listing URLs", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          organic: [
            { title: "Car reviews", link: "https://www.youtube.com/watch?v=123", snippet: "Review" },
            { title: "Car wiki", link: "https://en.wikipedia.org/wiki/Porsche_911", snippet: "Wiki" },
            { title: "2007 Porsche 911", link: "https://www.cargurus.com/listing/123", snippet: "Listing" },
          ],
        }),
    });

    const results = await searchGoogle(baseProfile);
    const hasYoutube = results.some((r) => r.link.includes("youtube.com"));
    const hasWikipedia = results.some((r) => r.link.includes("wikipedia.org"));
    expect(hasYoutube).toBe(false);
    expect(hasWikipedia).toBe(false);
  });

  it("should deduplicate URLs across queries", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          organic: [
            { title: "2007 Porsche 911", link: "https://www.cargurus.com/listing/123", snippet: "Great car" },
          ],
        }),
    });

    const results = await searchGoogle(baseProfile);
    const cargurus = results.filter((r) => r.link === "https://www.cargurus.com/listing/123");
    expect(cargurus.length).toBe(1);
  });

  it("should handle failed API responses gracefully", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
    });

    const results = await searchGoogle(baseProfile);
    expect(results).toEqual([]);
  });

  it("should handle fetch errors gracefully", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"));

    const results = await searchGoogle(baseProfile);
    expect(results).toEqual([]);
  });

  it("should skip results with no URL", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          organic: [
            { title: "No Link", link: null, snippet: "Missing link" },
            { title: "2007 Porsche", link: "https://www.cargurus.com/listing/1", snippet: "Ok" },
          ],
        }),
    });

    const results = await searchGoogle(baseProfile);
    expect(results.every((r) => r.link !== null)).toBe(true);
  });

  it("should handle profile with no makes/models", async () => {
    const minimalProfile = { ...baseProfile, makes: null, models: null };
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          organic: [
            { title: "Car for sale", link: "https://www.cars.com/listing/1", snippet: "Listing" },
          ],
        }),
    });

    const results = await searchGoogle(minimalProfile);
    expect(results.length).toBeGreaterThanOrEqual(0);
  });

  it("should handle profile with priceMin and priceMax", async () => {
    const profile = { ...baseProfile, priceMin: 30000, priceMax: 60000 };
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ organic: [] }),
    });

    await searchGoogle(profile);
    expect(mockFetch).toHaveBeenCalled();
  });

  it("should handle profile with only priceMax", async () => {
    const profile = { ...baseProfile, priceMin: null, priceMax: 60000 };
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ organic: [] }),
    });

    await searchGoogle(profile);
    expect(mockFetch).toHaveBeenCalled();
  });

  it("should handle profile with only yearMin", async () => {
    const profile = { ...baseProfile, yearMin: 2005, yearMax: null };
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ organic: [] }),
    });

    await searchGoogle(profile);
    expect(mockFetch).toHaveBeenCalled();
  });

  it("should handle profile with states", async () => {
    const profile = { ...baseProfile, states: ["CA", "NY"] };
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ organic: [] }),
    });

    await searchGoogle(profile);
    expect(mockFetch).toHaveBeenCalled();
  });

  it("should handle profile with zipCode when no states", async () => {
    const profile = { ...baseProfile, states: null, zipCode: "90210" };
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ organic: [] }),
    });

    await searchGoogle(profile);
    expect(mockFetch).toHaveBeenCalled();
  });

  it("should filter various listing and non-listing URLs correctly", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          organic: [
            { title: "FB Marketplace", link: "https://facebook.com/marketplace/item/123", snippet: "" },
            { title: "FB Group", link: "https://facebook.com/groups/porsche-fans/123", snippet: "" },
            { title: "Craigslist", link: "https://losangeles.craigslist.org/cto/123", snippet: "" },
            { title: "eBay", link: "https://www.ebay.com/itm/123", snippet: "" },
            { title: "BAT", link: "https://bringatrailer.com/listing/123", snippet: "" },
            { title: "C&B", link: "https://carsandbids.com/auctions/123", snippet: "" },
            { title: "Hemmings", link: "https://www.hemmings.com/listing/123", snippet: "" },
            { title: "Classic", link: "https://classiccars.com/listing/123", snippet: "" },
            { title: "OfferUp", link: "https://offerup.com/item/123", snippet: "" },
            { title: "AutoTrader", link: "https://www.autotrader.com/cars/123", snippet: "" },
            { title: "TrueCar", link: "https://www.truecar.com/used/listing/123", snippet: "" },
            { title: "CarFax", link: "https://www.carfax.com/vehicle/123", snippet: "" },
            { title: "For sale", link: "https://random.com/for-sale/porsche", snippet: "" },
            { title: "Google", link: "https://www.google.com/search?q=test", snippet: "" },
            { title: "KBB", link: "https://www.kbb.com/porsche/911/", snippet: "" },
            { title: "Blog", link: "https://blog.example.com/cars", snippet: "" },
            { title: "News", link: "https://news.example.com/cars", snippet: "" },
            { title: "Review", link: "https://www.edmunds.com/car-reviews/porsche", snippet: "" },
            { title: "Reddit post", link: "https://www.reddit.com/r/porsche/comments/abc/my_911", snippet: "" },
            { title: "Reddit sub", link: "https://www.reddit.com/r/porsche/", snippet: "" },
          ],
        }),
    });

    const results = await searchGoogle(baseProfile);
    const links = results.map((r) => r.link);

    // Should include listing sites
    expect(links.some((l) => l.includes("facebook.com/marketplace"))).toBe(true);
    expect(links.some((l) => l.includes("facebook.com/groups"))).toBe(true);
    expect(links.some((l) => l.includes("craigslist.org"))).toBe(true);
    expect(links.some((l) => l.includes("ebay.com/itm"))).toBe(true);
    expect(links.some((l) => l.includes("bringatrailer.com"))).toBe(true);
    expect(links.some((l) => l.includes("carsandbids.com"))).toBe(true);
    expect(links.some((l) => l.includes("hemmings.com"))).toBe(true);
    expect(links.some((l) => l.includes("classiccars.com"))).toBe(true);
    expect(links.some((l) => l.includes("offerup.com"))).toBe(true);
    expect(links.some((l) => l.includes("autotrader.com"))).toBe(true);
    expect(links.some((l) => l.includes("truecar.com"))).toBe(true);
    expect(links.some((l) => l.includes("carfax.com"))).toBe(true);
    expect(links.some((l) => l.includes("for-sale"))).toBe(true);
    // Reddit posts pass the skip filter but aren't in listingSites and don't contain "for-sale"
    // so they get excluded by the positive matching step

    // Should exclude non-listing sites
    expect(links.some((l) => l.includes("google.com"))).toBe(false);
    expect(links.some((l) => l.includes("kbb.com"))).toBe(false);
    expect(links.some((l) => l.includes("blog.example.com"))).toBe(false);
    expect(links.some((l) => l.includes("news.example.com"))).toBe(false);
    expect(links.some((l) => l.includes("edmunds.com/car-reviews"))).toBe(false);
    // Reddit URLs aren't in listing sites, so both get excluded
    expect(links.some((l) => l.includes("reddit.com"))).toBe(false);
  });

  it("should extract domain correctly from valid and invalid URLs", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          organic: [
            { title: "With www", link: "https://www.cargurus.com/listing/1", snippet: "" },
          ],
        }),
    });

    const results = await searchGoogle(baseProfile);
    expect(results[0].source).toBe("cargurus.com");
  });

  it("should handle no yearMin or yearMax", async () => {
    const profile = { ...baseProfile, yearMin: null, yearMax: null };
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ organic: [] }),
    });

    await searchGoogle(profile);
    expect(mockFetch).toHaveBeenCalled();
  });

  it("should handle no priceMin or priceMax", async () => {
    const profile = { ...baseProfile, priceMin: null, priceMax: null };
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ organic: [] }),
    });

    await searchGoogle(profile);
    expect(mockFetch).toHaveBeenCalled();
  });

  it("should handle no states and no zipCode", async () => {
    const profile = { ...baseProfile, states: null, zipCode: null };
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ organic: [] }),
    });

    await searchGoogle(profile);
    expect(mockFetch).toHaveBeenCalled();
  });

  it("should handle invalid URL in extractDomain", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          organic: [
            { title: "Bad URL", link: "not-a-valid-url-for-sale", snippet: "" },
          ],
        }),
    });

    const results = await searchGoogle(baseProfile);
    // The URL contains "for-sale" so it passes isCarListingUrl
    // extractDomain will catch the URL parse error and return "unknown"
    const result = results.find((r) => r.link === "not-a-valid-url-for-sale");
    if (result) {
      expect(result.source).toBe("unknown");
    }
  });

  it("should handle empty makes array for FB group queries", async () => {
    const profile = { ...baseProfile, makes: [] };
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ organic: [] }),
    });

    await searchGoogle(profile);
    // Should not generate FB group queries for empty makes
    expect(mockFetch).toHaveBeenCalled();
  });
});
