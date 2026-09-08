/**
 * NET-005 follow-up-21 (2026-09-08): the
 * `updateSecurityFlags` mass-assignment fix.
 *
 * The pre-fix code spread `data` straight into
 * `db.rider.update({ data })` — a
 * mass-assignment-shaped helper that today only
 * sees fixed keys from the actions route (5 rider
 * security columns + the special-case
 * `lockPassword` plaintext). One refactor from a
 * hole: a caller passing `lifecycleStatus` or any
 * other rider column would silently write that
 * column. The fix adds an explicit `SECURITY_RIDER
 * _FIELDS` allowlist and throws on unknown keys.
 *
 * The audit log was also updated to strip
 * `lockPasswordHash` (in addition to the existing
 * `lockPassword` strip) — the hash isn't a leak
 * but logging the column value adds nothing the
 * `isAdminLocked` / `lockPasswordHash` audit row
 * already implies.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  riderUpdate: vi.fn().mockResolvedValue({}),
  invalidateRiderCache: vi.fn(),
  createAuditLog: vi.fn().mockResolvedValue(undefined),
  hashPassword: vi.fn().mockResolvedValue('hashed-plaintext'),
}));

vi.mock('@/lib/db', () => ({
  db: {
    rider: {
      update: mocks.riderUpdate,
    },
  },
}));

vi.mock('@/lib/server-cache', () => ({
  invalidateRiderCache: mocks.invalidateRiderCache,
}));

vi.mock('@/lib/audit-log', () => ({
  createAuditLog: mocks.createAuditLog,
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/password', () => ({
  hashPassword: mocks.hashPassword,
}));

import { adminRiderUseCases } from '@/server/modules/riders/admin-riders.use-cases';

describe('NET-005 follow-up-21: updateSecurityFlags key allowlist', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ---------- allowlist positive cases ----------

  it('accepts isAdminLocked + lockPasswordHash (ADMIN_LOCK write)', async () => {
    await expect(
      adminRiderUseCases.updateSecurityFlags(
        'r1',
        { isAdminLocked: true, lockPasswordHash: 'hashed-123' },
        'admin-1'
      )
    ).resolves.toBeUndefined();

    expect(mocks.riderUpdate).toHaveBeenCalledWith({
      where: { id: 'r1' },
      data: { isAdminLocked: true, lockPasswordHash: 'hashed-123' },
    });
  });

  it('accepts isAdminLocked: false (UNLOCK_DEVICE write)', async () => {
    await expect(
      adminRiderUseCases.updateSecurityFlags(
        'r1',
        { isAdminLocked: false, lockPasswordHash: 'hashed-456' },
        'admin-1'
      )
    ).resolves.toBeUndefined();
  });

  it('accepts isUninstallBlocked (PERSIST_APP write)', async () => {
    await expect(
      adminRiderUseCases.updateSecurityFlags(
        'r1',
        { isUninstallBlocked: true },
        'admin-1'
      )
    ).resolves.toBeUndefined();
  });

  it('accepts isLocationMandatory (ENFORCE_LOCATION write)', async () => {
    await expect(
      adminRiderUseCases.updateSecurityFlags(
        'r1',
        { isLocationMandatory: true },
        'admin-1'
      )
    ).resolves.toBeUndefined();
  });

  it('accepts isAppsControlRestricted (RESTRICT_APPS_CONTROL write)', async () => {
    await expect(
      adminRiderUseCases.updateSecurityFlags(
        'r1',
        { isAppsControlRestricted: true },
        'admin-1'
      )
    ).resolves.toBeUndefined();
  });

  it('hashes the plaintext lockPassword into lockPasswordHash (the special case)', async () => {
    await adminRiderUseCases.updateSecurityFlags(
      'r1',
      { isAdminLocked: true, lockPassword: 'plaintext' },
      'admin-1'
    );

    // The DB write gets the hash, not the plaintext.
    expect(mocks.riderUpdate).toHaveBeenCalledWith({
      where: { id: 'r1' },
      data: { isAdminLocked: true, lockPassword: 'hashed-plaintext' },
    });
    // The hash function was called with the plaintext.
    expect(mocks.hashPassword).toHaveBeenCalledWith('plaintext');
  });

  // ---------- allowlist negative cases (the bug lock) ----------

  it('rejects an unknown key (lifecycleStatus would have been a silent mass-assignment write)', async () => {
    // The motivating bug: a future refactor that
    // passes `lifecycleStatus` (or any other rider
    // column) would silently write that column.
    // The fix throws on the first unknown key.
    await expect(
      adminRiderUseCases.updateSecurityFlags(
        'r1',
        { isAdminLocked: true, lifecycleStatus: 'ACTIVE' },
        'admin-1'
      )
    ).rejects.toThrow(/lifecycleStatus/);
    // The DB write did not happen — the unknown
    // key short-circuits the update.
    expect(mocks.riderUpdate).not.toHaveBeenCalled();
  });

  it('rejects an unknown key (phone — would have changed the rider\'s phone)', async () => {
    await expect(
      adminRiderUseCases.updateSecurityFlags(
        'r1',
        { isLocationMandatory: true, phone: '+91-9999999999' },
        'admin-1'
      )
    ).rejects.toThrow(/phone/);
    expect(mocks.riderUpdate).not.toHaveBeenCalled();
  });

  it('rejects an unknown key (fullName — would have changed the rider\'s name)', async () => {
    await expect(
      adminRiderUseCases.updateSecurityFlags(
        'r1',
        { isAdminLocked: true, fullName: 'New Name' },
        'admin-1'
      )
    ).rejects.toThrow(/fullName/);
    expect(mocks.riderUpdate).not.toHaveBeenCalled();
  });

  it('rejects multiple unknown keys and lists them all in the error message', async () => {
    await expect(
      adminRiderUseCases.updateSecurityFlags(
        'r1',
        { isAdminLocked: true, foo: 1, bar: 2, baz: 3 },
        'admin-1'
      )
    ).rejects.toThrow(/foo.*bar.*baz|foo, bar, baz/);
  });

  // ---------- audit details ----------

  it('audit details strip the plaintext lockPassword (the existing behavior, preserved)', async () => {
    // Pre-fix this was the only strip. The
    // user-flagged "fine" comment in the use-case
    // confirms this is correct: the plaintext
    // never makes it to the audit log.
    await adminRiderUseCases.updateSecurityFlags(
      'r1',
      { isAdminLocked: true, lockPassword: 'plaintext' },
      'admin-1'
    );
    const auditCall = mocks.createAuditLog.mock.calls[0][0];
    expect(auditCall.details).not.toHaveProperty('lockPassword');
    expect(auditCall.details).toHaveProperty('isAdminLocked', true);
  });

  it('audit details also strip lockPasswordHash (the new behavior — no value add to log the hash)', async () => {
    await adminRiderUseCases.updateSecurityFlags(
      'r1',
      { isAdminLocked: true, lockPasswordHash: 'hashed-789' },
      'admin-1'
    );
    const auditCall = mocks.createAuditLog.mock.calls[0][0];
    expect(auditCall.details).not.toHaveProperty('lockPassword');
    expect(auditCall.details).not.toHaveProperty('lockPasswordHash');
    expect(auditCall.details).toHaveProperty('isAdminLocked', true);
  });

  it('audit log uses action "system.config_change" (existing)', async () => {
    await adminRiderUseCases.updateSecurityFlags(
      'r1',
      { isAdminLocked: true },
      'admin-1'
    );
    const auditCall = mocks.createAuditLog.mock.calls[0][0];
    expect(auditCall.action).toBe('system.config_change');
    expect(auditCall.entityId).toBe('r1');
    expect(auditCall.entity).toBe('rider');
    expect(auditCall.actorId).toBe('admin-1');
  });
});
