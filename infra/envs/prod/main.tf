module "bumeet" {
  source = "../../"

  env      = "prod"
  location = "westeurope"

  api_sku_name  = "P1v3"
  api_always_on = true

  pg_sku_name       = "GP_Standard_D2s_v3"
  pg_storage_mb     = 65536
  pg_admin_password = var.pg_admin_password

  # Longer backup retention + longer KV soft-delete window for prod.
  pg_backup_retention_days             = 35
  key_vault_soft_delete_retention_days = 30
  # NOTE: enable geo-redundant backups + Postgres Zone-Redundant HA on a fresh
  # prod server (both are create-time / planned-migration changes — see modules).

  redis_sku_name = "Standard"
  redis_family   = "C"
  redis_capacity = 1

  acr_sku = "Standard"

  extra_tags = {
    cost_center = "engineering"
    sla         = "99.9"
  }
}

variable "pg_admin_password" {
  type      = string
  sensitive = true
}

output "api_url" { value = module.bumeet.api_url }
output "frontend_url" { value = module.bumeet.frontend_url }
output "acr_login_server" { value = module.bumeet.acr_login_server }
