# Personal Data Retention Policy

This document is the canonical record of **how long** Voltium
retains personal data of Data Principals (riders, guarantors,
team leaders) and **what mechanism** destroys it when the
retention window closes. It is the operational reference for
DPDP Act §8(4) (storage limitation), GDPR Art. 5(1)(e), and the
monthly security review (`docs/SECURITY_PLAN.md` §Monthly review).

The policy is enforced in three layers:

1. **Prisma schema**: the `User*` data tables carry
   `createdAt` / `timestamp` columns that the cleanup workers
   use as the retention-cutoff key.
2. **Worker jobs**: cron-driven workers sweep the tables
   daily with an IST-date idempotency key (fire-once-per-day).
3. **Audit log**: every sweep writes an `AuditLog` row inside the
   same transaction as the deletes, so the GDPR Art. 30 record
   of processing is atomically consistent with the destruction
   (PR-154).

The mechanism is the same for all device-data tables below —
**the worker is the source of truth, not the schema**. There is
no `expiresAt` column on these tables because the worker
treats any row older than the retention window as eligible for
deletion, regardless of when the row was last updated.

---

## 1. Retention table

| Table | Data class | Retention | Cutoff column | Worker | Job run-time |
| ----- | ---------- | --------- | ------------- | ------ | ------------ |
| `UserLocation` | Geo-location pings (lat / lng / accuracy) | **30 days** | `timestamp` | `telemetryCleanupJob` | daily, IST-date idempotent |
| `UserCallLog` | Call history (number, type, duration) | **30 days** | `timestamp` | `telemetryCleanupJob` | daily, IST-date idempotent |
| `UserContact` | Synced contact list (name, phone, email) | **30 days** | `createdAt` | `telemetryCleanupJob` | daily, IST-date idempotent |
| `DeviceViolation` (resolved) | Device compliance tracking | **30 days** post-resolution | `resolvedAt` | `deviceComplianceJob` | daily |
| `AuditLog` | Admin / system action log | **30–365 days** by action type (see `web/src/lib/audit-log.ts:4-10` `RETENTION_PERIODS`) | `expiresAt` | `auditCleanupJob` | daily, IST-date idempotent |
| `Rider` (soft-deleted) | PII on closed accounts | **7 days** post soft-delete, then hard-anonymized | `deletedAt` | `dataDeletionPurgeJob` | daily, IST-date idempotent |
| `Notification` (read) | In-app notifications already seen | **30 days** | `createdAt` | `notificationsCleanupJob` | daily, IST-date idempotent |
| `OutboxEvent` (completed) | Event bus history | **24h** post-completion | `processedAt` | `OutboxService.cleanupCompleted(1)` (3:00 IST) | daily, 03:00 IST |
| `Backup` (pre-restore) | Pre-restore backups orphaned by failed restores | **7 days** post-restore-failure | `createdAt` | `orphanBackupCleanupJob` | daily, IST-date idempotent |

For each row, the policy is: **the row must be destroyed by
`now - retention`** unless a documented exception applies
(see §3).

### 1.1 Why 30 days for device data?

