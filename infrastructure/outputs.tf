output "api_url" {
  description = "API Gateway URL"
  value       = aws_apigatewayv2_api.api.api_endpoint
}

output "frontend_url" {
  description = "CloudFront distribution URL"
  value       = "https://${aws_cloudfront_distribution.frontend.domain_name}"
}

output "frontend_bucket" {
  description = "S3 bucket for frontend deployment"
  value       = aws_s3_bucket.frontend.id
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID (for cache invalidation)"
  value       = aws_cloudfront_distribution.frontend.id
}

output "profiles_table" {
  description = "DynamoDB profiles table name"
  value       = aws_dynamodb_table.profiles.name
}

output "searches_table" {
  description = "DynamoDB search profiles table name"
  value       = aws_dynamodb_table.search_profiles.name
}
