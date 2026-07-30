/**
 * SessionPayload — the canonical session shape, used by both
 * `lib/auth.ts` (JWT creation/verification) and `lib/permissions.ts`
 * (RBAC checks).
 *
 * ━ Ticket #15 refactor ━
 * Extracted to its own file to break the previous circular import
 * between auth.ts and permissions.ts.
 *
 * Browser-safe: no DB/prisma imports.
 */

export type SessionPayload = {
  riderId: string;
  riderDbId: string;
  phone: string;
  role: string;
  adminRole?: string;
  adminId?: string;
  adminPermissions?: string[]; // Array of allowed permission keys
};
