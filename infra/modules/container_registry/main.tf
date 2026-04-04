resource "azurerm_container_registry" "this" {
  name                = var.name
  resource_group_name = var.resource_group_name
  location            = var.location
  sku                 = var.sku

  # Admin account disabled — use managed identity or service principal instead
  admin_enabled = false

  tags = var.tags
}
