resource "azurerm_postgresql_flexible_server" "this" {
  name                   = var.name
  resource_group_name    = var.resource_group_name
  location               = var.location
  version                = var.pg_version
  administrator_login    = var.admin_login
  administrator_password = var.admin_password
  sku_name               = var.sku_name
  storage_mb             = var.storage_mb

  geo_redundant_backup_enabled = false
  backup_retention_days        = 7

  tags = var.tags
}

resource "azurerm_postgresql_flexible_server_database" "app" {
  name      = var.db_name
  server_id = azurerm_postgresql_flexible_server.this.id
  collation = "en_US.utf8"
  charset   = "utf8"
}

# Allow Azure-internal services to reach PostgreSQL.
# 0.0.0.0/0.0.0.0 is the Azure-special CIDR meaning "Azure datacenters only".
resource "azurerm_postgresql_flexible_server_firewall_rule" "azure_services" {
  name             = "allow-azure-services"
  server_id        = azurerm_postgresql_flexible_server.this.id
  start_ip_address = "0.0.0.0"
  end_ip_address   = "0.0.0.0"
}
