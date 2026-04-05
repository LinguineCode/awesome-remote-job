-- CarFinder Database Schema

CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  display_name TEXT,
  notification_hour INT DEFAULT 8,
  timezone TEXT DEFAULT 'America/New_York',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE search_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,

  -- Core criteria
  makes TEXT[],
  models TEXT[],
  year_min INT,
  year_max INT,
  price_min INT,
  price_max INT,
  mileage_max INT,
  transmission TEXT,
  body_styles TEXT[],
  colors TEXT[],
  fuel_types TEXT[],
  drivetrain TEXT,

  -- Location
  zip_code TEXT,
  search_radius_miles INT DEFAULT 100,
  states TEXT[],

  -- Quality filters
  exclude_dealers BOOLEAN DEFAULT false,
  exclude_salvage BOOLEAN DEFAULT true,
  require_photos BOOLEAN DEFAULT true,
  min_description_length INT DEFAULT 50,

  -- AI instructions (freeform)
  ai_notes TEXT,

  -- Sources to search
  sources TEXT[] DEFAULT ARRAY['craigslist', 'autotempest'],

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  source_id TEXT NOT NULL,
  url TEXT NOT NULL,
  title TEXT,
  price INT,
  year INT,
  make TEXT,
  model TEXT,
  trim_level TEXT,
  mileage INT,
  transmission TEXT,
  drivetrain TEXT,
  color TEXT,
  location TEXT,
  description TEXT,
  image_urls TEXT[],
  seller_type TEXT,
  title_status TEXT,
  raw_data JSONB,

  first_seen_at TIMESTAMPTZ DEFAULT now(),
  last_seen_at TIMESTAMPTZ DEFAULT now(),
  is_active BOOLEAN DEFAULT true,

  UNIQUE(source, source_id)
);

CREATE TABLE search_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  search_profile_id UUID NOT NULL REFERENCES search_profiles(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  matched_at TIMESTAMPTZ DEFAULT now(),

  ai_score FLOAT,
  ai_summary TEXT,
  ai_flags TEXT[],
  ai_reasoning TEXT,

  is_notified BOOLEAN DEFAULT false,
  notified_at TIMESTAMPTZ,
  user_rating TEXT,

  UNIQUE(search_profile_id, listing_id)
);

CREATE TABLE notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  sent_at TIMESTAMPTZ DEFAULT now(),
  email_to TEXT NOT NULL,
  result_count INT,
  status TEXT DEFAULT 'sent'
);

-- Indexes
CREATE INDEX idx_listings_make_model ON listings(make, model);
CREATE INDEX idx_listings_source ON listings(source, source_id);
CREATE INDEX idx_listings_last_seen ON listings(last_seen_at);
CREATE INDEX idx_search_results_profile ON search_results(search_profile_id, matched_at DESC);
CREATE INDEX idx_search_results_unnotified ON search_results(search_profile_id) WHERE is_notified = false;
CREATE INDEX idx_search_profiles_user ON search_profiles(user_id);
