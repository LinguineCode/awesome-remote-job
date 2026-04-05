import type { RawListing, SearchProfile } from "@/types";

export interface Scraper {
  name: string;
  search(profile: SearchProfile): Promise<RawListing[]>;
}

export interface ScraperConfig {
  maxResultsPerSource: number;
  requestDelayMs: number;
  userAgent: string;
}

export const DEFAULT_SCRAPER_CONFIG: ScraperConfig = {
  maxResultsPerSource: 50,
  requestDelayMs: 1000,
  userAgent:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
};

export function buildSearchQuery(profile: SearchProfile): string {
  const parts: string[] = [];
  if (profile.makes?.length) parts.push(...profile.makes);
  if (profile.models?.length) parts.push(...profile.models);
  return parts.join(" ");
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
