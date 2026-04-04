variable "name"                { type = string }
variable "resource_group_name" { type = string }
variable "location"            { type = string }
variable "sku_tier" {
  type    = string
  default = "Free"
}
variable "sku_size" {
  type    = string
  default = "Free"
}
variable "tags" {
  type    = map(string)
  default = {}
}
