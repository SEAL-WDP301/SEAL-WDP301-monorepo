# 🔐 Sealed Secrets Quick Guide

> ⚠️ **Notice**: Execute all commands from the project root directory (`SEAL-WDP301/`).

---

## 🛠️ 1. Install `kubeseal` (One-time setup)

**Windows (PowerShell):**
```powershell
# Download & extract kubeseal.exe
Invoke-WebRequest -Uri "https://github.com/bitnami-labs/sealed-secrets/releases/download/v0.27.3/kubeseal-0.27.3-windows-amd64.tar.gz" -OutFile "$env:TEMP\kubeseal.tar.gz"
tar -xf "$env:TEMP\kubeseal.tar.gz" -C "$env:TEMP"

# Verify success (expected: kubeseal version: 0.27.3)
& "$env:TEMP\kubeseal.exe" --version
```

**Linux/macOS:** `brew install kubeseal`

---

## 🔑 2. Fetch Public Key from Server (If `sealed-secrets-pub.pem` is missing)

```powershell
ssh -i ~/.ssh/id_rsa root@157.230.45.48 "export KUBECONFIG=/etc/rancher/k3s/k3s.yaml && kubeseal --fetch-cert --controller-name=sealed-secrets-controller --controller-namespace=kube-system" > k8s/base/secrets/sealed-secrets-pub.pem
```

---

## 🔄 3. Add / Update Secret Variables & Encrypt

1. Edit your local secret file: `k8s/base/secrets/app-secret.yaml`.
2. Encrypt and overwrite `app-sealed-secret.yaml`:

```powershell
# If kubeseal is in PATH (Linux/macOS):
Get-Content k8s/base/secrets/app-secret.yaml -Raw | kubeseal --format=yaml --cert=k8s/base/secrets/sealed-secrets-pub.pem | Set-Content k8s/base/secrets/app-sealed-secret.yaml

# If using downloaded kubeseal.exe on Windows:
Get-Content k8s/base/secrets/app-secret.yaml -Raw | & "$env:TEMP\kubeseal.exe" --format=yaml --cert=k8s/base/secrets/sealed-secrets-pub.pem | Set-Content k8s/base/secrets/app-sealed-secret.yaml
```

3. Commit & Push to GitHub:
```bash
git add k8s/base/secrets/app-sealed-secret.yaml
git commit -m "chore(secrets): update sealed secrets"
git push origin production
```
