# DPDP Act 2023 — Personal Data Breach Response Runbook

This runbook covers the **72-hour breach notification obligation** under
Section 8(7) of India's Digital Personal Data Protection Act, 2023
("DPDP Act"). It is the operational procedure for any incident that
results in — or is reasonably likely to result in — unauthorised
access, disclosure, alteration, or destruction of personal data of
Data Principals (riders, guarantors, team leaders).

**Trigger**: any of the following constitutes a "personal data breach"
under DPDP §2(t) and triggers this runbook:

- Confirmed or suspected unauthorised access to a database table
  containing rider PII (Rider, KycProfile, Guarantor, UserContact,
  UserCallLog, UserLocation, AuditLog.details, Consent).
- Exfiltration of a `pg_dump` backup (encrypted or unencrypted).
- Compromise of an admin or operator credential with read access to
  PII.
- A successful SQL-injection, SSRF, or path-traversal attack against
  any `/api/rider/*` or `/api/admin/*` route.
- Loss of a device that has logged into the Voltium admin console
  without full-disk encryption.
- Any third-party processor (payment gateway, SMS provider, FCM)
  reporting a breach of Voltium user data.

**Do not** use this runbook for non-PII incidents (e.g. a wallet
calculation bug, a UI bug, or a payment processing failure). Those
have their own runbooks (`RUNBOOK_INCIDENT_RESPONSE.md`,
`RUNBOOK_PAYMENT_FAILURE.md`).

---

## 1. The 72-hour clock

DPDP §8(7) requires the Data Fiduciary (Voltium) to notify:

1. **The Data Protection Board of India** ("DPB"): within **72 hours**
   of becoming aware of the breach, with the nature of the breach,
   the categories of Data Principals affected, and the likely
   consequences.
2. **The affected Data Principals** (riders, guarantors): without
   unreasonable delay, in a clear and concise manner, with the
   description of the breach and the measures taken to address it.

**"Awareness"** is the moment the breach is confirmed, not the moment
it is suspected. The 72h clock starts at the timestamp of the
`breach.confirmed` event in the audit log (see §5 below), not the
incident-detection timestamp.

If the breach cannot be fully characterised within 72 hours, the
notification may be sent in phases — but the **initial** notification
to the DPB is still required within 72h, with the unfilled fields
marked as "under investigation" and a follow-up commitment date.

---

## 2. The breach response tree

```
                [INCIDENT DETECTED: suspected PII breach]
                                    │
                       Is data exfiltrated, altered,
                       or accessible to an unauthorised
                       party?
                                    │
                ┌───────────────────┴───────────────────┐
            [No / Unclear]                          [Yes]
                │                                       │
        Continue monitoring;                    STOP THE BLEED
        document the suspicion;                  (see §3 below)
        do NOT trigger this runbook              THEN continue
        yet.                                     down the tree.
                                                        │
                                          ┌─────────────┴─────────────┐
                                  [Breach contained within        [Breach still
                                   < 4 hours of detection]        ongoing after 4h]
                                          │                              │
                                  Begin 72h clock              Treat as SEVERITY 1
                                  (see §1).                     Pager leadership NOW
                                          │                     (CEO, CTO, DPO designate)
                                          │                              │
                                          └──────────────┬───────────────┘
                                                         │
                                            Notify Data Protection Board
                                            within 72 hours
                                            (see §4 below)
                                                         │
                                            ┌────────────┴────────────┐
                                  [Severity contains         [Severity contains
                                   name, Aadhaar, PAN,         only phone / email /
                                   account number, or          location]
                                   biometric data]                     │
                                            │                     Single notification
                                    Per-Data-Principal           to all affected
                                    notification by SMS +        Data Principals
                                    email + in-app push          via broadcast
                                    (see §6 below)               (see §6 below)
```

---

## 3. Containment (first 4 hours)

The goal of containment is to **stop the breach** before the
investigation begins. Do this in parallel with §4, §5.

### 3.1 Confirm the breach

1. Pull the affected database table(s) row count and time range.
2. Cross-check against the audit log (`AuditLog.action` =
   `EXPORT`, `BULK_EXPORT`, `BACKUP_DOWNLOAD`, or any non-admin
   `SELECT` against a PII table).
