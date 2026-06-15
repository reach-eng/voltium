# Voltium — Cloudflare Tunnel Setup

> Expose your local Voltium dev server to the internet securely without opening firewall ports or using Docker.
> Cloudflare Tunnel creates an encrypted tunnel from Cloudflare's edge to your local machine.

---

## Why Cloudflare Tunnel?

| Need                     | Cloudflare Tunnel Solution                    |
|--------------------------|-----------------------------------------------|
| Expose localhost online  | Single `cloudflared tunnel` command           |
| No open firewall ports   | Outbound-only connection to Cloudflare edge   |
| Free SSL/TLS             | Automatic HTTPS certificates                  |
| No Docker required       | Native binary or npm package                  |
| Subdomain management     | Route `dev.voltium.app` to `localhost:8081`   |

---

## 1. Install cloudflared

### Windows (PowerShell as Administrator)

```powershell
# Download the Windows binary
curl -o cloudflared.exe https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe

# Move to a directory in your PATH
move cloudflared.exe C:\Windows\System32\

# Verify
cloudflared --version
```

### macOS (Homebrew)

```bash
brew install cloudflared
```

### Linux

```bash
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /usr/local/bin/cloudflared
chmod +x /usr/local/bin/cloudflared
```

### Alternative: npm (cross-platform)

```bash
npm install -g cloudflared
```

---

## 2. Authenticate with Cloudflare

```bash
cloudflared tunnel login
```

This opens a browser window. Log in to your Cloudflare account and select the domain you want to use (e.g., `voltium.app`).

A certificate file (`cert.pem`) is saved to `~/.cloudflared/`.

---

## 3. Create a Tunnel

```bash
# Create a named tunnel (one-time setup)
cloudflared tunnel create voltium-dev

# Output: Created tunnel with ID <tunnel-id>
# Credentials saved to ~/.cloudflared/<tunnel-id>.json
```

---

## 4. Configure the Tunnel

Create `~/.cloudflared/config.yml`:

```yaml
# ~/.cloudflared/config.yml
tunnel: <tunnel-id>
credentials-file: C:\Users\<you>\.cloudflared\<tunnel-id>.json

ingress:
  # Route to Voltium web app (Next.js on port 8081)
  - hostname: dev.voltium.app
    service: http://localhost:8081
  # Catch-all: return 404 for unknown hosts
  - service: http_status:404
```

> **Windows path note:** Use forward slashes or double backslashes in the credentials-file path.

---

## 5. Configure DNS

```bash
# Route your subdomain through the tunnel
cloudflared tunnel route dns voltium-dev dev.voltium.app
```

This creates a `CNAME` record: `dev.voltium.app` → `<tunnel-id>.cfargotunnel.com`.

---

## 6. Start the Tunnel

```bash
# Run as a foreground process
cloudflared tunnel run voltium-dev

# Or run as a service (background)
cloudflared tunnel install voltium-dev
cloudflared service install
```

### Windows Service

```powershell
# Install as Windows service (Admin PowerShell)
cloudflared service install

# Start the service
Start-Service cloudflared

# Check status
Get-Service cloudflared
```

---

## 7. Verify

```bash
# Test the tunnel is working
curl https://dev.voltium.app/api/health

# Or open in browser
start https://dev.voltium.app
```

---

## 8. Running with PM2 (Recommended)

Integrate with PM2 for automatic tunnel management:

```bash
# Add to PM2
pm2 start $(which cloudflared) --name voltium-tunnel -- tunnel run voltium-dev

# Save PM2 config
pm2 save
```

Or add to `ecosystem.config.cjs`:

```javascript
{
  name: 'voltium-tunnel',
  script: 'cloudflared',
  args: 'tunnel run voltium-dev',
  restart_delay: 5000,
  max_restarts: 10,
}
```

---

## 9. Common Operations

```bash
# List all tunnels
cloudflared tunnel list

# Delete a tunnel
cloudflared tunnel delete voltium-dev

# Clean up DNS
cloudflared tunnel route dns remove dev.voltium.app

# Check tunnel status
cloudflared tunnel info voltium-dev
```

---

## 10. Troubleshooting

| Problem                          | Solution                                          |
|----------------------------------|---------------------------------------------------|
| `cloudflared` not found          | Ensure it's in your PATH or use full path         |
| Tunnel not connecting            | Check internet connectivity and firewall outbound |
| DNS not resolving                | Wait 1-5 minutes for DNS propagation              |
| HTTP 502 / 503 errors            | Ensure `voltium-web` PM2 process is running       |
| Certificate expired              | Run `cloudflared tunnel login` again              |
| Port conflict on Windows         | Use `netstat -ano | findstr :8081` to check       |
| Service won't start on Windows   | Run PowerShell as Administrator                   |
