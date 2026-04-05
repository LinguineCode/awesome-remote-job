# --- SES Email Identity ---
# For production, verify a domain. For dev, verify individual email addresses.

resource "aws_ses_email_identity" "sender" {
  email = var.ses_from_email
}

# If you have a domain, use this instead:
# resource "aws_ses_domain_identity" "domain" {
#   domain = "carfinder.app"
# }
#
# resource "aws_ses_domain_dkim" "dkim" {
#   domain = aws_ses_domain_identity.domain.domain
# }

# SES configuration set for tracking
resource "aws_ses_configuration_set" "main" {
  name = "carfinder-${var.environment}"

  delivery_options {
    tls_policy = "Require"
  }
}
