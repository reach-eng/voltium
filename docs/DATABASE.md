# Voltium — Database Architecture

## Provider

**PostgreSQL only** — all environments (local, staging, production).
**Voltium does not use Docker for the database.** Use a managed PostgreSQL service.

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

## Recommended Managed PostgreSQL

| Environment | Provider                                              |
|-------------|-------------------------------------------------------|
| Local dev   | [Neon](https://neon.tech) free tier (serverless PG)   |
| Staging     | Separate Neon / Supabase / Railway project            |
| Production  | Separate Neon / Supabase / Railway project            |
| CI tests    | GitHub Actions `services: postgres` (built-in)        |

## Schema Location

The single source-of-truth schema is at:

```
web/prisma/schema.prisma
```

## Environment Variables

```env
# .env.local (development)
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/voltium_dev?sslmode=require"
DIRECT_URL="postgresql://USER:PASSWORD@HOST:5432/voltium_dev?sslmode=require"
APP_ENV="local"
NODE_ENV="development"

# .env.staging
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/voltium_staging?sslmode=require"
APP_ENV="staging"
NODE_ENV="production"

# .env.production
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/voltium_prod?sslmode=require"
APP_ENV="production"
NODE_ENV="production"
```

> **Important**: Do not use `NODE_ENV=staging`. Use `APP_ENV=staging` with `NODE_ENV=production`.

## Migration Workflow

### Development

```bash
# From the web/ directory
cd web

# Create a new migration after schema changes
npx prisma migrate dev --name describe_change

# Apply all pending migrations
npx prisma migrate dev

# Reset database (loses data — dev only)
npx prisma migrate reset
```

### Staging / Production

```bash
cd web

# Apply pending migrations safely (preserves data)
npx prisma migrate deploy

# Check migration status
npx prisma migrate status

# Validate schema
npx prisma validate

# Generate Prisma client
npx prisma generate
```

> **Never use `prisma db push` in staging or production.** Use `prisma migrate deploy` only.

## Local Development Setup

```bash
# 1. Sign up for a free Neon or Supabase account
# 2. Create a new PostgreSQL project
# 3. Copy the connection string

cd web
cp ../.env.local.example .env.local
# Edit .env.local — paste your DATABASE_URL

npm install
npx prisma generate
npx prisma migrate dev
npm run dev
```

## Enums

The schema defines Prisma enums for all major workflow statuses:

| Enum | Used By |
|------|---------|
| `RiderLifecycleStatus` | Rider lifecycle |
| `KycStatus` | KycProfile model |
| `GuarantorStatus` | Guarantor model |
| `DepositStatus` | DepositRecord model |
| `TransactionStatus` | Transaction model |
| `TransactionType` | Transaction model |
| `TransactionPurpose` | Transaction model |
| `RentalStatus` | RentalLease model |
| `VehicleStatus` | Vehicle model |
| `SupportTicketStatus` | SupportTicket model |
| `AdminRole` | Admin model |
| `AuditActionType` | AuditLog model |
| `LedgerEntryType` | WalletLedger model |
| `LedgerCategory` | WalletLedger model |
| `FileVisibility` | FileRecord model |
| `FileStatus` | FileRecord model |
| `OutboxEventStatus` | OutboxEvent model |

> All enums are now wired to their corresponding model fields.

## Key Tables

| Table | Purpose | Sprint |
|-------|---------|--------|
| `Rider` | Rider accounts & lifecycle | Core |
| `Wallet` | Wallet balance (cached) | Sprint 3 |
| `WalletLedger` | Append-only transaction ledger | Sprint 3 |
| `DepositRecord` | Security deposit lifecycle | Sprint 3 |
| `Transaction` | Payment records | Sprint 3 |
| `FileRecord` | File metadata & ownership | Sprint 3 |
| `AuditLog` | Admin action audit trail | Sprint 6 |
| `OutboxEvent` | Reliable async event processing | Sprint 6 |
| `AdminSession` | Admin authentication sessions | Sprint 6 |
| `RolePermission` | RBAC permissions | Sprint 6 |
| `ReconciliationReport` | Daily ledger reconciliation | Sprint 3 |
