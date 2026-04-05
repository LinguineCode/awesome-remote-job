# --- Profiles table ---
resource "aws_dynamodb_table" "profiles" {
  name         = "carfinder-profiles-${var.environment}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"

  attribute {
    name = "id"
    type = "S"
  }

  attribute {
    name = "email"
    type = "S"
  }

  global_secondary_index {
    name            = "email-index"
    hash_key        = "email"
    projection_type = "ALL"
  }
}

# --- Search Profiles table ---
resource "aws_dynamodb_table" "search_profiles" {
  name         = "carfinder-search-profiles-${var.environment}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "userId"
  range_key    = "id"

  attribute {
    name = "userId"
    type = "S"
  }

  attribute {
    name = "id"
    type = "S"
  }
}

# --- Listings table ---
resource "aws_dynamodb_table" "listings" {
  name         = "carfinder-listings-${var.environment}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "url"

  attribute {
    name = "url"
    type = "S"
  }

  ttl {
    attribute_name = "expiresAt"
    enabled        = true
  }
}

# --- Search Results table ---
resource "aws_dynamodb_table" "search_results" {
  name         = "carfinder-search-results-${var.environment}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "searchProfileId"
  range_key    = "listingUrl"

  attribute {
    name = "searchProfileId"
    type = "S"
  }

  attribute {
    name = "listingUrl"
    type = "S"
  }

  attribute {
    name = "userId"
    type = "S"
  }

  global_secondary_index {
    name            = "userId-index"
    hash_key        = "userId"
    projection_type = "ALL"
  }
}

# --- Notification Log table ---
resource "aws_dynamodb_table" "notification_log" {
  name         = "carfinder-notification-log-${var.environment}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "userId"
  range_key    = "sentAt"

  attribute {
    name = "userId"
    type = "S"
  }

  attribute {
    name = "sentAt"
    type = "S"
  }
}
