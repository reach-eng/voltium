# Voltium — Database Architecture

## Provider

**PostgreSQL only** — all environments (local, staging, production).

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

## Migration Workflow

### Development

```bash
# From the web/ directory
cd web

# Create a new migration after schema changes
npx prisma migrate dev --name describe_change

# Apply migrations
npx prisma migrate dev

# Reset database (loses data)
npx prisma migrate reset
```

### Production / Staging

```bash
# Apply pending migrations (safe, preserves data)
npx prisma migrate deploy

# Generate Prisma client
npx prisma generate
```

**Never use `prisma db push` in production or staging.** Use `prisma migrate deploy` only.

In Docker, migrations run automatically via a separate `migrate` service that starts before the web service:

```bash
# Manual migration run
docker compose -f docker-compose.production.yml run --rm migrate

# Check migration status
docker compose -f docker-compose.production.yml exec db \
  psql -U voltfleet_prod -c "SELECT * FROM _prisma_migrations WHERE finished_at IS NULL;"
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

## Local Development

Start PostgreSQL via Docker:

```bash
docker compose up -d db
```

Set DATABASE_URL in `.env`:

```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/voltium?schema=public"
```

Run migrations and seed:

```bash
npx prisma migrate dev
npx prisma db seed
```

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
