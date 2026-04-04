variable "name"                { type = string }
variable "resource_group_name" { type = string }
variable "location"            { type = string }
variable "sku_name"            { type = string }
variable "storage_mb" {
  type    = number
  default = 32768
}
variable "pg_version" {
  type    = string
  default = "16"
}
variable "admin_login"    { type = string }
variable "admin_password" {
  type      = string
  sensitive = true
}
variable "db_name" {
  type    = string
  default = "bumeet"
}
variable "tags" {
  type    = map(string)
  default = {}
}
