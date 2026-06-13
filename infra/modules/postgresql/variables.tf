variable "name" { type = string }
variable "resource_group_name" { type = string }
variable "location" { type = string }
variable "sku_name" { type = string }
variable "storage_mb" {
  type    = number
  default = 32768
}
variable "pg_version" {
  type    = string
  default = "16"
}
variable "admin_login" { type = string }
variable "admin_password" {
  type      = string
  sensitive = true
}
variable "db_name" {
  type    = string
  default = "bumeet"
}
variable "backup_retention_days" {
  type    = number
  default = 7
}
variable "geo_redundant_backup_enabled" {
  type    = bool
  default = false
}
variable "auto_grow_enabled" {
  type    = bool
  default = true
}
variable "tags" {
  type    = map(string)
  default = {}
}
