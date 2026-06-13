resource "azurerm_key_vault" "this" {
  name                       = var.name
  resource_group_name        = var.resource_group_name
  location                   = var.location
  tenant_id                  = var.tenant_id
  sku_name                   = "standard"
  soft_delete_retention_days = var.soft_delete_retention_days

  # Enabled in prod (driven by var). Cannot be disabled once enabled — that's the
  # point: it prevents permanent deletion of secrets even by an attacker with KV access.
  purge_protection_enabled = var.purge_protection_enabled

  # Access policy for the Terraform service principal (CI). No "Purge" — CI must
  # not be able to permanently destroy soft-deleted secrets.
  access_policy {
    tenant_id = var.tenant_id
    object_id = var.object_id

    secret_permissions = ["Get", "List", "Set", "Delete", "Recover"]
  }

  tags = var.tags
}
