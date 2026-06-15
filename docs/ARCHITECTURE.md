# Voltium Architecture

> System map, current architecture, and target architecture for the Voltium Electric Mobility platform.

---

## 1. System Overview

Voltium is an electric vehicle rental and fleet management platform with three primary surfaces:

| Surface     | Stack                                                | Purpose                         |
| ----------- | ---------------------------------------------------- | ------------------------------- |
| Rider App   | Flutter (Provider, Google Fonts, image_picker)       | Rider mobile experience         |
| Admin Panel | Next.js App Router (React, Tailwind, shadcn/ui)      | Fleet operations command center |
| API Layer   | Next.js API routes (Prisma, Zod, JWT)                 | Backend services                |

**Database**: Prisma ORM → PostgreSQL (all environments via managed service — Neon / Supabase / Railway)

> **Note**: Voltium does not use Docker for local development, CI, staging, or production. All services use managed infrastructure or native Node.js process commands.

---

## 2. Current Architecture (Before Migration)

### 2.1 Backend (`src/`)

```
src/
├─ app/
│  ├─ api/
│  │  ├─ admin/
│  │  │  ├─ announcements/
│  │  │  ├─ auth/
│  │  │  ├─ compliance/
│  │  │  ├─ deposits/
│  │  │  ├─ earning-tiers/
│  │  │  ├─ guarantors/
│  │  │  ├─ hubs/
│  │  │  ├─ kyc/
│  │  │  ├─ notifications/
│  │  │  ├─ plans/
│  │  │  ├─ riders/
│  │  │  ├─ settings/
│  │  │  ├─ shifts/
│  │  │  ├─ support/
│  │  │  ├─ teams/
│  │  │  ├─ transactions/
│  │  │  ├─ upload/
│  │  │  ├─ vehicles/
│  │  │  └── wallets/
│  │  ├─ auth/
│  │  ├─ notifications/
│  │  ├─ rider/
│  │  ├─ rental/
│  │  ├─ support/
│  │  └─ webhook/
│  └─ admin/
│     └─ (admin React pages)
│
├─ components/       (shadcn/ui + custom React components)
├─ hooks/            (React hooks)
├─ lib/
│  ├─ api-response.ts
│  ├─ api-version.ts
│  ├─ auth.ts
│  ├─ db.ts
│  ├─ env.ts
│  ├─ logger.ts
│  └─ validators.ts
├─ store/            (Zustand stores)
├─ types/            (TypeScript types)
│
├─ middleware.ts     (CSP, CSRF, validation)
└─ proxy.ts          (CORS, request logging)
```

### 2.2 Current Architecture Characteristics

- **Business logic lives inside API route files** — routes handle auth, validation, business rules, Prisma queries, and response formatting in one file
- **Statuses are free-form strings** — `String @default("ACTIVE")` with no enum enforcement
- **Shared utilities are few** — `auth.ts` for JWT, `validators.ts` for Zod schemas, `db.ts` for Prisma client
- **No repository layer** — Prisma is called directly from routes
- **No use-case layer** — business decisions are inline
- **No wallet ledger** — wallet balance is stored as `balanceInPaise` on Wallet model, updated directly
- **Single-file validators** — all Zod schemas live in `src/lib/validators.ts`
- **No worker/background job infrastructure** — cron tasks are not separated

### 2.3 API Route Pattern (Current)

```typescript
// Typical current route pattern — everything in one file
export async function POST(req: NextRequest) {
  // 1. Auth check (inline)
  // 2. Body parse (inline)
  // 3. Validation (calls validator)
  // 4. Business logic (inline Prisma queries)
  // 5. State/status transitions (inline)
  // 6. Response formatting (inline)
}
```

---

## 3. Target Architecture (Post-Migration)

### 3.1 Backend Target Structure

```
src/
├─ app/
│  ├─ api/                  → Thin route handlers only
│  └─ admin/                → Admin panel pages
│
├─ server/
│  ├─ modules/
│  │  ├─ auth/
│  │  │  ├─ auth.routes.ts
│  │  │  ├─ auth.use-cases.ts
│  │  │  ├─ auth.service.ts
│  │  │  ├─ auth.repository.ts
│  │  │  ├─ auth.schemas.ts
│  │  │  └─ auth.types.ts
│  │  │
│  │  ├─ riders/
│  │  ├─ onboarding/
│  │  ├─ kyc/
│  │  ├─ guarantors/
│  │  ├─ wallet/
│  │  ├─ deposits/
│  │  ├─ rentals/
│  │  ├─ vehicles/
│  │  ├─ hubs/
│  │  ├─ support/
│  │  ├─ notifications/
│  │  ├─ device-compliance/
│  │  └─ analytics/
│  │
│  ├─ shared/
│  │  ├─ auth/
│  │  ├─ rbac/
│  │  ├─ errors/
│  │  ├─ logger/
│  │  ├─ storage/
│  │  ├─ queue/
│  │  └─ validation/
│  │
│  ├─ db/
│  │  └─ prisma.ts
│  │
│  └─ workers/
│     ├─ index.ts
│     ├─ queues.ts
│     └─ jobs/
│
├─ contracts/
│  ├─ auth.contract.ts
│  ├─ rider.contract.ts
│  ├─ kyc.contract.ts
│  ├─ wallet.contract.ts
│  ├─ rental.contract.ts
│  └─ openapi.ts
│
├─ components/
├─ hooks/
├─ lib/
└─ store/
```

