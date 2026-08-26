# Cloudflare Tunnel Configuration

Cloudflare Tunnel provides a secure way to expose our local services (like the staging API and the worker) to the internet without opening any public inbound ports on our firewall.

## Prerequisites
- `cloudflared` installed on your machine.
- A Cloudflare account and a configured domain.

## Setup Instructions

1. **Login to Cloudflare:**
   Run `cloudflared tunnel login` and authenticate.

2. **Create the Tunnel:**
   Run `cloudflared tunnel create voltium-staging`
   Note the Tunnel UUID.

3. **Configure the Tunnel:**
   Copy the `cloudflared-config.example.yml` to `~/.cloudflared/config.yml` (or your OS's equivalent path).
   Update the `tunnel` ID and your specific domain mappings.

4. **Route DNS:**
   Run `cloudflared tunnel route dns voltium-staging api-staging.yourdomain.com`

5. **Run the Tunnel:**
   Run `cloudflared tunnel run voltium-staging`

## Example Config
See `cloudflared-config.example.yml` in the root of the project.
