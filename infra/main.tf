# ─────────────────────────────────────────────────────────────────────────────
# Root module — called by each environment (infra/envs/dev, infra/envs/prod)
# ─────────────────────────────────────────────────────────────────────────────

locals {
  prefix = "${var.app_name}-${var.env}"

  common_tags = merge(
    {
      app         = var.app_name
      environment = var.env
      managed_by  = "terraform"
      repo        = "bumeet"
    },
    var.extra_tags,
  )
}

data "azurerm_client_config" "current" {}

# ── Resource Group ────────────────────────────────────────────────────────────

resource "azurerm_resource_group" "main" {
  name     = "rg-${var.app_name}-${var.env}"
  location = var.location
  tags     = local.common_tags
}

# ── Key Vault (provisioned first; other modules reference its id) ─────────────

module "key_vault" {
  source = "./modules/key_vault"

  name                = "kv-${local.prefix}"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  tenant_id           = data.azurerm_client_config.current.tenant_id
  object_id           = data.azurerm_client_config.current.object_id

  soft_delete_retention_days = var.key_vault_soft_delete_retention_days
  purge_protection_enabled   = var.env == "prod"
  tags                       = local.common_tags
}

# ── PostgreSQL ────────────────────────────────────────────────────────────────

module "postgresql" {
  source = "./modules/postgresql"

  name                = "psql-${local.prefix}"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location

  sku_name       = var.pg_sku_name
  storage_mb     = var.pg_storage_mb
  pg_version     = var.pg_version
  admin_login    = var.pg_admin_login
  admin_password = var.pg_admin_password
  db_name        = var.pg_db_name

  backup_retention_days        = var.pg_backup_retention_days
  geo_redundant_backup_enabled = var.pg_geo_redundant_backup_enabled

  tags = local.common_tags
}

# ── Redis ─────────────────────────────────────────────────────────────────────

module "redis" {
  source = "./modules/redis"

  name                = "redis-${local.prefix}"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location

  sku_name = var.redis_sku_name
  family   = var.redis_family
  capacity = var.redis_capacity

  tags = local.common_tags
}

# ── Releases Storage (public blob for agent installers) ───────────────────────
# One shared storage account across environments; releases are prod artefacts.

module "releases_storage" {
  source = "./modules/releases_storage"

  # stbumeetreleases — 16 chars, globally unique, alphanumeric only
  name                = "stbumeetreleases"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  tags                = local.common_tags
}

# ── Container Registry ────────────────────────────────────────────────────────

module "container_registry" {
  source = "./modules/container_registry"

  name                = "acr${replace(local.prefix, "-", "")}"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location

  sku  = var.acr_sku
  tags = local.common_tags
}

# ── Static Web App (Next.js frontend) ────────────────────────────────────────

module "static_web_app" {
  source = "./modules/static_web_app"

  name                = "swa-${local.prefix}"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location

  sku_tier = var.env == "prod" ? "Standard" : "Free"
  sku_size = var.env == "prod" ? "Standard" : "Free"

  tags = local.common_tags
}

# ── App Service (NestJS API) ──────────────────────────────────────────────────

module "app_service" {
  source = "./modules/app_service"

  name                = "app-${local.prefix}-api"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location

  sku_name                  = var.api_sku_name
  always_on                 = var.api_always_on
  container_registry_server = module.container_registry.login_server

  app_settings = {
    # Key Vault references — App Service resolves these at runtime via managed identity
    DATABASE_URL = "@Microsoft.KeyVault(SecretUri=${module.key_vault.vault_uri}secrets/DATABASE-URL/)"
    REDIS_URL    = "@Microsoft.KeyVault(SecretUri=${module.key_vault.vault_uri}secrets/REDIS-URL/)"
    FRONTEND_URL = module.static_web_app.default_hostname
    NODE_ENV     = var.env == "prod" ? "production" : "development"
    PORT         = "8080"

    APPLICATIONINSIGHTS_CONNECTION_STRING = azurerm_application_insights.main.connection_string
  }

  tags = local.common_tags

  depends_on = [module.key_vault]
}

# Grant the App Service managed identity AcrPull on the registry so it can
# pull Docker images without stored credentials.
resource "azurerm_role_assignment" "app_service_acr_pull" {
  scope                = module.container_registry.id
  role_definition_name = "AcrPull"
  principal_id         = module.app_service.principal_id

  depends_on = [module.container_registry, module.app_service]
}

# ── Observability: Log Analytics + Application Insights + alerting ────────────

resource "azurerm_log_analytics_workspace" "main" {
  name                = "log-${local.prefix}"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  sku                 = "PerGB2018"
  retention_in_days   = 30
  tags                = local.common_tags
}

resource "azurerm_application_insights" "main" {
  name                = "appi-${local.prefix}"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  workspace_id        = azurerm_log_analytics_workspace.main.id
  application_type    = "Node.JS"
  tags                = local.common_tags
}

resource "azurerm_monitor_action_group" "main" {
  name                = "ag-${local.prefix}"
  resource_group_name = azurerm_resource_group.main.name
  short_name          = "bumeet"

  email_receiver {
    name          = "team"
    email_address = var.alert_email
  }

  tags = local.common_tags
}

# Alert when the API starts returning 5xx errors.
resource "azurerm_monitor_metric_alert" "api_5xx" {
  name                = "alert-${local.prefix}-api-5xx"
  resource_group_name = azurerm_resource_group.main.name
  scopes              = [module.app_service.id]
  description         = "API is returning HTTP 5xx errors"
  severity            = 2
  frequency           = "PT5M"
  window_size         = "PT15M"

  criteria {
    metric_namespace = "Microsoft.Web/sites"
    metric_name      = "Http5xx"
    aggregation      = "Total"
    operator         = "GreaterThan"
    threshold        = 10
  }

  action {
    action_group_id = azurerm_monitor_action_group.main.id
  }

  tags = local.common_tags
}

# ── Key Vault Secrets ─────────────────────────────────────────────────────────

resource "azurerm_key_vault_secret" "database_url" {
  name         = "DATABASE-URL"
  key_vault_id = module.key_vault.id
  value        = "postgresql://${var.pg_admin_login}:${var.pg_admin_password}@${module.postgresql.fqdn}:5432/${var.pg_db_name}?sslmode=require"
  tags         = local.common_tags

  depends_on = [module.key_vault, module.postgresql]
}

resource "azurerm_key_vault_secret" "redis_url" {
  name         = "REDIS-URL"
  key_vault_id = module.key_vault.id
  value        = "rediss://:${module.redis.primary_access_key}@${module.redis.hostname}:6380"
  tags         = local.common_tags

  depends_on = [module.key_vault, module.redis]
}

# ── Grant App Service managed identity read access to Key Vault ───────────────

resource "azurerm_key_vault_access_policy" "app_service" {
  key_vault_id = module.key_vault.id
  tenant_id    = data.azurerm_client_config.current.tenant_id
  object_id    = module.app_service.principal_id

  secret_permissions = ["Get", "List"]

  depends_on = [module.key_vault, module.app_service]
}
