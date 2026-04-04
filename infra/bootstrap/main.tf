# ─────────────────────────────────────────────────────────────────────────────
# Bootstrap — run ONCE manually before any environment is deployed.
#
#   az login
#   cd infra/bootstrap
#   terraform init
#   terraform apply
#
# Creates the Storage Account that holds Terraform remote state.
# Uses local state intentionally (no backend block).
# ─────────────────────────────────────────────────────────────────────────────

terraform {
  required_version = ">= 1.7.0"
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.110"
    }
  }
}

provider "azurerm" {
  features {}
}

variable "location" {
  type    = string
  default = "westeurope"
}

resource "azurerm_resource_group" "tfstate" {
  name     = "rg-bumeet-tfstate"
  location = var.location

  tags = {
    app        = "bumeet"
    managed_by = "terraform-bootstrap"
    purpose    = "remote-state"
  }
}

resource "azurerm_storage_account" "tfstate" {
  # Must be globally unique, 3-24 chars, lowercase alphanumeric only.
  # Change suffix if this name is already taken.
  name                     = "stbumeetterraform"
  resource_group_name      = azurerm_resource_group.tfstate.name
  location                 = azurerm_resource_group.tfstate.location
  account_tier             = "Standard"
  account_replication_type = "LRS"

  blob_properties {
    versioning_enabled = true
    delete_retention_policy {
      days = 30
    }
  }

  tags = azurerm_resource_group.tfstate.tags
}

resource "azurerm_storage_container" "tfstate" {
  name                  = "tfstate"
  storage_account_name  = azurerm_storage_account.tfstate.name
  container_access_type = "private"
}
