# Secret Rotation Checklist

Rotate all of the following credentials that may have been exposed in the repository or uploaded ZIPs.

## Credentials to Rotate

### Authentication
- [ ] **JWT_SECRET** — Generate new: `openssl rand -base64 32`
- [ ] **Admin passwords** — Change admin user passwords

### SMS / Communications
- [ ] **MSG91_AUTH_KEY** — Rotate via MSG91 dashboard
- [ ] **TWILIO_ACCOUNT_SID / AUTH_TOKEN** — Rotate via Twilio console

### Cloud Storage
- [ ] **GCS service account keys** — Rotate via GCP IAM
- [ ] **Storage bucket credentials** — Review access

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
