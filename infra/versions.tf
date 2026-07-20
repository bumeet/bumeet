terraform {
  required_version = ">= 1.7.0"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.81"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
}

provider "azurerm" {
  features {
    key_vault {
      purge_soft_delete_on_destroy    = false
      recover_soft_deleted_key_vaults = true
      # The vault has purge protection and the CI service principal has no
      # purge permission ("ForbiddenByPolicy"), so destroying a secret must
      # stop at soft-delete instead of attempting a purge that always 403s.
      purge_soft_deleted_secrets_on_destroy = false
      recover_soft_deleted_secrets          = true
    }
    resource_group {
      prevent_deletion_if_contains_resources = true
    }
  }
}
