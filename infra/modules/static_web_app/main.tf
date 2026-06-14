terraform {
  required_version = ">= 1.7.0"
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.110"
    }
  }
}

resource "azurerm_static_web_app" "this" {
  name                = var.name
  resource_group_name = var.resource_group_name
  location            = var.location
  sku_tier            = var.sku_tier
  sku_size            = var.sku_size
  tags                = var.tags

  # Runtime app settings (AUTH_SECRET, INTERNAL_AUTH_SECRET, the OAuth client
  # IDs/secrets, NEXT_PUBLIC_API_URL, …) are configured directly on the Static
  # Web App, not declared here. This block is authoritative, so without ignoring
  # it a `terraform apply` would prune every one of those settings and break the
  # web app's auth. Leave them to be managed outside Terraform.
  lifecycle {
    ignore_changes = [app_settings]
  }
}
