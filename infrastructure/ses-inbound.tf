# --- S3 bucket for storing inbound emails ---
resource "aws_s3_bucket" "inbound_email" {
  bucket = "carfinder-inbound-email-${var.environment}"
}

resource "aws_s3_bucket_lifecycle_configuration" "inbound_email" {
  bucket = aws_s3_bucket.inbound_email.id

  rule {
    id     = "auto-delete"
    status = "Enabled"
    expiration {
      days = 7 # Delete raw emails after 7 days
    }
  }
}

resource "aws_s3_bucket_policy" "inbound_email" {
  bucket = aws_s3_bucket.inbound_email.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect    = "Allow"
        Principal = { Service = "ses.amazonaws.com" }
        Action    = "s3:PutObject"
        Resource  = "${aws_s3_bucket.inbound_email.arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceAccount" = data.aws_caller_identity.current.account_id
          }
        }
      }
    ]
  })
}

data "aws_caller_identity" "current" {}

# --- Inbound email Lambda ---
resource "aws_lambda_function" "inbound_email" {
  filename         = "${path.module}/../backend/dist/inbound.zip"
  function_name    = "carfinder-inbound-email-${var.environment}"
  role             = aws_iam_role.lambda_role.arn
  handler          = "api/inbound-email.handler"
  runtime          = "nodejs20.x"
  timeout          = 60
  memory_size      = 256
  source_code_hash = filebase64sha256("${path.module}/../backend/dist/inbound.zip")

  environment {
    variables = {
      ENVIRONMENT        = var.environment
      PROFILES_TABLE     = aws_dynamodb_table.profiles.name
      SEARCHES_TABLE     = aws_dynamodb_table.search_profiles.name
      LISTINGS_TABLE     = aws_dynamodb_table.listings.name
      RESULTS_TABLE      = aws_dynamodb_table.search_results.name
      NOTIF_LOG_TABLE    = aws_dynamodb_table.notification_log.name
      JWT_SECRET         = var.jwt_secret
      OPENAI_API_KEY     = var.openai_api_key
      SES_FROM_EMAIL     = var.ses_from_email
      SES_INBOUND_EMAIL  = var.ses_inbound_email
      SES_INBOUND_BUCKET = aws_s3_bucket.inbound_email.id
    }
  }
}

resource "aws_lambda_permission" "ses_invoke" {
  statement_id  = "AllowSES"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.inbound_email.function_name
  principal     = "ses.amazonaws.com"
  source_account = data.aws_caller_identity.current.account_id
}

resource "aws_cloudwatch_log_group" "inbound_email_logs" {
  name              = "/aws/lambda/${aws_lambda_function.inbound_email.function_name}"
  retention_in_days = 14
}

# --- SES Receipt Rule Set ---
# Note: You must set this as the active receipt rule set in the AWS console
# or via: aws ses set-active-receipt-rule-set --rule-set-name carfinder-inbound
resource "aws_ses_receipt_rule_set" "inbound" {
  rule_set_name = "carfinder-inbound-${var.environment}"
}

resource "aws_ses_receipt_rule" "inbound" {
  name          = "carfinder-process-inbound-${var.environment}"
  rule_set_name = aws_ses_receipt_rule_set.inbound.rule_set_name
  recipients    = [var.ses_inbound_email]
  enabled       = true
  scan_enabled  = true

  # First: store the email in S3 (so Lambda can read the full body)
  s3_action {
    bucket_name = aws_s3_bucket.inbound_email.id
    position    = 1
  }

  # Then: invoke Lambda to process it
  lambda_action {
    function_arn    = aws_lambda_function.inbound_email.arn
    invocation_type = "Event"
    position        = 2
  }
}

# Add S3 read permission for inbound email bucket to Lambda role
resource "aws_iam_role_policy" "lambda_s3_policy" {
  name = "carfinder-lambda-s3-policy-${var.environment}"
  role = aws_iam_role.lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:ListBucket",
        ]
        Resource = [
          aws_s3_bucket.inbound_email.arn,
          "${aws_s3_bucket.inbound_email.arn}/*",
        ]
      }
    ]
  })
}
