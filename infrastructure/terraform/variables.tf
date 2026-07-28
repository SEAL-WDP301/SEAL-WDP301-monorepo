variable "do_token" {
  description = "DigitalOcean API Token"
  type        = string
  sensitive   = true
}

variable "region" {
  description = "DigitalOcean Data Center Region"
  type        = string
  default     = "sgp1" # Singapore
}

variable "master_size" {
  description = "Droplet size for K3s Control Plane Master"
  type        = string
  default     = "s-1vcpu-2gb" # 1 vCPU, 2GB RAM
}

variable "worker_size" {
  description = "Droplet size for K3s Workers"
  type        = string
  default     = "s-1vcpu-2gb" # 1 vCPU, 2GB RAM
}

variable "worker_count" {
  description = "Number of K3s worker droplets"
  type        = number
  default     = 2
}

variable "ssh_key_name" {
  description = "Name of the SSH key registered in DigitalOcean"
  type        = string
  default     = "seal-devops-key"
}

variable "pvt_key_path" {
  description = "Path to private SSH key for local connection"
  type        = string
  default     = "~/.ssh/id_rsa"
}
