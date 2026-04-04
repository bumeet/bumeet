module "bumeet" {
  source = "../../"

  env      = "dev"
  location = "westeurope"

  api_sku_name  = "B1"
  api_always_on = false

  pg_sku_name       = "B_Standard_B1ms"
  pg_storage_mb     = 32768
  pg_admin_password = var.pg_admin_password

  redis_sku_name = "Basic"
  redis_family   = "C"
  redis_capacity = 0

  acr_sku = "Basic"

  extra_tags = {
    cost_center = "engineering"
  }
}

variable "pg_admin_password" {
  type      = string
  sensitive = true
}

output "api_url"          { value = module.bumeet.api_url }
output "frontend_url"     { value = module.bumeet.frontend_url }
output "acr_login_server" { value = module.bumeet.acr_login_server }
