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

    application_stack {
      node_version = var.node_version
    }

    health_check_path = "/api/v1/health"
  }

  app_settings = merge(
    {
      WEBSITES_PORT                  = "8080"
      SCM_DO_BUILD_DURING_DEPLOYMENT = "true"
      WEBSITE_NODE_DEFAULT_VERSION   = "~20"
    },
    var.app_settings,
  )

  tags = var.tags
}