- Long enough to surface fraud detection queries ("did this rider
  go through this hub in the last 4 weeks?").
- Short enough to keep the PII exposure window inside the
  DPDP §8(4) "necessary for the purpose" envelope — the purpose
  is operational, not historical, and 30 days comfortably covers
  the longest practical operational query.
- Aligns with the rider's right to expect recent, not stale,
  data; a rider who deleted their account a year ago should not
  still have location pings in the table.

If a regulator or auditor asks for a different window, the
constants live in the worker file (`thirtyDaysAgo` at
`web/src/server/workers/jobs/telemetry-cleanup.job.ts:30`) and
are easy to change. Any change to the policy must:

1. Be reviewed by legal + the security lead.
2. Be recorded as a follow-up ticket in `docs/FOLLOWUP_TICKETS.md`.
3. Trigger a one-time backfill migration if existing rows are
   past the new window.

---

## 2. The 3 cleanup workers

### 2.1 `telemetryCleanupJob` — device data

`web/src/server/workers/jobs/telemetry-cleanup.job.ts` (PR-154).
Runs daily (IST-date idempotency key, 48h TTL). On each run:

1. Compute `cutoff = now - 30 days`.
2. **Count** the rows in each table that are older than the
   cutoff (so the audit log can record the count destroyed —
   GDPR Art. 30).
3. Inside a single Prisma `$transaction`:
   a. Write the `AuditLog` row with `action: 'telemetry.cleanup'`
      and the cutoff + counts.
   b. `deleteMany` on `UserLocation`, `UserCallLog`,
      `UserContact`.
4. Mark the idempotency key as completed.

The atomic-transaction guarantee is the heart of the policy:
**the audit row and the deletes are committed together**. If
the transaction rolls back (e.g. DB write fails), neither the
audit row nor the deletes land — so the audit log never claims
a destruction that did not happen.

### 2.2 `auditCleanupJob` — audit logs

`web/src/server/workers/jobs/audit-cleanup.job.ts`. Runs daily
(IST-date idempotency key, 48h TTL). The retention varies by
action type — see `web/src/lib/audit-log.ts:4-10`:

| Action prefix | Retention |
| ------------- | --------- |
| `auth.*`      | 90 days   |
| `kyc.*`       | 365 days  |
| `rider_update.*` | 180 days |
| `bulk_action.*` | 365 days  |
| `system.*`    | 30 days   |
| (other)       | 90 days (default) |

The `createAuditLog` helper (now post-CMP-004) sets
`expiresAt` to `now + retentionDays` on insert. The cleanup
worker just does `db.auditLog.deleteMany({ where: { expiresAt: { lt: now } } })`.

### 2.3 `dataDeletionPurgeJob` — hard-delete soft-deleted riders

`web/src/server/workers/jobs/data-deletion-purge.job.ts` (PR-7).
Runs daily (IST-date idempotency key, 48h TTL). On each run:

1. Compute `cutoff = now - 7 days`.
2. Find riders with `lifecycleStatus: 'CLOSED'`,
   `deletedAt: { not: null, lt: cutoff }`, `purgedAt: null`.
3. For each, in a transaction:
   a. `Rider.update` — NULL every PII field; sentinel-replace
      `phone` / `referralCode` (non-nullable @unique columns);
      set `purgedAt = now`, `fullName = '[PURGED]'`.
   b. `KycProfile.updateMany` — NULL all PII fields.
   c. `Guarantor.updateMany` — NULL all PII fields.
   d. Write the `RIDER_DATA_DELETION_PURGED` AuditLog row with
      the list of fields destroyed (GDPR Art. 30 record).
4. Mark the idempotency key as completed.

The sentinel pattern (e.g. `phone: 'PURGED-abc123def456'`)
preserves the `@unique` constraint and keeps financial FK
chains (transactions, wallet, leases) referentially intact while
destroying the rider's identity.

---

## 3. Documented exceptions (rows NOT auto-deleted)

| Exception | Scope | Reason |
| --------- | ----- | ------ |
| **Active rental** | Rider data while `rentalLease.status = 'ACTIVE'` | Operational need: the rental must resolve (end-rental, damage assessment) before the rider's PII is destroyed. The `dataDeletionPurgeJob` only touches riders with `lifecycleStatus: 'CLOSED'`, so this is enforced by the where-clause, not a special case. |
| **Open support ticket** | Rider data while a `SupportTicket.status` is `OPEN` / `IN_PROGRESS` | The ticket references the rider via FK; the agent needs the rider context until the ticket is resolved. |
| **Pending KYC decision** | KycProfile while `status: 'PENDING' / 'SUBMITTED'` | The decision is a legal-record artifact; the Aadhaar / PAN cannot be NULLed until the decision is made. |
| **Litigation hold** | Rider data while a legal hold flag is set | Out of scope for this doc. The hold is set via `Rider.legalHold: true` (admin-only) and the cleanup workers filter on it. If you add a hold, add a filter here. |
| **Regulator request** | Any row under a specific reference | When the DPB or a court orders data preservation, the operator sets a `preserveUntil` date and the cleanup workers must skip those rows. The mechanism is admin-driven; see `docs/RUNBOOK_INCIDENT_RESPONSE.md` for the procedure. |

If a row falls into one of these exceptions, the cleanup
worker is documented to skip it (it is the worker's where-clause
that enforces the exception, not a separate list). New
exceptions must be added to this table and to the relevant
worker's where-clause in the same commit.

---

## 4. Verification

- **Test**: `web/tests/unit/workers/scheduled-cron-audit-tg1-tg11.test.ts`
  covers TG-4 (telemetry-cleanup atomicity), TG-8 (audit-cleanup
  idempotency), TG-9 (telemetry-cleanup idempotency).
- **Monthly review**: the security lead confirms during the
  monthly security review that the cleanup jobs ran and the
  destruction counts match the `AuditLog` row counts (see
  `docs/SECURITY_PLAN.md` §Monthly review checklist).
- **Breach scenario**: if the database is exfiltrated
  (`RUNBOOK_DPDP_BREACH.md` §3 containment), the
  `BACKUP_ENCRYPTION_KEY` rotation invalidates future
  decryption but does not retroactively destroy rows in the
  live database. The next cleanup run destroys them on
  schedule.

---

## 5. Audit trail

Each row in the `AuditLog` table with `action:
'telemetry.cleanup'` is the proof of destruction for the
device-data tables. The `details` field is a JSON object:

```json
{
  "cutoff": "2026-08-15T00:00:00.000Z",
  "locationsToDelete": 5023,
  "callLogsToDelete": 1872,
  "contactsToDelete": 412
}
```

This is the GDPR Art. 30 record. The cutoff is
`now - 30 days` at the time the job ran; the counts are the
exact number of rows destroyed in that run. The redaction pass
in `createAuditLog` (post-CMP-004) ensures no PII values
appear in the audit row, only counts and timestamps.

For `dataDeletionPurgeJob` the audit row uses
`action: 'RIDER_DATA_DELETION_PURGED'`, `entityId: '<rider-id>'`,
and a `details.fields` array listing every column that was
NULLed or sentinel-replaced. The `entityId` is the rider UUID,
not a PII value, so the redaction pass leaves it intact.

---

## 6. Reference

- DPDP Act 2023 §8(4) — storage limitation
- GDPR Art. 5(1)(e) — storage limitation; Art. 30 — record of
  processing activity
- `web/src/server/workers/jobs/telemetry-cleanup.job.ts`
  (PR-154) — the device-data cleanup worker
- `web/src/server/workers/jobs/audit-cleanup.job.ts` — the
  audit-log cleanup worker
- `web/src/server/workers/jobs/data-deletion-purge.job.ts`
  (PR-7) — the soft-delete hard-purge worker
- `web/src/lib/audit-log.ts` — `createAuditLog` redaction (CMP-004)
  and `RETENTION_PERIODS` table
- `docs/RUNBOOK_DPDP_BREACH.md` — breach response runbook
- `docs/SECURITY_PLAN.md` — monthly security review
