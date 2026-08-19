-- PR-3 (2026-08-07 verification report, Section 2 — Flutter Profile P0-2):
-- rider-initiated GDPR/DPDP deletion request markers. The settings screen
-- used to POST `{action: 'DELETE_REQUEST'}` to /api/rider/profile which had
-- no handler; the request was silently dropped. These columns let read paths
-- surface a "deletion pending" state and record the rider's stated reason.

ALTER TABLE "riders"
  ADD COLUMN "deletionRequestedAt" TIMESTAMPTZ,
  ADD COLUMN "deletionRequestReason" TEXT;
