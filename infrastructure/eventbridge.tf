# --- Daily pipeline schedule ---
resource "aws_scheduler_schedule" "daily_pipeline" {
  name       = "carfinder-daily-pipeline-${var.environment}"
  group_name = "default"

  flexible_time_window {
    mode = "OFF"
  }

  # Run at 6 AM UTC daily
  schedule_expression = "cron(0 6 * * ? *)"

  kms_key_arn = aws_kms_key.main.arn

  target {
    arn      = aws_lambda_function.daily_pipeline.arn
    role_arn = aws_iam_role.scheduler_role.arn
  }
}

resource "aws_iam_role" "scheduler_role" {
  name = "carfinder-scheduler-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "scheduler.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy" "scheduler_policy" {
  name = "carfinder-scheduler-policy-${var.environment}"
  role = aws_iam_role.scheduler_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = "lambda:InvokeFunction"
        Resource = aws_lambda_function.daily_pipeline.arn
      }
    ]
  })
}
