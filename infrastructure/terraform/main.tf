# Get SSH Key registered in DigitalOcean
data "digitalocean_ssh_key" "main" {
  name = var.ssh_key_name
}

# ==========================================
# K3s Control Plane Master Droplet
# ==========================================
resource "digitalocean_droplet" "k3s_master" {
  image              = "ubuntu-24-04-x64"
  name               = "seal-k3s-master"
  region             = var.region
  size               = var.master_size
  ssh_keys           = [data.digitalocean_ssh_key.main.id]
  tags               = ["k3s", "control-plane", "seal-wdp301"]
  graceful_shutdown  = true
}

# ==========================================
# K3s Worker Nodes Droplets
# ==========================================
resource "digitalocean_droplet" "k3s_workers" {
  count              = var.worker_count
  image              = "ubuntu-24-04-x64"
  name               = "seal-k3s-worker-${count.index + 1}"
  region             = var.region
  size               = var.worker_size
  ssh_keys           = [data.digitalocean_ssh_key.main.id]
  tags               = ["k3s", "worker", "seal-wdp301"]
  graceful_shutdown  = true
}

# ==========================================
# Floating IP (Static IP) for Master
# ==========================================
resource "digitalocean_floating_ip" "k3s_ip" {
  droplet_id = digitalocean_droplet.k3s_master.id
  region     = var.region
}

# ==========================================
# DigitalOcean Cloud Firewall
# ==========================================
resource "digitalocean_firewall" "k3s_firewall" {
  name = "seal-k3s-cluster-firewall"

  droplet_ids = concat([digitalocean_droplet.k3s_master.id], digitalocean_droplet.k3s_workers[*].id)

  # HTTP Traffic
  inbound_rule {
    protocol         = "tcp"
    port_range       = "80"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }

  # HTTPS Traffic
  inbound_rule {
    protocol         = "tcp"
    port_range       = "443"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }

  # SSH Access
  inbound_rule {
    protocol         = "tcp"
    port_range       = "22"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }

  # K3s Kubernetes API (6443)
  inbound_rule {
    protocol         = "tcp"
    port_range       = "6443"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }

  # Allow full internal communication between nodes
  inbound_rule {
    protocol         = "tcp"
    port_range       = "1-65535"
    source_addresses = concat([digitalocean_droplet.k3s_master.ipv4_address], digitalocean_droplet.k3s_workers[*].ipv4_address)
  }

  inbound_rule {
    protocol         = "udp"
    port_range       = "1-65535"
    source_addresses = concat([digitalocean_droplet.k3s_master.ipv4_address], digitalocean_droplet.k3s_workers[*].ipv4_address)
  }

  # Outbound Rules (Allow all outgoing traffic)
  outbound_rule {
    protocol              = "tcp"
    port_range            = "1-65535"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }

  outbound_rule {
    protocol              = "udp"
    port_range            = "1-65535"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }

  outbound_rule {
    protocol              = "icmp"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }
}
