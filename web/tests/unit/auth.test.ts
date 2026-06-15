import { createSessionToken, verifySessionToken, hasPermission } from '../../src/lib/auth';

describe('Phase 1: Auth Contract Testing (JWT & RBAC)', () => {
  const mockPayload = {
    riderId: 'test-rider-123',
    riderDbId: 'db-id-123',
    phone: '9876543210',
    role: 'rider',
  };

  test('should create a valid JWT with payload', async () => {
    const token = createSessionToken(mockPayload);
    expect(token).toBeDefined();
    expect(token.split('.')).toHaveLength(3);
  });

  test('should verify a valid token and return payload', async () => {
    const token = createSessionToken(mockPayload);
    const decoded = await verifySessionToken(token);
    expect(decoded).not.toBeNull();
    expect(decoded?.riderId).toBe(mockPayload.riderId);
    expect(decoded?.phone).toBe(mockPayload.phone);
  });

  test('should return null for tampered tokens', async () => {
    const token = createSessionToken(mockPayload);
    const tamperedToken = token.substring(0, token.length - 5) + 'xxxxx';
    const decoded = await verifySessionToken(tamperedToken);
    expect(decoded).toBeNull();
  });

  test('should correctly check admin permissions', () => {
    expect(hasPermission('SUPER_ADMIN', 'riders_delete')).toBe(true);
    expect(hasPermission('TEAM_LEADER', 'riders_delete')).toBe(false);
    expect(hasPermission('MANAGER', 'transactions_view')).toBe(true);
    expect(hasPermission('TEAM_LEADER', 'kyc_approve')).toBe(true);
  });

  test('should fail for unknown permissions', () => {
    expect(hasPermission('SUPER_ADMIN', 'non_existent_permission' as any)).toBe(false);
  });
});
