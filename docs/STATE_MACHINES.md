# Voltium State Machines

> Controlled enum-based state machine definitions for every entity lifecycle. Each machine defines legal transitions, forbidden jumps, and side effects.

---

## 1. Rider Lifecycle (`rider.state`)

The primary state machine that governs the entire rider journey from registration to active operations.

```text
NEW
  │
  ▼
PHONE_VERIFIED
  │
  ▼
PROFILE_SUBMITTED
  │
  ▼
KYC_SUBMITTED
  │
  ├────► KYC_REJECTED ──► PROFILE_SUBMITTED (re-upload)
  │
  ▼
KYC_APPROVED
  │
  ▼
GUARANTOR_SUBMITTED
  │
  ├────► GUARANTOR_REJECTED ──► GUARANTOR_SUBMITTED (re-submit)
  │
  ▼
GUARANTOR_APPROVED
  │
  ▼
DEPOSIT_PENDING
  │
  ├────► DEPOSIT_REJECTED ──► DEPOSIT_PENDING (re-submit)
  │
  ▼
DEPOSIT_APPROVED
  │
  ▼
PLAN_SELECTED
  │
  ▼
PICKUP_SCHEDULED
  │
  ▼
ACTIVE
  │
  ├────► SUSPENDED ──► ACTIVE (reinstated)
  │
  ├────► RETURN_PENDING ──► CLOSED
  │
  └────► CLOSED (direct closure)
```

### Legal Transitions

| From                | To                    | Trigger                      | Side Effect                    |
|---------------------|-----------------------|------------------------------|--------------------------------|
| NEW                 | PHONE_VERIFIED        | OTP login success            | Create rider record            |
| PHONE_VERIFIED      | PROFILE_SUBMITTED     | Profile form submit          | Update rider fields            |
| PROFILE_SUBMITTED   | KYC_SUBMITTED         | KYC document upload          | Create KYC profile             |
| KYC_SUBMITTED       | KYC_APPROVED          | Admin approve KYC            | Lock KYC fields                |
| KYC_SUBMITTED       | KYC_REJECTED          | Admin reject KYC             | Set rejection reason           |
| KYC_REJECTED        | PROFILE_SUBMITTED     | Rider clears rejection       | Reset KYC profile              |
| KYC_APPROVED        | GUARANTOR_SUBMITTED   | Guarantor form submit        | Create guarantor record        |
| GUARANTOR_SUBMITTED | GUARANTOR_APPROVED    | Admin approve guarantor      | Lock guarantor fields          |
| GUARANTOR_SUBMITTED | GUARANTOR_REJECTED    | Admin reject guarantor       | Set rejection reason           |
| GUARANTOR_REJECTED  | GUARANTOR_SUBMITTED   | Rider re-submits             | Reset guarantor profile        |
| GUARANTOR_APPROVED  | DEPOSIT_PENDING       | Deposit submitted            | Create DepositRecord           |
| DEPOSIT_PENDING     | DEPOSIT_APPROVED      | Admin approve deposit        | Credit wallet, ledger entry    |
| DEPOSIT_PENDING     | DEPOSIT_REJECTED      | Admin reject deposit         | Set rejection reason           |
| DEPOSIT_REJECTED    | DEPOSIT_PENDING       | Rider re-submits             | Reset deposit                  |
| DEPOSIT_APPROVED    | PLAN_SELECTED         | Rider selects plan           | Create rental lease            |
| PLAN_SELECTED       | PICKUP_SCHEDULED      | Rider schedules pickup       | Vehicle reserved               |
| PICKUP_SCHEDULED    | ACTIVE                | Pickup completed             | Assign vehicle, start rental   |
| ACTIVE              | SUSPENDED             | Admin suspension             | Disable app access             |
| SUSPENDED           | ACTIVE                | Admin reinstatement           | Re-enable app access           |
| ACTIVE              | RETURN_PENDING        | Rider submits return request | Capture photos, notify admin   |
| RETURN_PENDING      | CLOSED                | Admin approves return        | Release vehicle, process refund|

### Forbidden Transitions

| From         | To          | Reason                                |
|--------------|-------------|---------------------------------------|
| NEW          | ACTIVE      | Cannot skip KYC, deposit, plan, pickup |
| KYC_REJECTED | KYC_APPROVED| Must re-submit first                  |
| ACTIVE       | NEW         | Cannot go backwards beyond suspension |

---

## 2. KYC Status (`kyc_profile.status`)

```text
DRAFT
  │
  ▼
SUBMITTED
  │
  ├────► APPROVED
  │
  ├────► REJECTED ──► SUBMITTED (re-submit)
  │
  └────► INFO_REQUIRED ──► SUBMITTED (re-submit with info)
```

### Transitions

| From          | To            | Trigger               |
|---------------|---------------|-----------------------|
| DRAFT         | SUBMITTED     | Rider submits KYC     |
| SUBMITTED     | APPROVED      | Admin approves        |
| SUBMITTED     | REJECTED      | Admin rejects         |
| SUBMITTED     | INFO_REQUIRED | Admin requests info   |
| REJECTED      | SUBMITTED     | Rider re-submits      |
| INFO_REQUIRED | SUBMITTED     | Rider provides info   |
| APPROVED      | EXPIRED       | Time-based expiry     |

---

## 3. Guarantor Status (`guarantor.status`)

```text
DRAFT
  │
  ▼
SUBMITTED
  │
  ├────► APPROVED
  │
  ├────► REJECTED ──► SUBMITTED (re-submit)
  │
  └────► INFO_REQUIRED ──► SUBMITTED (re-submit with info)
```

### Additional Transition

| From     | To       | Trigger                    |
|----------|----------|----------------------------|
| APPROVED | REPLACED | Rider requests replacement |

---

## 4. Deposit Status (`deposit_record.status`)

```text
NOT_SUBMITTED
  │
  ▼
PENDING_VERIFICATION
  │
  ├────► APPROVED
  │
  ├────► REJECTED ──► PENDING_VERIFICATION (re-submit)
  │
  └────► FORFEITED
```

### Refund Flow

```text
APPROVED
  │
  ▼
REFUND_REQUESTED
  │
  ├────► REFUNDED
  │
  └────► PARTIALLY_REFUNDED
```

### Transitions

| From               | To                   | Trigger                         | Side Effect                          |
|--------------------|----------------------|---------------------------------|--------------------------------------|
| NOT_SUBMITTED      | PENDING_VERIFICATION | Rider submits deposit proof     | Create transaction (PENDING)         |
| PENDING_VERIFICATION | APPROVED            | Admin approves                  | Credit wallet, ledger entry          |
| PENDING_VERIFICATION | REJECTED            | Admin rejects                   | Set rejection reason                 |
| REJECTED           | PENDING_VERIFICATION | Rider re-submits                | Reset deposit record                 |
| APPROVED           | REFUND_REQUESTED     | Rider/Admin requests refund     | Freeze deposit amount                |
| REFUND_REQUESTED   | REFUNDED             | Admin processes refund          | Debit wallet, ledger entry           |
| REFUND_REQUESTED   | PARTIALLY_REFUNDED   | Partial refund approved         | Debit partial amount                 |
| APPROVED           | FORFEITED            | Admin forfeits (violation)      | Forfeit amount, ledger entry         |

---

## 5. Transaction Status (`transaction.status`)

```text
PENDING
  │
  ├────► APPROVED
  │
  ├────► REJECTED
  │
  ├────► FAILED
  │
  └────► REFUNDED
```

### Reversal Flow

```text
APPROVED ──► REVERSED
```

### Transitions

| From     | To       | Trigger                  |
|----------|----------|--------------------------|
| PENDING  | APPROVED | Admin approves           |
| PENDING  | REJECTED | Admin rejects            |
| PENDING  | FAILED   | Payment provider failure |
| APPROVED | REVERSED | Admin reversal           |
| APPROVED | REFUNDED | Admin initiates refund   |

---

## 6. Rental Status (`rental_lease.status`)

```text
NO_RENTAL
  │
  ▼
PLAN_SELECTED
  │
  ▼
PICKUP_SCHEDULED
  │
  ▼
ACTIVE
  │
  ├────► OVERDUE
  │         │
  │         ├────► ACTIVE (payment received)
  │         │
  │         └────► SUSPENDED (critical overdue)
  │
  ├────► RETURN_PENDING
  │         │
  │         └────► RETURN_APPROVED ──► CLOSED
  │
  ├────► SUSPENDED ──► ACTIVE (reinstated)
  │
  └────► CLOSED (early termination)
```

---

## 7. Vehicle Status (`vehicle.status`)

```text
AVAILABLE
  │
  ├────► RESERVED ──► AVAILABLE (release)
  │
  ├────► ASSIGNED ──► ACTIVE_RENTAL
  │                       │
  │                       ├────► RETURN_PENDING
  │                       │         │
  │                       │         └────► MAINTENANCE ──► AVAILABLE
  │                       │
  │                       └────► MAINTENANCE (incident)
  │
  ├────► RETIRED
  │
  └────► LOST
```

---

## 8. Support Ticket Status (`support_ticket.status`)

```text
OPEN
  │
  ├────► ASSIGNED
  │         │
  │         ├────► IN_PROGRESS
  │         │         │
  │         │         ├────► RESOLVED ──► CLOSED
  │         │         │
  │         │         └────► CLOSED (no response)
  │         │
  │         └────► CLOSED (duplicate/spam)
  │
  └────► CLOSED
```

---

## 9. Notification Priority

Used for routing and display urgency.

```text
LOW        → Standard informational
NORMAL     → Default priority
HIGH       → Rent due, KYC approval
CRITICAL   → Account suspension, emergency SOS
```

---

## 10. Wallet Ledger Entry Types

```text
TOPUP_SUBMITTED
TOPUP_APPROVED
TOPUP_REJECTED
RENT_DEBIT
DEPOSIT_CREDIT
DEPOSIT_REFUND
REWARD_CREDIT
FINE_DEBIT
REVERSAL
ADMIN_ADJUSTMENT
```

---

## 11. Admin Roles

```text
SUPER_ADMIN        → Full system access
OPERATIONS_ADMIN   → Daily fleet operations
KYC_REVIEWER       → KYC + guarantor review only
FINANCE_ADMIN      → Wallet, deposits, refunds
SUPPORT_AGENT      → Support tickets only
HUB_MANAGER        → Vehicle pickup/return at hub
FLEET_MANAGER      → Vehicle/hub CRUD
READ_ONLY          → Dashboard/reports only
```

---

## Implementation Checklist

For each state machine:

- [ ] Enum defined in `*.types.ts` file
- [ ] Transition map defines legal transitions
- [ ] Side effects documented per transition
- [ ] Invalid transitions return consistent error
- [ ] Prisma schema uses enum (not String)
- [ ] Tests cover every legal transition
- [ ] Tests verify forbidden transitions are blocked
