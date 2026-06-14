variable "name" { type = string }
variable "resource_group_name" { type = string }
variable "location" { type = string }
variable "sku_name" { type = string }
variable "container_registry_server" {
  type        = string
  description = "Login server for the ACR from which Docker images are pulled (e.g. acrbumeetdev.azurecr.io)."
}
variable "docker_image_name" {
  type        = string
  description = "Image name and tag to use as the baseline (e.g. bumeet-api:latest). CI updates the tag on every deploy; Terraform ignores subsequent changes."
  default     = "bumeet-api:latest"
}
variable "always_on" {
  type    = bool
  default = false
}
variable "app_settings" {
  type    = map(string)
  default = {}
}
variable "tags" {
  type    = map(string)
  default = {}
}
