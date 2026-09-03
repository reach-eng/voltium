# Voltium Database Lifecycle, Foreign Key & Constraint Architecture

---

## 1. DB-Level State Machine & Enum Transition Guards (DB-015)

To prevent illegal state transitions, data corruption, and terminal regressions from ad-hoc queries or background processes, PostgreSQL triggers enforce state machine invariants at the database layer (see [`web/prisma/migrations/20260810000002_add_state_machine_transition_guards/migration.sql`](../web/prisma/migrations/20260810000002_add_state_machine_transition_guards/migration.sql)):

| Table | Guarded Field | Invariant / Forbidden Transitions |
|---|---|---|
| `transactions` | `status` | • `APPROVED`, `REJECTED`, `REVERSED` cannot revert to `PENDING`<br>• `REJECTED` cannot directly change to `APPROVED` |
| `deposit_records` | `status` | • `APPROVED`, `REJECTED`, `REFUNDED`, `FORFEITED` cannot revert to `PENDING` |
| `rental_leases` | `status` | • `COMPLETED`, `CANCELLED` cannot revert to `PENDING` |

---

## 2. Foreign Key `ON DELETE` Standardization Policy (DB-016)

Every `@relation` in [`web/prisma/schema.prisma`](../web/prisma/schema.prisma) explicitly declares one of three standardized `onDelete` behaviors:

1. **`onDelete: Restrict` (Financial & Audit Integrity)**:
   - Applied to all financial ledger entries and parent entities referenced by active financial records.
   - Example: `Transaction.rider -> Rider`, `WalletLedger.rider -> Rider`, `WalletLedger.wallet -> Wallet`, `Vehicle.hub -> Hub`.
   - Hard deletion of parent rows is blocked if child audit or ledger records exist.

2. **`onDelete: Cascade` (1:1 & 1:N Owned Component Records)**:
   - Applied strictly to private dependent sub-records that have no independent lifecycle outside their parent entity.
   - Example: `RiderPermissions.rider -> Rider`, `RiderAdminLock.rider -> Rider`, `RiderPickupPhoto.rider -> Rider`, `TransactionBreakdown.transaction -> Transaction`, `TicketAttachment.ticket -> SupportTicket`.

3. **`onDelete: SetNull` (Associative & Operational Assignments)**:
   - Applied to operational assignments, current active links, and administrative handlers where the child record outlives the association.
   - Example: `Vehicle.currentRiderId -> Rider?`, `Rider.pickupHubId -> Hub?`, `Rider.currentPlanId -> RentalPlan?`, `Rider.teamLeaderId -> TeamLeader?`, `SupportTicket.assignedTo -> Admin?`.

---

## 3. Standard Soft-Delete & Lifecycle Protocol (DB-017)

Voltium standardizes entity lifecycle into three clear architectural categories:

### A. Soft-Deletable Domain Models (`deletedAt: DateTime?`)
- **Entities**: `Rider`, `Vehicle`, `Hub`, `RentalPlan`, `Shift`, `RiderGuarantor`, `SupportTicket`, `LegalDocument`, `TeamLeader`.
- **Mechanism**: Setting `deletedAt = now()` hides the entity from all standard application read paths (`where: { deletedAt: null }`) while preserving foreign keys, billing history, and audit trails.
- **Index**: Backed by `@@index([deletedAt])` for performant filtering.

### B. Business Lifecycle Workflows (`lifecycleStatus` / `status` / `isActive`)
- **Active Flags (`isActive: Boolean`)**: Used on configurable templates (`RentalPlan`, `Shift`) to suspend new bookings without hiding historical records.
- **Workflow State (`lifecycleStatus`, `accountStatus`)**: Models active operational states (e.g. `REGISTERED`, `KYC_SUBMITTED`, `ACTIVE`, `SUSPENDED`, `CLOSED`). Closing an account updates `lifecycleStatus = CLOSED` as part of the soft-delete workflow.

### C. Append-Only Immutable Records (No Soft Delete, No Hard Delete)
- **Entities**: `Transaction`, `WalletLedger`.
- **Mechanism**: Financial transactions and ledger entries are permanently immutable. Hard deletion is prevented via PostgreSQL database triggers (`prevent_transaction_delete`, `prevent_wallet_ledger_delete`). Corrections and refunds are issued exclusively via offsetting `REVERSAL` records.
