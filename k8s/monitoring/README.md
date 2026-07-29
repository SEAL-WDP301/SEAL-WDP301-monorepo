# 📊 Monitoring Stack & Secrets Guide

This directory manages **Prometheus & Grafana Observability** and its **Sealed Secrets**.

> ⚠️ **Notice**: Execute all commands from the project root directory (`SEAL-WDP301/`).

---

## 📁 File Structure & Purpose

| File | Purpose | Committed to Git? |
|------|---------|-------------------|
| `values-prometheus.yaml` | Helm configuration for Prometheus & Grafana | ✅ YES |
| `monitoring-sealed-secret.yaml` | Encrypted Secret for Grafana Admin & Gmail SMTP | ✅ YES |
| `monitoring-secret.yaml.example` | Template file showing credential keys | ✅ YES |
| `monitoring-secret.yaml` | Plaintext secrets at local (Grafana & Gmail) | ❌ NO (`.gitignore`) |

---

## 🔄 How to Add / Update Monitoring Secrets

1. Copy `monitoring-secret.yaml.example` to `monitoring-secret.yaml` if not present.
2. Edit your local credentials in `k8s/monitoring/monitoring-secret.yaml`.
3. Run `kubeseal` (or Docker) to generate `monitoring-sealed-secret.yaml`:

### Option A: Using Local CLI (PowerShell)
```powershell
Get-Content k8s/monitoring/monitoring-secret.yaml -Raw | kubeseal --format=yaml --cert=k8s/base/secrets/sealed-secrets-pub.pem | Set-Content k8s/monitoring/monitoring-sealed-secret.yaml
```

### Option B: Using Docker (No CLI Installation Needed)
```powershell
docker run --rm -v "${PWD}/k8s/monitoring:/monitoring" -v "${PWD}/k8s/base/secrets:/secrets" bitnami/kubeseal:v0.27.3 --format=yaml --cert=/secrets/sealed-secrets-pub.pem < k8s/monitoring/monitoring-secret.yaml > k8s/monitoring/monitoring-sealed-secret.yaml
```

4. Commit & Push changes to GitHub:

