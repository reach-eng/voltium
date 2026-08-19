/**
 * TG (2026-08-05 legal/device audit) — P0-2: ADMIN_LOCK generates a
 * 12-digit NUMERIC password (generateNumericPassword), matching the UI copy
 * ("12-digit numeric password") and the rider's numeric keypad lock screen.
 * The old code used generateRandomPassword(12).toUpperCase() which produced
 * alphanumeric codes that could never be entered.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  adminUnauthorized: vi.fn(),
  adminForbidden: vi.fn(),
  hasPermission: vi.fn(),
  getRiderWithWallet: vi.fn(),
  updateSecurityFlags: vi.fn(),
  hashPassword: vi.fn(),
  sendAdminLock: vi.fn(),
  sendUnlockDevice: vi.fn(),
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
  },
}));

vi.mock('@/lib/fcm', () => ({
  fcmService: {
    sendAdminLock: mocks.sendAdminLock,
    sendUnlockDevice: mocks.sendUnlockDevice,
    sendRemoteWipe: vi.fn(),
    sendSyncDeviceData: vi.fn(),
    sendRemoteCameraControl: vi.fn(),
    sendEnforcePasscode: vi.fn(),
    sendCheckLocationIntegrity: vi.fn(),
    sendPersistApp: vi.fn(),
    sendEnforceLocation: vi.fn(),
    sendRestrictAppsControl: vi.fn(),
  },
}));

vi.mock('@/lib/audit-log', () => ({ createAuditLog: mocks.createAuditLog }));

vi.mock('@/lib/password', () => ({
  hashPassword: mocks.hashPassword,
  verifyPassword: vi.fn(),
}));

import { POST } from '@/app/api/admin/riders/actions/route';

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/admin/riders/actions', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

describe('P0-2: ADMIN_LOCK generates a 12-digit numeric unlock code', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({
      adminId: 'admin_1',
      adminRole: 'OPERATIONS_ADMIN',
    });
    mocks.hasPermission.mockReturnValue(true);
    mocks.getRiderWithWallet.mockResolvedValue({
      id: 'rider_1',
      fcmToken: 'fcm-token',
    });
    mocks.updateSecurityFlags.mockResolvedValue({});
    mocks.hashPassword.mockResolvedValue('hashed-numeric');
    mocks.sendAdminLock.mockResolvedValue({ success: true });
  });

  it('returns a numeric-only unlock code of exactly 12 digits', async () => {
    const res = await POST(makeRequest({ action: 'ADMIN_LOCK', riderId: 'rider_1' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.unlockCode).toMatch(/^\d{12}$/);
  });

  it('stores the hash of the numeric code in lockPasswordHash', async () => {
    await POST(makeRequest({ action: 'ADMIN_LOCK', riderId: 'rider_1' }));

    // updateSecurityFlags receives the DB update object
    const updateCall = mocks.updateSecurityFlags.mock.calls[0];
    expect(updateCall[0]).toBe('rider_1');
    const updateData = updateCall[1] as Record<string, unknown>;
    expect(updateData.isAdminLocked).toBe(true);
    expect(typeof updateData.lockPasswordHash).toBe('string');

    // The hashed value is the hash of a 12-digit numeric string
    const hashedValue = updateData.lockPasswordHash as string;
    expect(hashedValue).toBe('hashed-numeric');
    expect(mocks.hashPassword.mock.calls[0][0]).toMatch(/^\d{12}$/);
  });

  it('still returns 200 and triggers the FCM lock signal when the rider has a token', async () => {
    const res = await POST(makeRequest({ action: 'ADMIN_LOCK', riderId: 'rider_1' }));
    expect(res.status).toBe(200);
    expect(mocks.sendAdminLock).toHaveBeenCalledWith('fcm-token');
  });
});
