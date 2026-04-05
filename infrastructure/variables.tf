variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "production"
}

variable "domain_name" {
  description = "Custom domain name for the app (optional)"
  type        = string
  default     = ""
}

variable "serper_api_key" {
  description = "Serper.dev API key for Google search"
  type        = string
  sensitive   = true
}

variable "firecrawl_api_key" {
  description = "Firecrawl API key for web scraping"
  type        = string
  sensitive   = true
}

variable "openai_api_key" {
  description = "OpenAI API key for AI filtering"
  type        = string
  sensitive   = true
}

variable "jwt_secret" {
  description = "Secret for signing JWT tokens"
  type        = string
  sensitive   = true
}

variable "ses_from_email" {
  description = "Verified SES email address for sending"
  type        = string
  default     = "notifications@carfinder.app"
}

variable "ses_inbound_email" {
  description = "Email address for receiving user commands (e.g., search@carfinder.app)"
  type        = string
  default     = "search@carfinder.app"
}
