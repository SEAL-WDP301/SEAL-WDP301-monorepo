# 🔐 Sealed Secrets Quick Guide

> ⚠️ **Notice**: Execute all commands from the project root directory (`SEAL-WDP301/`).

---

## 🛠️ 1. Install `kubeseal` (Optional)

- **Windows**: `winget install Bitnami.kubeseal`
- **Linux**: Download v0.27.3 binary to `/usr/local/bin/kubeseal`
- **macOS**: `brew install kubeseal`
- **Or use Docker** (see Step 3, no local installation needed).

---

## 🔑 2. Fetch Public Key from Server (If needed)

```powershell
ssh -i ~/.ssh/id_rsa root@157.230.45.48 "export KUBECONFIG=/etc/rancher/k3s/k3s.yaml && kubeseal --fetch-cert --controller-name=sealed-secrets-controller --controller-namespace=kube-system" > k8s/base/secrets/sealed-secrets-pub.pem
```

---

## 🔄 3. Add / Update Secret Variables & Encrypt

1. Edit your local secret file: `k8s/base/secrets/app-secret.yaml`.
2. Encrypt and overwrite `app-sealed-secret.yaml`:

### Option A: Using CLI (`kubeseal` on PowerShell)
```powershell
Get-Content k8s/base/secrets/app-secret.yaml -Raw | kubeseal --format=yaml --cert=k8s/base/secrets/sealed-secrets-pub.pem | Set-Content k8s/base/secrets/app-sealed-secret.yaml
```

### Option B: Using Docker (No local CLI installation required)
```powershell
docker run --rm -v "${PWD}/k8s/base/secrets:/secrets" bitnami/kubeseal:v0.27.3 --format=yaml --cert=/secrets/sealed-secrets-pub.pem < k8s/base/secrets/app-secret.yaml > k8s/base/secrets/app-sealed-secret.yaml
```

3. Commit & Push to GitHub:
```bash
git add k8s/base/secrets/sealed-secrets-pub.pem k8s/base/secrets/app-sealed-secret.yaml
git commit -m "chore(secrets): update sealed secrets"
git push origin production
```
