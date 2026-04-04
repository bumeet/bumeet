variable "name"                { type = string }
variable "resource_group_name" { type = string }
variable "location"            { type = string }
variable "sku_name"            { type = string }
variable "node_version" {
  type    = string
  default = "20-lts"
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
