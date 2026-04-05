# --- Lambda execution role ---
resource "aws_iam_role" "lambda_role" {
  name = "carfinder-lambda-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy" "lambda_policy" {
  name = "carfinder-lambda-policy-${var.environment}"
  role = aws_iam_role.lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query",
          "dynamodb:Scan",
          "dynamodb:BatchWriteItem",
          "dynamodb:BatchGetItem",
        ]
        Resource = [
          aws_dynamodb_table.profiles.arn,
          "${aws_dynamodb_table.profiles.arn}/index/*",
          aws_dynamodb_table.search_profiles.arn,
          "${aws_dynamodb_table.search_profiles.arn}/index/*",
          aws_dynamodb_table.listings.arn,
          "${aws_dynamodb_table.listings.arn}/index/*",
          aws_dynamodb_table.search_results.arn,
          "${aws_dynamodb_table.search_results.arn}/index/*",
          aws_dynamodb_table.notification_log.arn,
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "ses:SendEmail",
          "ses:SendRawEmail",
        ]
        Resource = [
          aws_ses_email_identity.sender.arn,
          aws_ses_configuration_set.main.arn,
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
        ]
        Resource = [
          aws_cloudwatch_log_group.api_logs.arn,
          "${aws_cloudwatch_log_group.api_logs.arn}:*",
          aws_cloudwatch_log_group.pipeline_logs.arn,
          "${aws_cloudwatch_log_group.pipeline_logs.arn}:*",
          aws_cloudwatch_log_group.inbound_email_logs.arn,
          "${aws_cloudwatch_log_group.inbound_email_logs.arn}:*",
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "xray:PutTraceSegments",
          "xray:PutTelemetryRecords",
        ]
        Resource = "*"
      }
    ]
  })
}

# --- SQS Dead Letter Queues ---
resource "aws_sqs_queue" "api_dlq" {
  name                      = "carfinder-api-dlq-${var.environment}"
  message_retention_seconds = 1209600
  sqs_managed_sse_enabled   = true
}

resource "aws_sqs_queue" "pipeline_dlq" {
  name                      = "carfinder-pipeline-dlq-${var.environment}"
  message_retention_seconds = 1209600
  sqs_managed_sse_enabled   = true
}

resource "aws_sqs_queue" "inbound_email_dlq" {
  name                      = "carfinder-inbound-email-dlq-${var.environment}"
  message_retention_seconds = 1209600
  sqs_managed_sse_enabled   = true
}

# --- DLQ send permissions ---
resource "aws_iam_role_policy" "lambda_dlq_policy" {
  name = "carfinder-lambda-dlq-policy-${var.environment}"
  role = aws_iam_role.lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "sqs:SendMessage",
        ]
        Resource = [
          aws_sqs_queue.api_dlq.arn,
          aws_sqs_queue.pipeline_dlq.arn,
          aws_sqs_queue.inbound_email_dlq.arn,
        ]
      }
    ]
  })
}

# --- Lambda functions ---

# API handler (single Lambda for all API routes)
resource "aws_lambda_function" "api" {
  filename         = "${path.module}/../backend/dist/api.zip"
  function_name    = "carfinder-api-${var.environment}"
  role             = aws_iam_role.lambda_role.arn
  handler          = "api/handler.handler"
  runtime          = "nodejs20.x"
  timeout          = 30
  memory_size      = 256
  source_code_hash = filebase64sha256("${path.module}/../backend/dist/api.zip")

  reserved_concurrent_executions = 100
  kms_key_arn                    = aws_kms_key.main.arn

  dead_letter_config {
    target_arn = aws_sqs_queue.api_dlq.arn
  }

  tracing_config {
    mode = "Active"
  }

  environment {
    variables = {
      ENVIRONMENT       = var.environment
      PROFILES_TABLE    = aws_dynamodb_table.profiles.name
      SEARCHES_TABLE    = aws_dynamodb_table.search_profiles.name
      LISTINGS_TABLE    = aws_dynamodb_table.listings.name
      RESULTS_TABLE     = aws_dynamodb_table.search_results.name
      NOTIF_LOG_TABLE   = aws_dynamodb_table.notification_log.name
      JWT_SECRET        = var.jwt_secret
      OPENAI_API_KEY    = var.openai_api_key
      SERPER_API_KEY    = var.serper_api_key
      FIRECRAWL_API_KEY = var.firecrawl_api_key
      SES_FROM_EMAIL    = var.ses_from_email
      FRONTEND_URL      = "https://${aws_cloudfront_distribution.frontend.domain_name}"
    }
  }
}

# Daily pipeline (cron)
resource "aws_lambda_function" "daily_pipeline" {
  filename         = "${path.module}/../backend/dist/cron.zip"
  function_name    = "carfinder-daily-pipeline-${var.environment}"
  role             = aws_iam_role.lambda_role.arn
  handler          = "cron/daily-pipeline.handler"
  runtime          = "nodejs20.x"
  timeout          = 900 # 15 minutes max
  memory_size      = 512
  source_code_hash = filebase64sha256("${path.module}/../backend/dist/cron.zip")

  reserved_concurrent_executions = 1
  kms_key_arn                    = aws_kms_key.main.arn

  dead_letter_config {
    target_arn = aws_sqs_queue.pipeline_dlq.arn
  }

  tracing_config {
    mode = "Active"
  }

  environment {
    variables = {
      ENVIRONMENT       = var.environment
      PROFILES_TABLE    = aws_dynamodb_table.profiles.name
      SEARCHES_TABLE    = aws_dynamodb_table.search_profiles.name
      LISTINGS_TABLE    = aws_dynamodb_table.listings.name
      RESULTS_TABLE     = aws_dynamodb_table.search_results.name
      NOTIF_LOG_TABLE   = aws_dynamodb_table.notification_log.name
      JWT_SECRET        = var.jwt_secret
      OPENAI_API_KEY    = var.openai_api_key
      SERPER_API_KEY    = var.serper_api_key
      FIRECRAWL_API_KEY = var.firecrawl_api_key
      SES_FROM_EMAIL    = var.ses_from_email
      FRONTEND_URL      = "https://${aws_cloudfront_distribution.frontend.domain_name}"
    }
  }
}

# CloudWatch log groups
resource "aws_cloudwatch_log_group" "api_logs" {
  name              = "/aws/lambda/${aws_lambda_function.api.function_name}"
  retention_in_days = 365
  kms_key_id        = aws_kms_key.main.arn
}

resource "aws_cloudwatch_log_group" "pipeline_logs" {
  name              = "/aws/lambda/${aws_lambda_function.daily_pipeline.function_name}"
  retention_in_days = 365
  kms_key_id        = aws_kms_key.main.arn
}
