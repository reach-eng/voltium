# GDPR Data Retention & Deletion Strategy

**Date:** 2026-08-04  
**Reference:** PR-124 / DB-S-2

## Overview
Under GDPR / DPDP (Digital Personal Data Protection) frameworks, users have the right to request deletion of their personal data (Right to Erasure). However, financial regulations and tax compliance require financial ledger entries, transactions, and payment history to be retained for minimum statutory audit periods (e.g., 7 years).

## Architecture Decision: Anonymize-in-Place

Voltium enforces **Anonymize-in-Place** as the canonical GDPR erasure strategy.

### Implementation Rules:
1. **Foreign Key Protection (`onDelete: Restrict`)**:
   - `Wallet`, `WalletLedger`, `Transaction`, and `Deposit` records retain `onDelete: Restrict`.
   - Hard deletion of financial entities is strictly prohibited to maintain ledger integrity and reconciliation guarantees.

2. **PII Sanitization on Erasure Request**:
   - When a rider exercises the right to erasure, all PII fields on the `Rider` and `KycProfile` models are overwritten with pseudonymous values (e.g., `fullName = "DELETED_USER"`, `phone = "REDACTED_<uuid>"`, `email = null`, document images deleted from storage).
   - The underlying `id` (UUID) remains linked to transaction and wallet ledger histories for accounting consistency.
