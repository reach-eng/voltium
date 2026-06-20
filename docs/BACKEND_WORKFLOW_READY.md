# Backend Workflow Completion — Public Beta

This package wires the core Voltium workflows end-to-end for laptop-only public beta operations.

## Rider workflow

1. OTP login uses the local PostgreSQL-backed OTP store in production.
2. Profile update writes only approved fields.
3. KYC submission persists KYC documents and moves the rider to `KYC_SUBMITTED`.
4. Admin KYC approval moves the rider to `KYC_APPROVED`.
5. Guarantor submission moves the rider to `GUARANTOR_SUBMITTED`.
6. Admin guarantor approval moves the rider to `GUARANTOR_APPROVED`.
7. Security deposit payment creates a pending transaction and deposit record, then moves the rider to `DEPOSIT_PENDING`.
8. Admin deposit approval credits the ledger-backed security deposit and moves the rider to `DEPOSIT_APPROVED`.
9. Plan selection debits the wallet through the ledger and moves the rider to `PLAN_SELECTED`.
10. Booking reserves the vehicle and moves the rider to `PICKUP_SCHEDULED`.
11. Pickup activates the rental and moves the vehicle to `ACTIVE_RENTAL`.
12. Return request creates a `VehicleReturn` record and moves the rider to `RETURN_PENDING`.
13. Admin return approval closes the rental and returns the vehicle to `AVAILABLE`.

## Admin workflow APIs

The admin console now has backend routes for:

- KYC queue and KYC approval/rejection: `/api/admin/kyc`
- Guarantor queue and guarantor approval/rejection: `/api/admin/guarantors`
- Rental list and rental lifecycle actions: `/api/admin/rentals`
- Vehicle history/timeline: `/api/admin/vehicles/[id]/history`
- Data Management backup list/create/detail/verify/download/delete
- Maintenance Mode
- System Settings
- Server Health

## Local persistence

- OTPs: local PostgreSQL `OtpCode`
- Rate limits: local PostgreSQL `RateLimitBucket`
- Uploads: local disk via `FileRecord` and local signed upload/read routes
- Backups: local disk, optional external drive copy
- Jobs: PostgreSQL outbox/worker

## Must-run local acceptance test

Run on the production laptop before public beta users are invited:

```text
OTP login
→ KYC upload
→ admin KYC approve
→ guarantor upload
→ admin guarantor approve
→ deposit proof upload/top-up
→ admin deposit approve
→ plan select
→ vehicle book/pickup
→ active rental
→ return request
→ admin close rental
→ manual backup
→ verify backup
→ restore backup
→ confirm uploaded files open
```
