terraform {
  backend "azurerm" {
    resource_group_name  = "rg-bumeet-tfstate"
    storage_account_name = "stbumeetterraform"
    container_name       = "tfstate"
    key                  = "bumeet-dev.terraform.tfstate"
  }
}
