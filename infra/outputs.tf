output "resource_group_name" {
  description = "Name of the main resource group."
  value       = azurerm_resource_group.main.name
}

output "api_url" {
  description = "HTTPS URL of the NestJS API."
  value       = "https://${module.app_service.default_hostname}"
}

output "frontend_url" {
  description = "HTTPS URL of the Next.js Static Web App."
  value       = module.static_web_app.default_hostname
}

output "postgresql_fqdn" {
  description = "Fully-qualified domain name of the PostgreSQL server."
  value       = module.postgresql.fqdn
}

output "redis_hostname" {
  description = "Hostname of the Redis Cache instance."
  value       = module.redis.hostname
}

output "key_vault_uri" {
  description = "URI of the Key Vault."
  value       = module.key_vault.vault_uri
}

output "acr_login_server" {
  description = "Login server URL for the Container Registry."
  value       = module.container_registry.login_server
}

output "releases_base_url" {
  description = "Public base URL for agent release binaries."
  value       = module.releases_storage.releases_base_url
}

output "releases_storage_account_name" {
  description = "Name of the Azure Storage Account used for releases."
  value       = module.releases_storage.storage_account_name
}

output "releases_storage_connection_string" {
  description = "Primary connection string for the releases Storage Account (use in GitHub Actions secret)."
  value       = module.releases_storage.primary_connection_string
  sensitive   = true
}

output "static_web_app_api_key" {
  description = "Deployment token for the Static Web App (used in GitHub Actions)."
  value       = module.static_web_app.api_key
  sensitive   = true
}
