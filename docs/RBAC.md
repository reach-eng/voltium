# Voltium Role-Based Access Control (RBAC)

Voltium uses a strict RBAC system to separate internal staff capabilities and isolate rider operations.

## Architecture
- All role enforcement is centralized in `web/src/lib/rbac.ts`.
- Endpoints use `requireAdmin()` (any admin) or `requirePermission(permission)` (specific role).
- Riders do not have roles; they authenticate via Rider JWTs which are invalid for Admin endpoints.

## Role Hierarchy

1. **SUPER_ADMIN**
   - Full system access.
   - Can manage other admins and global configurations.
   - *Cannot* decrypt PII without audit logs, but has the technical clearance to run jobs that do.
   
2. **SUPPORT_LEAD**
   - Can manage support tickets, rider KYCs, and process manual refunds up to limits.
   - Can view rider data.

3. **SUPPORT_AGENT**
   - Can view support tickets and rider metadata.
   - *Cannot* process refunds.
   - *Cannot* approve/reject KYC.

4. **FLEET_MANAGER**
   - Can manage vehicles, hubs, and telematics overrides.
   - No access to rider financial data or support tickets.

## Rider vs Admin Separation
- Rider endpoints (`/api/rider/*`, `/api/rentals/*`) require a Rider Session.
- Admin endpoints (`/api/admin/*`) require an Admin Session.
- Passing a Rider token to an Admin endpoint results in a `401 Unauthorized`.

## Defense in Depth
- **Impersonation**: Admins cannot generate Rider JWTs without an explicit "Impersonation Request" which is logged and auditable.
- **Audit Logging**: All mutations by `SUPER_ADMIN` and `SUPPORT_LEAD` are logged to `AuditLog`.
