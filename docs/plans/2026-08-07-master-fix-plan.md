# Master Fix Plan — 50+ Still-True Items
**Date:** 2026-08-07
**Source:** Master Audit Verification Report 2026-08-07

**Total: 26 PRs across 4 phases, ~25 hours wall time.**

## Phase 1 — P0 ship-blockers (8 PRs, ~6h)
- PR-1: `/api/admin/tickets/[id]/messages` (Admin Support P0-1) — 1h
- PR-2: 5-min bucket idempotency amount check (Wallet P0-3) — 1.5h
- PR-3: `plan.use-cases.list` NaN + isActive/durationDays (Rentals P0.1) — 30min
- PR-4: WALLET_RECONCILIATION + RENT_PAID dead enum cleanup — 30min
- PR-5: run-now backup to outbox (Data Mgmt P0-3) — 1h
- PR-6: device-violation-emitter maxAttempts (Cron P0-6) — 15min
- PR-7: Flutter parallel KYC uploads (Upload P0) — 30min
- PR-8: Flutter updateRiderProfile fields (Profile P0-6) — 1h

## Phase 2 — P0 important (8 PRs, ~7h)
- PR-9: Flutter dark mode follow system + PostHog + setFollowSystem — 1.5h
- PR-10: Flutter language dialog consolidation — 30min
- PR-11: Flutter await PostHog signup (Login P0-4) — 15min
- PR-12: Flutter permissions cleanup (Onboarding P0-2) — 1h
- PR-13: Flutter pickup RefreshIndicator (Pickup P0-4) — 1h
- PR-14: Flutter rentalDetails AuthState (Rental P0-2) — 1.5h
- PR-15: Flutter delete dead submitVehicleReturn + EndRentalScreen pop — 1h
- PR-16: Flutter create_ticket photo attachment (Support P0-2) — 1.5h

## Phase 3 — P0 test coverage + splash (4 PRs, ~6h)
- PR-17: Flutter pickup e2e + emergency e2e tests — 4h
- PR-18: Flutter splash fast-path for returning users — 1h
- PR-19: Web earnings dashboard fixes (activeRentals + getRevenueTrend) — 1h

## Phase 4 — P1 housekeeping (6 PRs, ~6h)
- PR-20: Web PII removal (Aadhaar/PAN/bank + guarantor) — 2h
- PR-21: Web todayStats real values — 30min
- PR-22: Flutter wallet delete dead repo (Wallet P0-2) — 1h
- PR-23: Flutter delete TopUpUpiScreen dead file (Wallet P1-2) — 15min
- PR-24: Flutter delete dead PickupEntity + ProfileEntity — 15min
- PR-25: Flutter delete 6 dashboard re-export shims — 30min
- PR-26: Web hardcoded TODOs + minor cleanups — 1h
