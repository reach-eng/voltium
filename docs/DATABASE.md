# Voltium — Database Management

> **Note**: This repository represents a trimmed deployment package containing primarily the Flutter Android application and related infrastructure scripts. The `web/` frontend has been omitted from this version.

## Provider

**PostgreSQL** — local instance on the laptop.

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

## Schema Location

The single source-of-truth schema is at:

```
web/prisma/schema.prisma
```

## Environment Variables

```env
# .env (development / production)
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/voltium"
APP_ENV="local"
NODE_ENV="development"
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
# Ensure PostgreSQL is running locally on default port 5432
# Create the database:
createdb voltium

cd web
cp web/.env.example web/.env.local
# Edit .env.local — set DATABASE_URL if needed

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