3. If the breach is via a third-party (payment gateway, SMS, FCM),
   contact their security desk and request the timestamp, scope, and
   affected user IDs.

### 3.2 Stop the bleeding

- **Credential compromise**: rotate the affected admin's password
  AND revoke all sessions (`POST /api/admin/auth/logout-all-sessions
  --adminId <id>` if the route exists, otherwise force a password
  reset which terminates sessions).
- **Database exfiltration**: rotate the `DATABASE_URL` and the
  application connection secrets; redeploy. Block egress to the
  destination IP at the network layer.
- **Backup exfiltration**: rotate the `BACKUP_ENCRYPTION_KEY` AND
  every backup client that consumes it. Old backups remain
  decryptable with the new key if the key was used in the
  AES-256-CBC + PBKDF2 flow (see `scripts/db-backup.sh:5-7,
  113-115`); the rotation only protects future backups.
- **SSRF / path-traversal**: patch the affected route, deploy, and
  add the WAF rule that would have blocked the request.
- **Device loss**: revoke the device's session via the admin
  "Device Tracking" view (`/admin/devices/<id>/revoke`).

### 3.3 Log the containment actions

Every containment action must be recorded as an `AuditLog` entry
with `actorType: 'SYSTEM'`, `action: 'BREACH_CONTAINMENT.*'`, and
`entity: 'SecurityIncident'`. The audit log itself is a PII source;
treat it as such (see `web/src/lib/audit-log.ts` redaction
post-CMP-004).

---

## 4. Notify the Data Protection Board (72-hour clock)

The DPB notification must include:

1. **Nature of the breach** (one-paragraph plain-English summary).
2. **Categories of Data Principals affected** (riders / guarantors /
   team leaders / admins) and approximate count.
3. **Categories of personal data affected** (name / phone / Aadhaar
   / PAN / account / location / biometric / credentials).
4. **Likely consequences** (identity theft risk / financial fraud
   risk / physical safety risk for emergency contacts).
5. **Measures taken or proposed** to address the breach and mitigate
   its possible adverse effects (cross-reference §3).
6. **Contact point**: the DPO designate (see CMP-009 in
   `AUDIT_HYGIENE.md` — the DPO role is not yet filled; until
   filled, the security contact is the **CTO** + **CEO** joint
   sign-off, see §7 escalation).

### 4.1 Filing channel

As of 2026-09-02 the DPB has not yet stood up the public breach
notification portal. The interim procedure (per the DPDP Act §8(7)
read with the Digital Personal Data Protection Rules, 2025 draft):

- Email: **dpb-notify@gov.in** (placeholder — confirm the live
  address at https://www.meity.gov.in/data-protection-board
  before filing).
- Hard-copy: registered post to the Data Protection Board of
  India, Ministry of Electronics and Information Technology,
  Electronics Niketan, 6 CGO Complex, Lodhi Road, New Delhi —
  110003.
- Mark the email subject `PERSONAL DATA BREACH NOTIFICATION —
  [Voltium Electric Mobility Pvt Ltd] — [YYYY-MM-DD]`.
- Retain the email + registered-post receipt for **8 years** (the
  DPDP-record-retention floor).

### 4.2 Time tracking

Create a calendar entry for **T+72h** from the `breach.confirmed`
audit-log timestamp. The calendar entry owner is the on-call
security lead. Even if the investigation is incomplete, the
notification is **required** at T+72h with whatever is known. A
"still investigating" status is acceptable; a missed T+72h is
not.

---

## 5. Internal recordkeeping — the breach audit trail

Within the first 24 hours, create a `SecurityIncident` audit-log
chain that documents the response. Every entry uses
`actorType: 'SYSTEM'`, `action: 'BREACH_*'`, `entity:
'SecurityIncident'`, `entityId: '<incident-id>'`. The chain:

| Timestamp | Action | What to log |
| --------- | ------ | ----------- |
| T+0       | `BREACH_SUSPECTED`        | Initial detection; not yet confirmed. |
| T+confirm | `BREACH_CONFIRMED`        | Confirmation timestamp — this starts the 72h clock. |
| T+contain | `BREACH_CONTAINMENT.*`    | Per containment step from §3. |
| T+notify  | `BREACH_DPB_NOTIFIED`     | DPB email sent (include message-id). |
| T+notify  | `BREACH_PRINCIPALS_NOTIFIED` | Per-Data-Principal notification campaign launched. |
| T+close   | `BREACH_RESOLVED`         | Investigation closed; remediation complete. |

