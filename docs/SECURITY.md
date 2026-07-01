# Voltium Security Policy

## Secret Scanning
We run `gitleaks` on every commit (via husky pre-commit hook) and in CI (via GitHub Actions) to prevent secrets from being pushed to the repository.

## Secret Rotation Policy
If a secret is compromised or periodically needs rotation, follow these steps:
1. Generate the new secret (e.g., via AWS KMS, Stripe dashboard, etc.).
2. Update the staging environment variables and test the application to ensure it works.
3. Update the production environment variables during a low-traffic window.
4. Restart the production services.
5. Invalidate or delete the old secret from the provider.
6. Note the rotation in the internal security log.

### PII Encryption Keys
- PII is encrypted at rest using AES-256-GCM.
- Keys are versioned (e.g., `PII_ENCRYPTION_KEY_V1`, `PII_ENCRYPTION_KEY_V2`).
- To rotate: Add the new key as `PII_ENCRYPTION_KEY_V2`, deploy, and it will be used for new encryptions while still supporting decryption with V1.

## Dependency Management
- Dependabot/Renovate is configured to automatically open PRs for vulnerable dependencies.
- Critical vulnerabilities must be patched within 24 hours.

## Data Retention & PII
- PII is encrypted at rest and in transit.
- We maintain a 90-day retention policy after rental completion.
- See `PII_POLICY.md` for details.
