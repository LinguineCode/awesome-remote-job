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

  point_in_time_recovery {
    enabled = true
  }

  server_side_encryption {
    enabled     = true
    kms_key_arn = aws_kms_key.main.arn
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

  point_in_time_recovery {
    enabled = true
  }

  server_side_encryption {
    enabled     = true
    kms_key_arn = aws_kms_key.main.arn
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

  point_in_time_recovery {
    enabled = true
  }

  server_side_encryption {
    enabled     = true
    kms_key_arn = aws_kms_key.main.arn
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

  point_in_time_recovery {
    enabled = true
  }

  server_side_encryption {
    enabled     = true
    kms_key_arn = aws_kms_key.main.arn
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

  point_in_time_recovery {
    enabled = true
  }

  server_side_encryption {
    enabled     = true
    kms_key_arn = aws_kms_key.main.arn
  }
}
