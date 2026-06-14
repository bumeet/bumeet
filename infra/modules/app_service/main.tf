terraform {
  required_version = ">= 1.7.0"
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.110"
    }
  }
}

resource "azurerm_service_plan" "this" {
  name                = "${var.name}-plan"
  resource_group_name = var.resource_group_name
  location            = var.location
  os_type             = "Linux"
  sku_name            = var.sku_name
  tags                = var.tags
}

resource "azurerm_linux_web_app" "this" {
  name                = var.name
  resource_group_name = var.resource_group_name
  location            = var.location
  service_plan_id     = azurerm_service_plan.this.id

  https_only = true

  identity {
    type = "SystemAssigned"
  }

  site_config {
    always_on     = var.always_on
    http2_enabled = true

    # Use managed identity to pull from ACR — no stored credentials needed.
    container_registry_use_managed_identity = true

    application_stack {
      docker_image_name   = "${var.container_registry_server}/${var.docker_image_name}"
      docker_registry_url = "https://${var.container_registry_server}"
    }

    health_check_path = "/api/v1/health"
  }

  app_settings = merge(
    {
      WEBSITES_PORT = "8080"
    },
    var.app_settings,
  )

  tags = var.tags

  # The CI pipeline (azure/webapps-deploy) updates docker_image_name on every
  # release. Ignore it here so `terraform apply` doesn't revert to the
  # baseline tag and take down the API.
  #
  # app_settings is also ignored: runtime secrets the API needs (JWT_SECRET,
  # INTERNAL_AUTH_SECRET, the OAuth client IDs/secrets, ENCRYPTION_KEY, …) are
  # managed directly on the App Service, not all mirrored in `var.app_settings`.
  # Without this, `terraform apply` would prune those keys and break auth
  # (e.g. social login 401s once INTERNAL_AUTH_SECRET is wiped).
  lifecycle {
    ignore_changes = [
      site_config[0].application_stack[0].docker_image_name,
      app_settings,
    ]
  }
}
