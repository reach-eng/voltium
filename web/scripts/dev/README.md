# Developer Utility Scripts

This directory contains standalone scripts for local development and testing diagnostics.

> [!CAUTION]
> These scripts interact directly with the database. Never execute developer utility scripts against production databases without explicit safety overrides.

## Scripts

### `query_rider.ts`
Dumps all riders with their KYC profile, wallet, and guarantor details to stdout as JSON.

```bash
npx tsx scripts/dev/query_rider.ts
```

### `reset_rahil.ts`
Resets test rider Rahil (`9999999991`) to `PROFILE_SUBMITTED` state for onboarding flow re-testing. Protected against execution in production environments (`APP_ENV=production`) unless `ALLOW_DEV_RESET=true` is set.

```bash
npx tsx scripts/dev/reset_rahil.ts
```
