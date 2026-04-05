import * as cheerio from "cheerio";
import type { RawListing, SearchProfile } from "@/types";
import type { Scraper } from "./types";
import { DEFAULT_SCRAPER_CONFIG, buildSearchQuery } from "./types";
import { parsePrice, parseMileage } from "@/lib/utils/normalize";

function buildAutoTempestUrl(profile: SearchProfile): string {
  const params: Record<string, string> = {};

  if (profile.makes?.length) params.make = profile.makes[0].toLowerCase();
  if (profile.models?.length) params.model = profile.models[0].toLowerCase();
  if (profile.year_min) params.minyear = String(profile.year_min);
  if (profile.year_max) params.maxyear = String(profile.year_max);
  if (profile.price_min) params.minprice = String(profile.price_min);
  if (profile.price_max) params.maxprice = String(profile.price_max);
  if (profile.mileage_max) params.maxmiles = String(profile.mileage_max);
  if (profile.transmission === "manual") params.transmission = "Manual";
  if (profile.transmission === "automatic") params.transmission = "Automatic";
  if (profile.zip_code) params.zip = profile.zip_code;
  if (profile.search_radius_miles) params.radius = String(profile.search_radius_miles);

  const query = new URLSearchParams(params).toString();
  return `https://www.autotempest.com/results?${query}`;
}

async function parseAutoTempestHTML(html: string): Promise<RawListing[]> {
  const $ = cheerio.load(html);
  const listings: RawListing[] = [];

  $(".result-row, .listing-row, [data-listing-id]").each((_, el) => {
    const $el = $(el);
    const sourceId = $el.attr("data-listing-id") || $el.attr("id") || "";
    const title = $el.find(".title, .listing-title, h3, h4").first().text().trim();
    const link = $el.find("a[href]").first().attr("href") || "";
    const priceText = $el.find(".price, .listing-price").first().text().trim();
    const mileageText = $el.find(".mileage, .miles").first().text().trim();
    const locationText = $el.find(".location, .listing-location").first().text().trim();
    const imgSrc = $el.find("img").first().attr("src") || $el.find("img").first().attr("data-src") || "";
    const sourceTag = $el.find(".source, .listing-source").first().text().trim().toLowerCase();

    if (!sourceId && !title) return;

    const url = link.startsWith("http") ? link : `https://www.autotempest.com${link}`;

    listings.push({
      source: `autotempest_${sourceTag || "unknown"}`,
      source_id: sourceId || `at_${Buffer.from(title + priceText).toString("base64").slice(0, 16)}`,
      url,
      title,
      price: priceText ? parsePrice(priceText) : null,
      year: null, // Will be extracted by AI
      make: null,
      model: null,
      mileage: mileageText ? parseMileage(mileageText) : null,
      location: locationText || null,
      description: $el.find(".description, .listing-description").first().text().trim() || null,
      image_urls: imgSrc ? [imgSrc] : [],
      seller_type: null,
      raw_data: { sourceTag, title, priceText, mileageText, locationText },
    });
  });

  return listings;
}

export const autotempestScraper: Scraper = {
  name: "autotempest",

  async search(profile: SearchProfile): Promise<RawListing[]> {
    try {
      const url = buildAutoTempestUrl(profile);
      const response = await fetch(url, {
        headers: {
          "User-Agent": DEFAULT_SCRAPER_CONFIG.userAgent,
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "en-US,en;q=0.9",
        },
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        console.warn(`AutoTempest: HTTP ${response.status}`);
        return [];
      }

      const html = await response.text();
      const listings = await parseAutoTempestHTML(html);
      return listings.slice(0, DEFAULT_SCRAPER_CONFIG.maxResultsPerSource);
    } catch (error) {
      console.error("AutoTempest scraper failed:", error);
      return [];
    }
  },
};