### 3.2 Module Template

Each module follows a consistent pattern:

```
module-name/
├─ module.routes.ts      → Route definitions (thin, delegates to use-cases)
├─ module.use-cases.ts   → Business logic orchestration
├─ module.service.ts     → Domain service operations
├─ module.repository.ts  → Data access (Prisma queries)
├─ module.policy.ts      → Authorization rules
├─ module.schemas.ts     → Zod validation schemas
└─ module.types.ts       → TypeScript types and enums
```

### 3.3 Target API Route Pattern

```typescript
// Target pattern — thin route handler
export async function POST(req: NextRequest) {
  const session = await requireRiderSession(req);
  const body = await req.json();
  const input = SubmitKycSchema.parse(body);
  const result = await kycUseCases.submitKyc({
    riderId: session.riderId,
    input,
  });
  return Response.json({ success: true, data: result });
}
```

### 3.4 Flutter Target Structure

```
flutter/lib/
├─ app/
│  ├─ app.dart
│  ├─ router.dart
│  └─ bootstrap.dart
│
├─ core/
│  ├─ network/         → Dio client, interceptors
│  ├─ storage/         → flutter_secure_storage, local DB
│  ├─ errors/          → Error handling, retry logic
│  ├─ theme/           → AppTheme, colors, typography
│  ├─ widgets/         → Shared reusable widgets
│  ├─ permissions/     → Runtime permission handling
│  └─ constants/       → App-wide constants
│
├─ features/
│  ├─ auth/
│  ├─ onboarding/
│  ├─ kyc/
│  ├─ guarantor/
│  ├─ wallet/
│  ├─ deposits/
│  ├─ rental/
│  ├─ pickup/
│  ├─ dashboard/
│  ├─ support/
│  ├─ notifications/
│  ├─ profile/
│  ├─ rewards/
│  ├─ referrals/
│  └─ device_compliance/
│
└─ models/             → Shared domain models
```

Each feature follows Clean Architecture:

```
feature/
├─ data/
│  ├─ api.dart
│  ├─ dto.dart
│  └─ repository_impl.dart
├─ domain/
│  ├─ entity.dart
│  ├─ repository.dart
│  └─ use_cases.dart
└─ presentation/
   ├─ screens/
   ├─ widgets/
   └─ controller.dart
```

---

## 4. Core Architectural Principles

| Principle              | Description                                           |
| ---------------------- | ----------------------------------------------------- |
| **Thin routes**        | API routes only parse input and delegate to use-cases |
| **Use-cases first**    | Business logic lives in use-case files, not routes    |
| **Repositories**       | All Prisma queries behind repository abstractions     |
| **Schema-first**       | Every input validated by Zod schema before use-case   |
| **State machines**     | Statuses are controlled enums with valid transitions  |
| **Ledger-everything**  | Money/wallet changes require double-entry ledger rows |
| **Idempotent ops**     | Approvals, payments, and deposits are idempotent      |
| **Audit trail**        | Every sensitive action is logged                      |
| **Feature-first Flutter** | Flutter organized by domain feature, not layer    |

---

## 5. Data Flow Architecture

```
Rider App (Flutter)
     │
     ▼  HTTPS + JWT
API Routes (thin)
     │
     ▼
Use-Cases (business logic + auth)
     │
     ├──► Service Layer (domain operations)
     │       │
     │       └──► Repository (Prisma)
     │               │
     │               └──► Database
     │
     ├──► State Machine (transition validation)
     │
     ├──► Wallet Ledger (append-only)
     │
     └──► Audit Log (append-only)
              │
              └──► Background Workers (DB-backed outbox, Node worker process)
```

---

## 6. Security Architecture

```
Request
  │
  ├──► Middleware: CSP headers, CSRF check
  │
  ├──► Route: Authentication (JWT session)
  │
  ├──► Use-Case: Authorization (RBAC policy)
  │
  ├──► Schema: Input validation (Zod)
  │
  └──► Repository: Parameterized queries (Prisma)
```

---

## 7. Migration Strategy

Refactor workflow by workflow, in this order:

1. Auth (OTP login, session, JWT)
2. KYC (submit, approve, reject)
3. Guarantor (submit, approve, reject)
4. Wallet/Deposits (top-up, approve, ledger)
5. Rental/Pickup (plan, hub, vehicle, return)
6. Support/Notifications
7. Device compliance

Each workflow is complete when it has:
- Backend use-case + repository + schema
- State machine with valid transitions
- Thin API route
- Flutter feature module
- Tests
- Audit logging (if money/security related)

---

## 8. Environment Strategy

| Environment | Database               | Storage         | Purpose           |
| ----------- | ---------------------- | --------------- | ----------------- |
| local       | Managed PostgreSQL     | Local files     | Development       |
| staging     | Managed PostgreSQL     | GCS bucket      | Integration tests |
| production  | Managed PostgreSQL     | GCS bucket      | Live operations   |

All environments use PostgreSQL via a managed provider (Neon / Supabase / Railway).
No Docker containers are used in any environment.
