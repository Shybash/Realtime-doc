variable "aws_region" {
  type        = string
  description = "AWS deployment region"
  default     = "us-east-1"
}

variable "project_name" {
  type        = string
  description = "Name of the project"
  default     = "collabdocs"
}

variable "environment" {
  type        = string
  description = "Deployment environment name"
  default     = "production"
}

variable "vpc_cidr" {
  type        = string
  description = "VPC CIDR Block"
  default     = "10.0.0.0/16"
}

variable "backend_port" {
  type        = number
  description = "Node.js application container target port"
  default     = 5000
}

variable "frontend_port" {
  type        = number
  description = "React Nginx application container target port"
  default     = 80
}
