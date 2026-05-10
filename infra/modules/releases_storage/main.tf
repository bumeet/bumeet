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
  name                  = "releases"
  storage_account_id    = azurerm_storage_account.this.id
  container_access_type = "blob" # anonymous read for blobs; list still requires auth
}
