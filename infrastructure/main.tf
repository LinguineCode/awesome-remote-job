terraform {
  required_version = ">= 1.5"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket         = "carfinder-terraform-state"
    key            = "terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "carfinder-terraform-locks"
    encrypt        = true
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "CarFinder"
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}
