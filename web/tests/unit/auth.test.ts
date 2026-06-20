/**
 * Auth Module — Unit Tests
 *
 * Covers:
 *   - createSessionToken (valid, missing fields)
 *   - verifySessionToken (valid, expired, tampered, malformed, null)
 *   - hasPermission (role-based, session-based, overrides, edge cases)
 *   - getPermissionsForRole (SUPER_ADMIN, READ_ONLY, other roles, unknown)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createSessionToken,
  verifySessionToken,
  hasPermission,
  getPermissionsForRole,
  ADMIN_ROLES,
  SESSION_COOKIE_OPTIONS,
  PERMISSIONS,
} from '../../src/lib/auth';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const validPayload = {
  riderId: 'VF-RD-TEST1234',
  riderDbId: 'db-id-456',
  phone: '9876543210',
  role: 'rider',
};

const adminPayload = {
  riderId: 'VF-AD-MGR789',
  riderDbId: 'db-id-789',
  phone: '9876543211',
  role: 'admin',
  adminRole: 'SUPER_ADMIN',
  adminId: 'admin-001',
  adminPermissions: ['riders_view', 'riders_update', 'kyc_view'],
};

// ---------------------------------------------------------------------------
// createSessionToken
// ---------------------------------------------------------------------------

describe('createSessionToken', () => {
  it('creates a valid JWT with 3 dot-separated parts', () => {
    const token = createSessionToken(validPayload);
    expect(token).toBeDefined();
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3);
  });

  it('uses base64url-encoded header and payload', () => {
    const token = createSessionToken(validPayload);
    const [header, payload] = token.split('.');

    // Should decode without errors
    const decodedHeader = JSON.parse(Buffer.from(header, 'base64url').toString());
    expect(decodedHeader).toEqual({ alg: 'HS256', typ: 'JWT' });

    const decodedPayload = JSON.parse(Buffer.from(payload, 'base64url').toString());
    expect(decodedPayload.riderId).toBe(validPayload.riderId);
    expect(decodedPayload.phone).toBe(validPayload.phone);
  });

  it('includes iat (issued at) and exp (expiry) claims', () => {
    const before = Date.now();
    const token = createSessionToken(validPayload);
    const after = Date.now();
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());

    expect(payload.iat).toBeGreaterThanOrEqual(before);
    expect(payload.iat).toBeLessThanOrEqual(after);
    expect(payload.exp).toBe(payload.iat + SESSION_COOKIE_OPTIONS.maxAge * 1000);
  });

  it('includes all provided fields in the payload', () => {
    const token = createSessionToken(adminPayload);
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());

    expect(payload.adminRole).toBe('SUPER_ADMIN');
    expect(payload.adminId).toBe('admin-001');
    expect(payload.adminPermissions).toEqual(['riders_view', 'riders_update', 'kyc_view']);
  });

  it('throws if riderId is missing', () => {
    const { riderId: _, ...incomplete } = validPayload;
    expect(() => createSessionToken(incomplete as any)).toThrow('Invalid payload');
  });

  it('throws if riderDbId is missing', () => {
    const { riderDbId: _, ...incomplete } = validPayload;
    expect(() => createSessionToken(incomplete as any)).toThrow('Invalid payload');
  });

  it('throws if phone is missing', () => {
    const { phone: _, ...incomplete } = validPayload;
    expect(() => createSessionToken(incomplete as any)).toThrow('Invalid payload');
  });

  it('throws on empty strings for required fields', () => {
    expect(() =>
      createSessionToken({ riderId: '', riderDbId: 'db-1', phone: '1234567890', role: 'rider' })
    ).toThrow('Invalid payload');
  });
});

// ---------------------------------------------------------------------------
// verifySessionToken
// ---------------------------------------------------------------------------

describe('verifySessionToken', () => {
  it('verifies a valid token and returns the payload', async () => {
    const token = createSessionToken(validPayload);
    const decoded = await verifySessionToken(token);

    expect(decoded).not.toBeNull();
    expect(decoded?.riderId).toBe(validPayload.riderId);
    expect(decoded?.riderDbId).toBe(validPayload.riderDbId);
    expect(decoded?.phone).toBe(validPayload.phone);
    expect(decoded?.role).toBe(validPayload.role);
  });

  it('verifies a token with admin fields and returns them', async () => {
    const token = createSessionToken(adminPayload);
    const decoded = await verifySessionToken(token);

    expect(decoded?.adminRole).toBe('SUPER_ADMIN');
    expect(decoded?.adminId).toBe('admin-001');
    expect(decoded?.adminPermissions).toEqual(['riders_view', 'riders_update', 'kyc_view']);
  });

  it('returns null for a tampered token (modified signature)', async () => {
    const token = createSessionToken(validPayload);
    const parts = token.split('.');
    const tampered = `${parts[0]}.${parts[1]}.invalidsignature`;

    const decoded = await verifySessionToken(tampered);
    expect(decoded).toBeNull();
  });

  it('returns null for a tampered token (modified payload)', async () => {
    const token = createSessionToken(validPayload);
    const parts = token.split('.');
    // Modify the payload to change riderId, then re-encode
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    payload.riderId = 'different-rider';
    const tamperedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const tampered = `${parts[0]}.${tamperedPayload}.${parts[2]}`;

    const decoded = await verifySessionToken(tampered);
    expect(decoded).toBeNull();
  });

  it('returns null for an expired token', async () => {
    // Create a token with exp in the past by manipulating time
    const pastPayload = {
      ...validPayload,
      iat: Date.now() - 10_000,
      exp: Date.now() - 1_000, // expired 1 second ago
    };
    // Manually craft an expired token
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify(pastPayload)).toString('base64url');

    // Need the correct secret to sign
    const crypto = await import('crypto');
    const { env } = await import('../../src/lib/env');
    const signature = crypto
      .createHmac('sha256', env.JWT_SECRET)
      .update(`${header}.${payload}`)
      .digest('base64url');

    const expiredToken = `${header}.${payload}.${signature}`;
    const decoded = await verifySessionToken(expiredToken);
    expect(decoded).toBeNull();
  });

  it('returns null for a token with fewer than 3 parts', async () => {
    expect(await verifySessionToken('header.payload')).toBeNull();
    expect(await verifySessionToken('header')).toBeNull();
    expect(await verifySessionToken('')).toBeNull();
  });

  it('returns null for a token with more than 3 parts', async () => {
    expect(await verifySessionToken('a.b.c.d')).toBeNull();
  });

  it('returns null for null input', async () => {
    expect(await verifySessionToken(null as any)).toBeNull();
  });

  it('returns null for undefined input', async () => {
    expect(await verifySessionToken(undefined as any)).toBeNull();
  });

  it('returns null for non-string input', async () => {
    expect(await verifySessionToken(123 as any)).toBeNull();
    expect(await verifySessionToken({} as any)).toBeNull();
    expect(await verifySessionToken([] as any)).toBeNull();
  });

  it('returns null for token with invalid base64url header', async () => {
    const token = createSessionToken(validPayload);
    const parts = token.split('.');
    const badToken = `not!valid!base64url!!!.${parts[1]}.${parts[2]}`;
    expect(await verifySessionToken(badToken)).toBeNull();
  });

  it('returns null when decoded payload is missing required fields', async () => {
    const { env } = await import('../../src/lib/env');
    const crypto = await import('crypto');

    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    // Missing riderId
    const payload = Buffer.from(
      JSON.stringify({
        phone: '123',
        riderDbId: 'db-1',
        role: 'rider',
        iat: Date.now(),
        exp: Date.now() + 10000,
      })
    ).toString('base64url');
    const signature = crypto
      .createHmac('sha256', env.JWT_SECRET)
      .update(`${header}.${payload}`)
      .digest('base64url');

    expect(await verifySessionToken(`${header}.${payload}.${signature}`)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// hasPermission — role-based
// ---------------------------------------------------------------------------

describe('hasPermission (role-based)', () => {
  it('SUPER_ADMIN returns true for any valid permission', () => {
    expect(hasPermission('SUPER_ADMIN', 'riders_delete')).toBe(true);
    expect(hasPermission('SUPER_ADMIN', 'settings_manage')).toBe(true);
    expect(hasPermission('SUPER_ADMIN', 'kyc_approve')).toBe(true);
    expect(hasPermission('SUPER_ADMIN', 'data_management_restore')).toBe(true);
  });

  it('returns true when the role has the permission', () => {
    expect(hasPermission('KYC_REVIEWER', 'kyc_approve')).toBe(true);
    expect(hasPermission('FINANCE_ADMIN', 'transactions_view')).toBe(true);
    expect(hasPermission('SUPPORT_AGENT', 'tickets_resolve')).toBe(true);
    expect(hasPermission('TEAM_LEADER', 'rentals_pickup_inspection')).toBe(true);
    expect(hasPermission('HUB_MANAGER', 'hubs_manage')).toBe(true);
    expect(hasPermission('FLEET_MANAGER', 'vehicles_create')).toBe(true);
    expect(hasPermission('READ_ONLY', 'data_management_view')).toBe(true);
  });

  it('returns false when the role does not have the permission', () => {
    expect(hasPermission('TEAM_LEADER', 'riders_delete')).toBe(false);
    expect(hasPermission('KYC_REVIEWER', 'transactions_approve')).toBe(false);
    expect(hasPermission('SUPPORT_AGENT', 'kyc_approve')).toBe(false);
    expect(hasPermission('FINANCE_ADMIN', 'hubs_manage')).toBe(false);
    expect(hasPermission('READ_ONLY', 'riders_delete')).toBe(false);
    expect(hasPermission('HUB_MANAGER', 'admins_manage')).toBe(false);
  });

  it('returns false for unknown/nonexistent permissions', () => {
    expect(hasPermission('SUPER_ADMIN', 'non_existent_perm' as any)).toBe(false);
    expect(hasPermission('OPERATIONS_ADMIN', 'made_up_perm' as any)).toBe(false);
    expect(hasPermission('READ_ONLY', '' as any)).toBe(false);
  });

  it('returns false for empty string role', () => {
    expect(hasPermission('', 'riders_view')).toBe(false);
  });

  it('returns false for unknown role string', () => {
    expect(hasPermission('NONEXISTENT_ROLE', 'riders_view')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// hasPermission — session/object-based
// ---------------------------------------------------------------------------

describe('hasPermission (session-based)', () => {
  it('SUPER_ADMIN via session returns true for any permission', () => {
    const session = {
      adminRole: 'SUPER_ADMIN',
      role: 'admin',
      riderId: 'x',
      riderDbId: 'x',
      phone: 'x',
    };
    expect(hasPermission(session, 'kyc_approve')).toBe(true);
    expect(hasPermission(session, 'admins_manage')).toBe(true);
    expect(hasPermission(session, 'settings_manage')).toBe(true);
  });

  it('checks adminPermissions overrides when present', () => {
    const session = {
      adminRole: 'KYC_REVIEWER',
      adminPermissions: ['kyc_view', 'kyc_approve', 'riders_view'],
      role: 'admin',
      riderId: 'x',
      riderDbId: 'x',
      phone: 'x',
    };
    expect(hasPermission(session, 'kyc_approve')).toBe(true); // in overrides
    expect(hasPermission(session, 'kyc_view')).toBe(true); // in overrides
    expect(hasPermission(session, 'transactions_view')).toBe(false); // not in overrides
  });

  it('falls back to role-based check when adminPermissions is empty', () => {
    const session = {
      adminRole: 'KYC_REVIEWER',
      adminPermissions: [],
      role: 'admin',
      riderId: 'x',
      riderDbId: 'x',
      phone: 'x',
    };
    expect(hasPermission(session, 'kyc_approve')).toBe(true); // from role
    expect(hasPermission(session, 'transactions_view')).toBe(false);
  });

  it('falls back to role-based check when adminPermissions is undefined', () => {
    const session = {
      adminRole: 'SUPPORT_AGENT',
      role: 'admin',
      riderId: 'x',
      riderDbId: 'x',
      phone: 'x',
    };
    expect(hasPermission(session, 'tickets_resolve')).toBe(true);
    expect(hasPermission(session, 'kyc_approve')).toBe(false);
  });

  it('uses session.role when adminRole is not set', () => {
    const session = {
      role: 'FINANCE_ADMIN',
      riderId: 'x',
      riderDbId: 'x',
      phone: 'x',
    };
    expect(hasPermission(session, 'transactions_view')).toBe(true);
    expect(hasPermission(session, 'hubs_manage')).toBe(false);
  });

  it('uses session.permissions (legacy key) as override', () => {
    const session = {
      role: 'rider',
      permissions: ['riders_view'],
      riderId: 'x',
      riderDbId: 'x',
      phone: 'x',
    };
    expect(hasPermission(session, 'riders_view')).toBe(true);
    expect(hasPermission(session, 'kyc_view')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getPermissionsForRole
// ---------------------------------------------------------------------------

describe('getPermissionsForRole', () => {
  it('SUPER_ADMIN returns all permission keys', () => {
    const perms = getPermissionsForRole('SUPER_ADMIN');
    const allKeys = Object.keys(PERMISSIONS);
    expect(perms).toEqual(allKeys);
    expect(perms.length).toBeGreaterThan(40);
  });

  it('READ_ONLY returns only data_management_view', () => {
    const perms = getPermissionsForRole('READ_ONLY');
    expect(perms).toEqual(['data_management_view']);
  });

  it('TEAM_LEADER has expected permissions', () => {
    const perms = getPermissionsForRole('TEAM_LEADER');
    expect(perms).toContain('riders_view');
    expect(perms).toContain('kyc_view');
    expect(perms).toContain('rentals_pickup_inspection');
    expect(perms).toContain('rentals_return_inspection');
    expect(perms).toContain('vehicles_inspect');
    expect(perms).not.toContain('riders_delete');
    expect(perms).not.toContain('kyc_approve');
    expect(perms).not.toContain('settings_manage');
  });

  it('KYC_REVIEWER has KYC-specific permissions but not finance ones', () => {
    const perms = getPermissionsForRole('KYC_REVIEWER');
    expect(perms).toContain('kyc_view');
    expect(perms).toContain('kyc_approve');
    expect(perms).toContain('kyc_reject');
    expect(perms).not.toContain('transactions_view');
    expect(perms).not.toContain('tickets_manage');
  });

  it('FINANCE_ADMIN has finance permissions but not KYC approval', () => {
    const perms = getPermissionsForRole('FINANCE_ADMIN');
    expect(perms).toContain('transactions_view');
    expect(perms).toContain('transactions_approve');
    expect(perms).toContain('transactions_manage');
    expect(perms).not.toContain('kyc_approve');
    expect(perms).not.toContain('riders_delete');
  });

  it('returns empty array for unknown roles', () => {
    const perms = getPermissionsForRole('NONEXISTENT_ROLE' as any);
    expect(perms).toEqual([]);
  });

  it('returns empty array for empty string', () => {
    const perms = getPermissionsForRole('');
    expect(perms).toEqual([]);
  });

  it('all ADMIN_ROLES are covered by getPermissionsForRole without errors', () => {
    for (const role of ADMIN_ROLES) {
      const perms = getPermissionsForRole(role);
      expect(Array.isArray(perms)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe('auth constants', () => {
  it('ADMIN_ROLES contains all expected roles', () => {
    expect(ADMIN_ROLES).toContain('SUPER_ADMIN');
    expect(ADMIN_ROLES).toContain('OPERATIONS_ADMIN');
    expect(ADMIN_ROLES).toContain('KYC_REVIEWER');
    expect(ADMIN_ROLES).toContain('FINANCE_ADMIN');
    expect(ADMIN_ROLES).toContain('SUPPORT_AGENT');
    expect(ADMIN_ROLES).toContain('HUB_MANAGER');
    expect(ADMIN_ROLES).toContain('FLEET_MANAGER');
    expect(ADMIN_ROLES).toContain('TEAM_LEADER');
    expect(ADMIN_ROLES).toContain('READ_ONLY');
    expect(ADMIN_ROLES).toHaveLength(9);
  });

  it('SESSION_COOKIE_OPTIONS has expected defaults', () => {
    expect(SESSION_COOKIE_OPTIONS.httpOnly).toBe(true);
    expect(SESSION_COOKIE_OPTIONS.sameSite).toBe('strict');
    expect(SESSION_COOKIE_OPTIONS.path).toBe('/');
    expect(SESSION_COOKIE_OPTIONS.maxAge).toBe(7 * 24 * 60 * 60); // 7 days in seconds
  });
});
