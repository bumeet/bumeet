module "bumeet" {
  source = "../../"

  env      = "dev"
  location = "westeurope"

  api_sku_name  = "B1"
  api_always_on = false

  pg_sku_name       = "B_Standard_B1ms"
  pg_storage_mb     = 32768
  pg_admin_password = var.pg_admin_password

  # Redis was removed: unused by the API (in-memory OAuth state/scheduler)
  # and Basic C0 bills 24/7 (~15 €/month) with no way to stop it.

  acr_sku = "Basic"

  extra_tags = {
    cost_center = "engineering"
  }
}

variable "pg_admin_password" {
  type      = string
  sensitive = true
}

output "api_url" { value = module.bumeet.api_url }
output "frontend_url" { value = module.bumeet.frontend_url }
output "acr_login_server" { value = module.bumeet.acr_login_server }
