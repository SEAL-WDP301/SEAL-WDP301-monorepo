output "master_public_ip" {
  value       = digitalocean_droplet.k3s_master.ipv4_address
  description = "Public IP of K3s Master Node"
}

output "floating_ip" {
  value       = digitalocean_floating_ip.k3s_ip.ip_address
  description = "Static Floating IP assigned to Master"
}

output "worker_public_ips" {
  value       = digitalocean_droplet.k3s_workers[*].ipv4_address
  description = "Public IPs of K3s Worker Nodes"
}
