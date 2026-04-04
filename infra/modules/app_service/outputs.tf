output "id"               { value = azurerm_linux_web_app.this.id }
output "default_hostname" { value = azurerm_linux_web_app.this.default_hostname }
output "principal_id"     { value = azurerm_linux_web_app.this.identity[0].principal_id }
output "plan_id"          { value = azurerm_service_plan.this.id }
