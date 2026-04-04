variable "env" {
  description = "Deployment environment. Must be 'dev' or 'prod'."
  type        = string
  validation {
    condition     = contains(["dev", "prod"], var.env)
    error_message = "env must be 'dev' or 'prod'."
  }
}

variable "location" {
  description = "Azure region for all resources."
  type        = string
  default     = "westeurope"
}

variable "app_name" {
  description = "Base application name used in all resource names."
  type        = string
  default     = "bumeet"
}

# ── App Service ───────────────────────────────────────────────────────────────

variable "api_sku_name" {
  description = "App Service Plan SKU. B1 for dev, P1v3 for prod."
  type        = string
  default     = "B1"
}

variable "api_node_version" {
  description = "Node.js version string for App Service Linux stack."
  type        = string
  default     = "20-lts"
}

variable "api_always_on" {
  description = "Keep the app warmed up. Requires Basic tier or above."
  type        = bool
  default     = false
}

# ── PostgreSQL ────────────────────────────────────────────────────────────────

variable "pg_sku_name" {
  description = "PostgreSQL Flexible Server SKU."
  type        = string
  default     = "B_Standard_B1ms"
}

variable "pg_storage_mb" {
  description = "PostgreSQL storage in MB."
  type        = number
  default     = 32768
}

variable "pg_version" {
  description = "PostgreSQL major version."
  type        = string
  default     = "16"
}

variable "pg_admin_login" {
  description = "PostgreSQL administrator username."
  type        = string
  default     = "bumeetadmin"
}

variable "pg_admin_password" {
  description = "PostgreSQL administrator password. Store in Key Vault, pass via CI secret."
  type        = string
  sensitive   = true
}

variable "pg_db_name" {
  description = "Name of the application database."
  type        = string
  default     = "bumeet"
}

# ── Redis ─────────────────────────────────────────────────────────────────────

variable "redis_sku_name" {
  description = "Redis Cache SKU name."
  type        = string
  default     = "Basic"
}

variable "redis_family" {
  description = "Redis Cache family (C for Basic/Standard, P for Premium)."
  type        = string
  default     = "C"
}

variable "redis_capacity" {
  description = "Redis Cache capacity (0 = C0, 1 = C1, etc.)."
  type        = number
  default     = 0
}

# ── Key Vault ─────────────────────────────────────────────────────────────────

variable "key_vault_soft_delete_retention_days" {
  description = "Days to retain soft-deleted Key Vault objects."
  type        = number
  default     = 7
}

# ── Container Registry ────────────────────────────────────────────────────────

variable "acr_sku" {
  description = "Container Registry SKU. Basic for dev, Standard for prod."
  type        = string
  default     = "Basic"
}

# ── Tags ──────────────────────────────────────────────────────────────────────

variable "extra_tags" {
  description = "Additional tags merged into the default tag set."
  type        = map(string)
  default     = {}
}
