# Public Beta Test Plan

Run this test plan before accepting public beta riders.

## Admin tests

- Admin login succeeds.
- Non-SUPER_ADMIN cannot open backup restore actions.
- SUPER_ADMIN can open Data Management.
- System Settings shows local laptop mode.
- Server Health reports real PostgreSQL, storage, worker, disk, and maintenance status.
- Maintenance mode can be enabled and disabled by SUPER_ADMIN only.

## Rider onboarding tests

- Rider can request OTP.
- Rider can verify OTP.
- Rider can submit profile.
- Rider can upload KYC file.
- Rider can upload guarantor document.
- Admin can review and approve KYC.
- Admin can review and approve guarantor.

## Rental workflow tests

- Admin can create/enable plan.
- Rider can select plan.
- Rider can submit deposit/top-up proof.
- Finance admin can approve deposit.
- Admin can assign vehicle.
- Pickup inspection can be completed.
- Rental can become active.
- Return inspection can be completed.
- Rental can be closed.

## File security tests

- Files are written under `LOCAL_STORAGE_ROOT`.
- Unauthorized file read is rejected.
- Expired upload token is rejected.
- Path traversal attempts are rejected.
- Files do not appear under `web/public`.

## Backup/restore tests

- Manual backup creates `database.sql`, `uploads.zip`, `manifest.json`, and `checksums.sha256`.
- Backup verify succeeds.
- Backup download works for SUPER_ADMIN.
- Scheduled backup run-now succeeds.
- Restore requires typed confirmation.
- Restore creates pre-restore backup.
- Files open after restore.
- Audit logs are written for backup and restore.

## Reboot test

- Reboot laptop.
- PostgreSQL starts automatically.
- PM2 web process starts.
- PM2 worker starts.
- Tunnel starts or is manually restarted.
- Admin → Server Health turns green.