The chain is the **evidence** that the 72h clock was respected. It
is the source of truth for the post-mortem in §8.

---

## 6. Notify affected Data Principals

If the breach includes Aadhaar, PAN, account number, or biometric
data, each affected Data Principal must receive an individual
notification (SMS + email + in-app push) with:

1. A clear description of the breach in plain language.
2. The categories of personal data involved.
3. The likely consequences (e.g. "Your Aadhaar number may have been
   exposed; we recommend re-issuing masked Aadhaar via UIDAI").
4. The measures Voltium has taken (cross-reference §3).
5. Contact details for follow-up questions (the DPO designate, or
   the security contact until DPO is filled — see CMP-009).
6. Aadhaar / PAN holders: explicit guidance to monitor the UIDAI
   / income-tax portals for misuse, and a free credit-monitoring
   offer where applicable.

If the breach is **only** phone, email, or location data (no
government-ID or financial data), a single broadcast notification
to all affected users is acceptable, with the same content.

The notification copy must be reviewed by the legal team before
sending. **Do not** include any rider PII in the notification
template; use the rider's name from the affected-data query
only at send-time.

---

## 7. Escalation matrix

| Severity | Trigger | Page |
| -------- | ------- | ---- |
| SEV-1    | Breach ongoing > 4h, or Aadhaar/PAN exposed | CEO, CTO, security lead, legal lead |
| SEV-2    | Breach contained < 4h, name/phone/email exposed | CTO, security lead, legal lead |
| SEV-3    | Suspected breach, not yet confirmed | Security lead only |
| SEV-4    | Third-party processor reports breach; no Voltium data confirmed affected | Security lead + legal lead (monitor) |

The on-call rotation lives in PagerDuty (see
`docs/INFRASTRUCTURE_PLAN.md` §PagerDuty). If the breach is
SEV-1 or SEV-2, the on-call security lead is the breach
coordinator until the DPO designate is filled (CMP-009).

---

## 8. Post-mortem and follow-up

Within 7 days of `BREACH_RESOLVED`, the security lead runs a
blameless post-mortem with the engineering, ops, and legal teams.
The post-mortem document is filed at
`docs/incidents/YYYY-MM-DD-<short-slug>.md` and includes:

1. Timeline (reconstructed from the §5 audit chain).
2. Root cause (technical + procedural).
3. Detection latency (incident start → `BREACH_SUSPECTED`).
4. Containment latency (`BREACH_CONFIRMED` → `BREACH_CONTAINMENT`).
5. Notification latency (to DPB; to Data Principals).
6. Remediation actions with owners and due dates.
7. Whether the 72h clock was met (yes / no / partial).
8. Process changes for the next incident.

The post-mortem is reviewed in the next monthly security review
(see `docs/SECURITY_PLAN.md` §Monthly review). Repeat findings
(especially repeat root causes) are added to the
`docs/FOLLOWUP_TICKETS.md` backlog with explicit deadlines.

---

## 9. Reference

- DPDP Act 2023: https://www.meity.gov.in/content/digital-personal-data-protection-act-2023
  - §2(t) — definition of "personal data breach"
  - §8(4) — storage limitation
  - §8(7) — breach notification (72h to DPB; without unreasonable
    delay to Data Principals)
- DPDP Rules 2025 (draft, as of 2026-09-02) — notification form
  fields
- `docs/SECURITY_PLAN.md` — monthly security review
- `docs/RUNBOOK_INCIDENT_RESPONSE.md` — non-PII incident tree
- `docs/AUDIT_HYGIENE.md` — CMP-009 DPO-designate open item
- `web/src/lib/audit-log.ts` — PII redaction at write time
  (post-CMP-004)
- `web/src/app/api/admin/audit-logs/route.ts:50-68` — PII
  redaction at read time (PR-153)
- `scripts/db-backup.sh:5-7, 140-153` — AES-256-CBC + PBKDF2
  encryption for backup at rest
