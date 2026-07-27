# Infrastructure as Code (IaC) - Terraform & Ansible

This directory contains the full infrastructure automation codebase for the **SEAL-WDP301** project on DigitalOcean.

---

## 🛠️ 1. Infrastructure Provisioning with Terraform (`infrastructure/terraform/`)

### 📋 Prerequisites:
- Installed [Terraform CLI](https://developer.hashicorp.com/terraform/downloads).
- Active DigitalOcean account with a **Personal Access Token** (Read/Write scope).
- Public **SSH Key** added to your DigitalOcean Account Settings.

### 🚀 Quick Start:

```bash
cd infrastructure/terraform

# 1. Copy the configuration template file
cp terraform.tfvars.example terraform.tfvars

# 2. Fill in your API Token and SSH Key Name in terraform.tfvars:
# do_token     = "dop_v1_xxx..."
# ssh_key_name = "your-ssh-key-name"

# 3. Initialize and inspect the execution plan
terraform init
terraform plan

# 4. Provision infrastructure on DigitalOcean (Master + 2 Workers + Firewall + Floating IP)
terraform apply
```

Upon successful execution, Terraform will output the Public IP addresses of the Master Node and the 2 Worker Nodes.

---

## 🤖 2. System Configuration & Provisioning with Ansible (`infrastructure/ansible/`)

### 📋 Prerequisites:
- Installed `ansible` (`pip install ansible` or `sudo apt install ansible`).

### 🚀 Quick Start:

```bash
cd infrastructure/ansible

# 1. Copy the inventory template file
cp inventory.ini.example inventory.ini

# 2. Update inventory.ini with the IP addresses of Master and 2 Workers (from Terraform output)

# 3. Execute the Playbook to auto-install K3s Cluster + Helm + NGINX Ingress Controller:
ansible-playbook playbook.yml
```

Once the Playbook completes, your **K3s Cluster (1 Master + 2 Workers)** along with **NGINX Ingress Controller** is 100% ready to receive Kubernetes Manifests via **Argo CD**!
