terraform {
  required_version = ">= 1.7.0"
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.110"
    }
  }
}

# Storage account that hosts publicly downloadable agent release binaries.
# The 'releases' container has anonymous blob-level read access so installers
# can download without authentication.

resource "azurerm_storage_account" "this" {
  name                     = var.name
  resource_group_name      = var.resource_group_name
  location                 = var.location
  account_tier             = "Standard"
  account_replication_type = "LRS"

  # Allow anonymous public read on containers/blobs that opt in
  allow_nested_items_to_be_public = true

  # Enforce HTTPS — never allow plain-text downloads
  enable_https_traffic_only = true
  min_tls_version           = "TLS1_2"

  blob_properties {
    versioning_enabled = false
  }

  tags = var.tags
}

resource "azurerm_storage_container" "releases" {
  name = "releases"
  # azurerm ~> 3.x uses storage_account_name (storage_account_id is the 4.x form).
  storage_account_name  = azurerm_storage_account.this.name
  container_access_type = "blob" # anonymous read for blobs; list still requires auth
}
