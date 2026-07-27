# Infrastructure as Code (IaC) - Terraform & Ansible

Thư mục này chứa toàn bộ mã nguồn tự động hóa hạ tầng cho dự án **SEAL-WDP301** trên DigitalOcean.

---

## 🛠️ 1. Khởi Tạo Hạ Tầng Với Terraform (`infrastructure/terraform/`)

### 📋 Yêu cầu:
- Đã cài đặt [Terraform CLI](https://developer.hashicorp.com/terraform/downloads).
- Có tài khoản DigitalOcean và đã tạo **Personal Access Token** (Read/Write).
- Đã thêm **SSH Key** của bạn lên DigitalOcean Settings.

### 🚀 Các bước thực hiện:

```bash
cd infrastructure/terraform

# 1. Copy file cấu hình mẫu
cp terraform.tfvars.example terraform.tfvars

# 2. Điền API Token và tên SSH Key của bạn vào file terraform.tfvars:
# do_token = "dop_v1_xxx..."
# ssh_key_name = "your-ssh-key-name"

# 3. Khởi tạo và kiểm tra kế hoạch
terraform init
terraform plan

# 4. Tạo hạ tầng thật trên DigitalOcean (Master + 2 Workers + Firewall + Floating IP)
terraform apply
```

Sau khi chạy thành công, Terraform sẽ xuất ra địa chỉ IP của Master Node và 2 Worker Nodes.

---

## 🤖 2. Cấu Hình Hệ Thống Với Ansible (`infrastructure/ansible/`)

### 📋 Yêu cầu:
- Đã cài đặt `ansible` (`pip install ansible` hoặc `sudo apt install ansible`).

### 🚀 Các bước thực hiện:

```bash
cd infrastructure/ansible

# 1. Copy file inventory mẫu
cp inventory.ini.example inventory.ini

# 2. Điền địa chỉ IP của Master và 2 Workers (nhận được từ Terraform) vào file inventory.ini

# 3. Chạy Playbook tự động cài đặt K3s Cluster + Helm + NGINX Ingress Controller:
ansible-playbook playbook.yml
```

Sau khi Playbook chạy xong, cụm **K3s Cluster (Master + 2 Workers)** cùng **NGINX Ingress Controller** đã sẵn sàng 100% để tiếp nhận K8s Manifests từ **Argo CD**!
