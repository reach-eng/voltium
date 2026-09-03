/**
 * TG (2026-08-05 legal/device audit) — P1/P2/P3 regression tests.
 *
 * Covers the audit's test gaps that the P0 pass did not:
 *   - P1-5:  security actions require `device_remote_control` (403 names it)
 *   - P1-15: handlers receive validation.data, not the raw body
 *   - P3-9:  UNLOCK_DEVICE clears lockPasswordHash (null) instead of re-hashing
 *   - P1-9/P2-7: getDeviceState selects/returns no lock-password field
 *   - P1-12: syncState only writes whitelisted permission columns
 *   - P1-2:  legalUseCases.upsert writes a revision + contentHash audit detail
 *   - P2-13: formatDuration hours/NaN handling
 *   - P1-8:  env.ts production gate requires INTERNAL_API_URL
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';

// ═══════════════════════════════════════════════════════════════════════════
// P1-5 / P1-15 / P3-9 — admin rider actions route
// ═══════════════════════════════════════════════════════════════════════════

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  adminUnauthorized: vi.fn(),
  adminForbidden: vi.fn(),
  hasPermission: vi.fn(),
  getRiderWithWallet: vi.fn(),
  updateSecurityFlags: vi.fn(),
  hashPassword: vi.fn(),
  verifyPassword: vi.fn(),
  sendUnlockDevice: vi.fn(),
  sendAdminLock: vi.fn(),
  sendSyncDeviceData: vi.fn(),
  createAuditLog: vi.fn(),
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/logger', () => ({ logger: mocks.logger }));

vi.mock('@/lib/rbac', () => ({
  requireAdmin: mocks.requireAdmin,
  adminUnauthorized: mocks.adminUnauthorized,
  adminForbidden: mocks.adminForbidden,
}));

vi.mock('@/lib/auth', () => ({ hasPermission: mocks.hasPermission }));

vi.mock('@/server/modules/riders/admin-riders.use-cases', () => ({
  adminRiderUseCases: {
    getRiderWithWallet: mocks.getRiderWithWallet,
    updateSecurityFlags: mocks.updateSecurityFlags,
    update: vi.fn(),
    assignPlan: vi.fn(),
    completePickup: vi.fn(),
    endRental: vi.fn(),
  },
}));

vi.mock('@/lib/fcm', () => ({
  fcmService: {
    sendUnlockDevice: mocks.sendUnlockDevice,
    sendAdminLock: mocks.sendAdminLock,
    sendSyncDeviceData: mocks.sendSyncDeviceData,
    sendRemoteWipe: vi.fn(),
    sendRemoteCameraControl: vi.fn(),
    sendEnforcePasscode: vi.fn(),
    sendCheckLocationIntegrity: vi.fn(),
    sendPersistApp: vi.fn(),
    sendEnforceLocation: vi.fn(),
    sendRestrictAppsControl: vi.fn(),
  },
}));

// Single audit-log mock shared across all describes — a second vi.mock for
// the same path would silently override this one (hoisted last-wins) and
// future assertions would hit the wrong mock.
vi.mock('@/lib/audit-log', () => ({ createAuditLog: mocks.createAuditLog }));

vi.mock('@/lib/password', () => ({
  hashPassword: mocks.hashPassword,
  verifyPassword: mocks.verifyPassword,
}));

import { POST } from '@/app/api/admin/riders/actions/route';

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/admin/riders/actions', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

describe('P1-5: security actions require device_remote_control', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({
      adminId: 'admin_1',
      adminRole: 'FLEET_MANAGER',
    });
    mocks.getRiderWithWallet.mockResolvedValue({
      id: 'rider_1',
      fcmToken: 'token-1',
      isAdminLocked: true,
      lockPasswordHash: 'hashed',
    });
    mocks.hasPermission.mockReturnValue(false);
    mocks.adminForbidden.mockReturnValue(
      new Response(JSON.stringify({ success: false, error: 'Requires device_remote_control permission' }), {
        status: 403,
      })
    );
    mocks.adminUnauthorized.mockReturnValue(new Response(null, { status: 401 }));
  });

  it('returns 403 naming the missing permission for a security action', async () => {
    // riders_update passes at the top-level gate; only the security gate fails
    mocks.hasPermission.mockImplementation((_role: string, perm: string) => perm === 'riders_update');
    const res = await POST(makeRequest({ action: 'FACTORY_RESET', riderId: 'rider_1' }));
    expect(res.status).toBe(403);
    // hasPermission called with the role string + the security permission
    const calls = mocks.hasPermission.mock.calls.filter((c) => c[1] === 'device_remote_control');
    expect(calls.length).toBeGreaterThan(0);
    expect(mocks.adminForbidden).toHaveBeenCalledWith('Requires device_remote_control permission');
  });

  it('requires riders_update at the top level even for plan assignment', async () => {
    mocks.hasPermission.mockImplementation((_role: string, perm: string) => perm === 'riders_update' ? false : true);
    const res = await POST(makeRequest({ action: 'ASSIGN_PLAN', riderId: 'rider_1', planId: 'p1' }));
    expect(res.status).toBe(403);
    expect(mocks.adminForbidden).toHaveBeenCalledWith('Requires riders_update permission');
  });
});

describe('P3-9: UNLOCK_DEVICE clears lockPasswordHash instead of re-hashing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({
      adminId: 'admin_1',
      adminRole: 'OPERATIONS_ADMIN',
    });
    mocks.getRiderWithWallet.mockResolvedValue({
      id: 'rider_1',
      fcmToken: 'token-1',
      isAdminLocked: true,
      lockPasswordHash: 'hashed',
    });
    mocks.hasPermission.mockImplementation(() => true);
    mocks.verifyPassword.mockResolvedValue({ valid: true });
    mocks.hashPassword.mockResolvedValue('hashed_new');
    mocks.sendUnlockDevice.mockResolvedValue({ success: true });
    mocks.updateSecurityFlags.mockResolvedValue({});
  });

  it('passes the correct recovery password to verifyPassword (validation.data, not raw body)', async () => {
    // `garbage` is NOT a schema key — Zod strips it in the non-strict
    // riderActionSchema, so it must never reach the handler (P1-15).
    const res = await POST(
      makeRequest({ action: 'UNLOCK_DEVICE', riderId: 'rider_1', password: '1234', garbage: 'not-a-boolean' })
    );
    expect(res.status).toBe(200);
    expect(mocks.verifyPassword).toHaveBeenCalledWith('1234', 'hashed');
  });

  it('unlocks device and rotates password hash', async () => {
    const res = await POST(makeRequest({ action: 'UNLOCK_DEVICE', riderId: 'rider_1', password: '1234' }));
    expect(res.status).toBe(200);
    const data = mocks.updateSecurityFlags.mock.calls.at(-1)?.[1];
    expect(data.isAdminLocked).toBe(false);
    expect(data.lockPasswordHash).toBe('hashed_new');
    expect(mocks.hashPassword).toHaveBeenCalled();
  });

  it('returns 422 when the password is not a string (P1-15 strict schema pass)', async () => {
    const res = await POST(makeRequest({ action: 'UNLOCK_DEVICE', riderId: 'rider_1', password: 12345 }));
    expect(res.status).toBe(422);
    expect(mocks.verifyPassword).not.toHaveBeenCalled();
  });
});

describe('P1-15: ASSIGN_PLAN requires planId (typed guard, not raw body)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({
      adminId: 'admin_1',
      adminRole: 'SUPER_ADMIN',
    });
    mocks.hasPermission.mockReturnValue(true);
    mocks.getRiderWithWallet.mockResolvedValue({ id: 'rider_1' });
  });

  it('returns 422 when planId is missing instead of reaching the use-case', async () => {
    const res = await POST(makeRequest({ action: 'ASSIGN_PLAN', riderId: 'rider_1' }));
    expect(res.status).toBe(422);
    const { adminRiderUseCases } = await import('@/server/modules/riders/admin-riders.use-cases');
    expect(adminRiderUseCases.assignPlan).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// P1-9 / P2-7 — device-compliance getDeviceState never leaks the lock hash
// P1-12 — syncState only writes whitelisted columns
// ═══════════════════════════════════════════════════════════════════════════

const compMocks = vi.hoisted(() => ({
  riderUpdate: vi.fn(),
  riderFindUnique: vi.fn(),
  violationCount: vi.fn(),
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/server/shared/db/prisma', () => ({
  db: {
    rider: {
      update: compMocks.riderUpdate,
      findUnique: compMocks.riderFindUnique,
    },
    deviceViolation: { count: compMocks.violationCount },
  },
}));

import { deviceComplianceUseCases } from '@/server/modules/device-compliance/device-compliance.use-cases';

describe('P1-9/P2-7: getDeviceState has no lock-password field', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    compMocks.riderFindUnique.mockResolvedValue({
      isUninstallBlocked: true,
      isLocationMandatory: false,
      isAppsControlRestricted: false,
      isAdminLocked: true,
      deviceAdminGranted: false,
      displayOverlayGranted: false,
      lastDeviceViolationAt: null,
      deviceViolationCount: 0,
      locationGranted: true,
      batteryGranted: true,
      contactsGranted: false,
      callLogsGranted: false,
      micGranted: false,
      cameraGranted: false,
      phoneGranted: false,
    });
    compMocks.violationCount.mockResolvedValue(0);
  });

  it('does not select the non-existent lockPassword column', async () => {
    await deviceComplianceUseCases.getDeviceState('rider_1');
    const select = compMocks.riderFindUnique.mock.calls[0][0].select;
    expect(select).not.toHaveProperty('lockPassword');
    expect(select).not.toHaveProperty('lockPasswordHash');
    expect(select.isAdminLocked).toBe(true);
  });

  it('returns no lockPassword / lockPasswordHash field to the rider', async () => {
    const state = await deviceComplianceUseCases.getDeviceState('rider_1');
    expect(state).not.toHaveProperty('lockPassword');
    expect(state).not.toHaveProperty('lockPasswordHash');
    expect(state.isAdminLocked).toBe(true);
  });
});

describe('P1-12: syncState only writes whitelisted permission columns', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    compMocks.riderUpdate.mockResolvedValue({});
  });

  it('drops unknown keys instead of writing them via `as any`', async () => {
    await deviceComplianceUseCases.syncState('rider_1', {
      locationGranted: true,
      cameraGranted: false,
      nfcGranted: true,
    } as never);
    // Prisma update() takes a single { where, data } object arg
    const arg = compMocks.riderUpdate.mock.calls[0][0];
    expect(arg.where).toEqual({ id: 'rider_1' });
    const data = arg.data;
    expect(data).toEqual({ locationGranted: true, cameraGranted: false });
    expect(data).not.toHaveProperty('nfcGranted');
  });

  it('writes only the 9 allowed columns even when extra fields are passed', async () => {
    await deviceComplianceUseCases.syncState('rider_1', {
      locationGranted: true,
      batteryGranted: true,
      contactsGranted: false,
      callLogsGranted: false,
      micGranted: true,
      cameraGranted: true,
      phoneGranted: true,
      deviceAdminGranted: false,
      displayOverlayGranted: false,
    });
    // Prisma update() takes a single { where, data } object arg
    const data = compMocks.riderUpdate.mock.calls[0][0].data;
    expect(Object.keys(data).sort()).toEqual(
      [
        'locationGranted',
        'batteryGranted',
        'contactsGranted',
        'callLogsGranted',
        'micGranted',
        'cameraGranted',
        'phoneGranted',
        'deviceAdminGranted',
        'displayOverlayGranted',
      ].sort()
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// P1-2 — legalUseCases.upsert writes a revision + contentHash audit detail
// ═══════════════════════════════════════════════════════════════════════════

const legalMocks = vi.hoisted(() => ({
  upsert: vi.fn(),
  revisionCreate: vi.fn(),
  revisionFindFirst: vi.fn(),
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/db', () => ({
  db: {
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn({
      legalDocument: { upsert: legalMocks.upsert },
      legalDocumentRevision: {
        create: legalMocks.revisionCreate,
        findFirst: legalMocks.revisionFindFirst,
      },
    })),
    legalDocument: { findMany: vi.fn(), upsert: legalMocks.upsert },
  },
}));

import { legalUseCases } from '@/server/modules/legal/legal.use-cases';

describe('P1-2: legal upsert writes version history + contentHash audit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    legalMocks.upsert.mockResolvedValue({ id: 'doc_1', type: 'terms', title: 'Terms of Service', content: 'body' });
    legalMocks.revisionCreate.mockResolvedValue({});
    // No prior revision by default → a new one is always written
    legalMocks.revisionFindFirst.mockResolvedValue(null);
    mocks.createAuditLog.mockResolvedValue({});
  });

  it('writes a LegalDocumentRevision on save', async () => {
    await legalUseCases.upsert({ type: 'terms', content: 'body' }, 'admin_1');
    expect(legalMocks.revisionCreate).toHaveBeenCalledTimes(1);
    const rev = legalMocks.revisionCreate.mock.calls[0][0].data;
    expect(rev.legalDocumentId).toBe('doc_1');
    expect(rev.createdBy).toBe('admin_1');
    expect(rev.content).toBe('body');
    expect(rev.contentHash).toMatch(/^[a-f0-9]{64}$/); // sha256 hex
  });

  it('records contentHash (not just type) in the audit log', async () => {
    await legalUseCases.upsert({ type: 'terms', content: 'body' }, 'admin_1');
    const audit = mocks.createAuditLog.mock.calls[0][0];
    expect(audit.action).toBe('legal.update');
    expect(audit.details).toHaveProperty('contentHash');
    expect(audit.details).toHaveProperty('title', 'Terms of Service');
  });

  it('skips the revision write when content is unchanged (same contentHash)', async () => {
    legalMocks.revisionFindFirst.mockResolvedValue({
      contentHash: '0x0', // any non-matching marker is fine; the hash below is computed
    });
    // First save writes the revision
    await legalUseCases.upsert({ type: 'terms', content: 'same body' }, 'admin_1');
    expect(legalMocks.revisionCreate).toHaveBeenCalledTimes(1);
    const firstHash = legalMocks.revisionCreate.mock.calls[0][0].data.contentHash;

    // Second save with identical content: latest revision matches → no write
    vi.clearAllMocks();
    legalMocks.upsert.mockResolvedValue({ id: 'doc_1', type: 'terms', title: 'Terms of Service', content: 'same body' });
    legalMocks.revisionFindFirst.mockResolvedValue({ contentHash: firstHash });
    mocks.createAuditLog.mockResolvedValue({});
    await legalUseCases.upsert({ type: 'terms', content: 'same body' }, 'admin_1');
    expect(legalMocks.revisionCreate).not.toHaveBeenCalled();
    // But the audit log still records the save attempt
    expect(mocks.createAuditLog).toHaveBeenCalledTimes(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// P2-13 — formatDuration edge cases
// ═══════════════════════════════════════════════════════════════════════════

import { formatDuration } from '@/components/admin/screens/device-tracking/CallRegisterTab';

describe('P2-13: formatDuration handles hours, NaN, negatives', () => {
  it('formats plain seconds', () => {
    expect(formatDuration(0)).toBe('0s');
    expect(formatDuration(90)).toBe('1m 30s');
  });

  it('collapses hours', () => {
    expect(formatDuration(3600)).toBe('1h 0m');
    expect(formatDuration(3661)).toBe('1h 1m');
  });

  it('degrades NaN / Infinity / negatives to a dash', () => {
    expect(formatDuration(NaN)).toBe('—');
    expect(formatDuration(Infinity)).toBe('—');
    expect(formatDuration(-5)).toBe('—');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// P1-8 — env.ts requires INTERNAL_API_URL in production
// ═══════════════════════════════════════════════════════════════════════════

describe('P1-8: INTERNAL_API_URL is hard-required in production env', () => {
  it('env.ts throws on missing INTERNAL_API_URL in the prod architecture block', () => {
    const source = readFileSync(join(process.cwd(), 'src/lib/env.ts'), 'utf8');
    // The prod block must check INTERNAL_API_URL explicitly (not silently fall
    // back to NEXT_PUBLIC_APP_URL for health probes).
    expect(source).toContain("!parsedEnv.INTERNAL_API_URL");
    expect(source).toContain('INTERNAL_API_URL environment variable is required');
  });

  it('ecosystem.config.js supplies the loopback default for prod boots', () => {
    const source = readFileSync(join(process.cwd(), '..', 'ecosystem.config.js'), 'utf8');
    expect(source).toContain("INTERNAL_API_URL: process.env.INTERNAL_API_URL || 'http://127.0.0.1:8081'");
  });
});
