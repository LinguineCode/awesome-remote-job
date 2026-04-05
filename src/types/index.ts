export interface Profile {
  id: string;
  email: string;
  display_name: string | null;
  notification_hour: number;
  timezone: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SearchProfile {
  id: string;
  user_id: string;
  name: string;
  is_active: boolean;
  makes: string[] | null;
  models: string[] | null;
  year_min: number | null;
  year_max: number | null;
  price_min: number | null;
  price_max: number | null;
  mileage_max: number | null;
  transmission: string | null;
  body_styles: string[] | null;
  colors: string[] | null;
  fuel_types: string[] | null;
  drivetrain: string | null;
  zip_code: string | null;
  search_radius_miles: number;
  states: string[] | null;
  exclude_dealers: boolean;
  exclude_salvage: boolean;
  require_photos: boolean;
  min_description_length: number;
  ai_notes: string | null;
  sources: string[];
  created_at: string;
  updated_at: string;
}

export interface Listing {
  id: string;
  source: string;
  source_id: string;
  url: string;
  title: string | null;
  price: number | null;
  year: number | null;
  make: string | null;
  model: string | null;
  trim_level: string | null;
  mileage: number | null;
  transmission: string | null;
  drivetrain: string | null;
  color: string | null;
  location: string | null;
  description: string | null;
  image_urls: string[] | null;
  seller_type: string | null;
  title_status: string | null;
  raw_data: Record<string, unknown> | null;
  first_seen_at: string;
  last_seen_at: string;
  is_active: boolean;
}

export interface SearchResult {
  id: string;
  search_profile_id: string;
  listing_id: string;
  matched_at: string;
  ai_score: number | null;
  ai_summary: string | null;
  ai_flags: string[] | null;
  ai_reasoning: string | null;
  is_notified: boolean;
  notified_at: string | null;
  user_rating: string | null;
  listing?: Listing;
}

export interface RawListing {
  source: string;
  source_id: string;
  url: string;
  title: string;
  price: number | null;
  year: number | null;
  make: string | null;
  model: string | null;
  mileage: number | null;
  location: string | null;
  description: string | null;
  image_urls: string[];
  seller_type: string | null;
  raw_data: Record<string, unknown>;
}

export interface AIFilterResult {
  score: number;
  summary: string;
  flags: string[];
  reasoning: string;
}

export interface AIExtractionResult {
  year: number | null;
  make: string | null;
  model: string | null;
  trim_level: string | null;
  mileage: number | null;
  transmission: string | null;
  drivetrain: string | null;
  color: string | null;
  title_status: string | null;
  seller_type: string | null;
}
