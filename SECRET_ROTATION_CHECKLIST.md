# Secret Rotation Checklist

Rotate all of the following credentials that may have been exposed in the repository or uploaded ZIPs.

## Credentials to Rotate

### Authentication
- [ ] **JWT_SECRET** — Generate new: `openssl rand -base64 32`
- [ ] **Admin passwords** — Change admin user passwords

### Push Notifications (FCM)
- [ ] **FCM_COMMAND_HMAC_SECRET** — Generate new: `openssl rand -base64 48`

  > **When to rotate:** at minimum, after the Phase 0 commit `e3aa927` which
  > exposed the previous value to every dev rider that logged in (the server
  > returned it in every verify-OTP response before Phase 1.1 wired
  > `writeFcmCommandSecret` on the device side). The old secret is in every
  > dev rider's secure storage on the device and cannot be retrieved remotely,
  > but it is no longer trusted.
  >
  > **Rotation steps:**
  > 1. Generate a new value in the deployment env (`web/.env.production`).
  > 2. Restart the workers (the HMAC is computed per-command, no token cache
  >    to invalidate).
  > 3. Existing rider devices will silently drop SECURITY_COMMAND messages
  >    until the user re-logs in (the next verify-OTP response will deliver
  >    the new secret and the device will overwrite its stored copy).
  >
  > **Security note:** the secret is currently global (one value for all
  > riders). A per-rider secret would be more secure but requires schema and
  > token-rotation changes. Tracked as a follow-up; see
  > `docs/REMEDIATION_PLAN.md` Phase 0.1.

### SMS / Communications
- [ ] **MSG91_AUTH_KEY** — Rotate via MSG91 dashboard
- [ ] **TWILIO_ACCOUNT_SID / AUTH_TOKEN** — Rotate via Twilio console

### Database
- [ ] **DATABASE_URL password** — Rotate PostgreSQL password
- [ ] **Redis credentials** — Rotate Upstash tokens

### Payment
- [ ] **Payment gateway API keys** — Rotate via provider dashboard

### Email
- [ ] **SMTP / email service credentials** — Rotate if configured

## Verification

After rotating, verify:
- [ ] Old credentials fail when used
- [ ] All services connect successfully with new credentials
- [ ] `.env` file contains only new credentials
- [ ] No credentials remain in git history
