export interface Profile {
  id: string;
  email: string;
  displayName: string | null;
  notificationHour: number;
  timezone: string;
  isActive: boolean;
  notificationsEnabled: boolean;
  unsubscribeToken: string;
  createdAt: string;
  updatedAt: string;
}

export interface SearchProfile {
  id: string;
  userId: string;
  name: string;
  isActive: boolean;
  makes: string[] | null;
  models: string[] | null;
  yearMin: number | null;
  yearMax: number | null;
  priceMin: number | null;
  priceMax: number | null;
  mileageMax: number | null;
  transmission: string | null;
  bodyStyles: string[] | null;
  colors: string[] | null;
  drivetrain: string | null;
  zipCode: string | null;
  searchRadiusMiles: number;
  states: string[] | null;
  excludeDealers: boolean;
  excludeSalvage: boolean;
  aiNotes: string | null;
  sources: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Listing {
  url: string; // partition key — the listing URL is the unique ID
  title: string | null;
  price: number | null;
  year: number | null;
  make: string | null;
  model: string | null;
  trimLevel: string | null;
  mileage: number | null;
  transmission: string | null;
  drivetrain: string | null;
  color: string | null;
  location: string | null;
  description: string | null;
  imageUrls: string[];
  sellerType: string | null;
  titleStatus: string | null;
  source: string; // "google:facebook.com", "google:craigslist.org", etc.
  firstSeenAt: string;
  lastSeenAt: string;
  expiresAt: number; // TTL — auto-delete after 30 days
}

export interface SearchResult {
  searchProfileId: string;
  listingUrl: string;
  userId: string;
  matchedAt: string;
  aiScore: number | null;
  aiSummary: string | null;
  aiFlags: string[] | null;
  aiReasoning: string | null;
  isNotified: boolean;
  notifiedAt: string | null;
  userRating: string | null;
  listing?: Listing; // populated at read time
}

export interface GoogleSearchResult {
  title: string;
  link: string;
  snippet: string;
  source: string; // derived from domain
}

export interface FirecrawlExtraction {
  year: number | null;
  make: string | null;
  model: string | null;
  trimLevel: string | null;
  price: number | null;
  mileage: number | null;
  transmission: string | null;
  drivetrain: string | null;
  color: string | null;
  location: string | null;
  description: string | null;
  sellerType: string | null;
  titleStatus: string | null;
  imageUrls: string[];
}

export interface AIFilterResult {
  score: number;
  summary: string;
  flags: string[];
  reasoning: string;
}
