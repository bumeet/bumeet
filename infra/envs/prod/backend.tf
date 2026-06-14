terraform {
  required_version = ">= 1.7.0"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.110"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  backend "azurerm" {
    resource_group_name  = "rg-bumeet-tfstate"
    storage_account_name = "stbumeetterraform"
    container_name       = "tfstate"
    key                  = "bumeet-prod.terraform.tfstate"
  }
}
