-- T-90 (PR-1, 2026-08-23): overdue-notification sent-marker on rental_leases.
-- The rent-reminders overdue path emits RENT_OVERDUE + notifyPaymentReminder
-- once per (lease, period) pair. The marker is set inside the same atomic
-- CAS that guards the debit path's periodNo, so a retry of the same minute's
-- pass becomes a no-op. Cleared when periodNo advances.
ALTER TABLE "rental_leases"
  ADD COLUMN "overdueNotifiedAt" TIMESTAMPTZ NULL;

-- Cheap lookup: the overdue query filters on nextRentDueAt; the marker
-- is a per-row check inside the tx. No composite index needed because
-- the CAS re-check is by id.
