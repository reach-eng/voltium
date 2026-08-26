# Voltium Architecture & Security Policies

## 1. CSRF Protection Policy
Voltium relies entirely on **strict SameSite cookies** and **Origin header verification** for Cross-Site Request Forgery (CSRF) protection.
- The `X-CSRF-Token` header was previously in the CORS allow-list but is not actively verified via a double-submit cookie pattern. It has been documented as a deprecated approach.
- Next.js Server Actions automatically handle CSRF via standard Origin checks, and our API routes enforce `SameSite=strict` on session cookies.

## 2. Trusted Proxy & Rate Limiting Policy
When deployed behind Cloudflare (or a similar reverse proxy tunnel):
- **Primary IP Header**: The `CF-Connecting-IP` header MUST be used as the primary identifier for rate-limiting.
- **Fallback IP Header**: `X-Forwarded-For` should only be used if `CF-Connecting-IP` is absent and the request originates from a trusted internal load balancer subnet.
- Any direct connections bypassing the proxy (if possible) must be restricted via firewall rules (e.g., Cloudflare Authenticated Origin Pulls).

## 3. Cryptographic Key Rotation & Migration Policy
All cryptographic migrations must be **opportunistic and silent**:
- **Passwords**: The system is migrating from PBKDF2 to Argon2id. When a user successfully authenticates using a PBKDF2 hash, the system MUST automatically re-hash their plaintext password using Argon2id and update the database row.
- **PII Encryption**: The `PII_ENCRYPTION_KEY` must be exactly 64 hexadecimal characters. Fallback keys are strictly prohibited in production and development to prevent accidental data leaks. Key rotation requires dual-key support (decryption tries new key, falls back to old key; encryption always uses new key).

## 4. State Management (Flutter)
- The official state management solution for the Voltium Flutter application is **Riverpod**.
- `Provider` and `get_it` service locators are deprecated and must be phased out during module refactors.

## 5. Observability Strategy
- Voltium adopts **Sentry** as the unified observability platform across both the Next.js backend and the Flutter frontend.
- Hand-rolled in-process APM utilities (`apm.ts`) are deprecated. Performance tracing, error tracking, and distributed correlation IDs should funnel through the Sentry SDK.

## 6. Database Migration Policy
To ensure zero-downtime deployments, Prisma database migrations must adhere to the following rules:
- **Additive Changes**: Adding columns, tables, or non-unique indexes can be executed in a single deployment. The new code simply starts reading/writing the new fields.
- **Destructive Changes (Column Drops / Renames)**: Dropping a column MUST be split into a minimum of 3 deployment phases:
  1. **Phase 1 (Schema Add)**: Add the new column/table. Update the application to dual-write to both the old and new columns. Read from the old column.
  2. **Phase 2 (Data Backfill)**: Run a script to backfill data from the old column to the new column. Update the application to read from the new column.
  3. **Phase 3 (Schema Drop)**: Drop the old column from the schema in a subsequent release once all nodes are running the Phase 2 code.
