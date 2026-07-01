# Voltium PII Policy

## Data Classification
Personally Identifiable Information (PII) at Voltium includes but is not limited to:
- Phone Numbers
- Email Addresses
- Aadhaar Numbers
- PAN Numbers
- Driving License details
- Physical Addresses
- Precise geolocation history

## Storage & Encryption
- All PII fields MUST be encrypted at rest in PostgreSQL.
- Voltium uses AES-256-GCM authenticated encryption for database fields containing PII (see `web/src/lib/pii-crypto.ts`).
- Encryption keys are managed securely and rotated periodically.

## In-Transit Security
- All client-to-server and inter-service communication containing PII MUST use TLS 1.3.

## Data Retention Policy
- We retain active user data to fulfill our services.
- **Post-Rental Retention**: We maintain a strict **90-day retention policy** for PII after a rental is completed or an account is closed, for compliance and auditing purposes.
- Beyond 90 days, data is either permanently deleted or irreversibly anonymized.

## Data Deletion (GDPR/DPDP)
- Riders have the right to request deletion of their data.
- Admins or automated workers can trigger data deletion via the internal API `DELETE /api/riders/:id/data-deletion`.
- The deletion process scrambles PII fields to break identifiability while preserving referential integrity for aggregate business metrics.
