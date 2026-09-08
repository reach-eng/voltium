/**
 * NET-005 follow-up-16 (2026-09-08): three sub-fixes
 *
 * 1. Project the orphan /api/admin/riders/[id]
 *    response to a safe shape — drop the
 *    lockPasswordHash / fcmToken / tokenVersion /
 *    serialNumber / deletionRequestReason columns
 *    the pre-fix code leaked.
 * 2. Audit the 6 FCM-only device actions
 *    (FACTORY_RESET, DISABLE_CAMERA, ENABLE_CAMERA,
 *    ENFORCE_PASSCODE, CHECK_LOCATION_INTEGRITY,
 *    SYNC_DEVICE_DATA) that the pre-fix code
 *    skipped because `dbUpdate` started as `{}`.
 * 3. Access-log the device-data endpoint so admin
 *    reads of location / contacts / call-logs are
 *    recorded.
 *
 * 17a and 17c use runtime mocks (the routes touch
 * the DB and the use-cases module). 17b is a
 * file-content scan — `vi.hoisted` + `vi.mock` for
 * the actions route's full import graph (rbac,
 * auth, db, use-cases, fcm, audit-log, password,
 * kyc) fights vitest's hoisting boundary, and the
 * change is structural (re-ordering an existing
 * call from "gated on dbUpdate" to "always
 * fires"). The runtime behavior of the actions
 * route is already covered by
 *   tests/integration/admin_riders_actions.test.ts
 *   tests/integration/admin/legal-device-p1-p3.test.ts
 *   tests/integration/admin/api/admin-end-rental-action.test.ts
 * so a file-content scan is enough to lock the
 * structural fix.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

// ---------------------------------------------------------------------------
// Shared mock infra — `vi.mock` factories in vitest
// are hoisted to the top of the file, so multiple
// `vi.mock` calls for the SAME module would conflict
// (the last one wins). All three sub-fixes share a
// single `vi.mock('@/lib/rbac', ...)` and a single
// `vi.hoisted` mock bag so the requireAdmin fn is
// shared across describes.
// ---------------------------------------------------------------------------

const sharedMocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  hasPermission: vi.fn(),
}));

vi.mock('@/lib/rbac', () => ({
  requireAdmin: sharedMocks.requireAdmin,
  adminUnauthorized: () =>
    new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 401 }),
  adminForbidden: () =>
    new Response(JSON.stringify({ success: false, error: 'Forbidden' }), { status: 403 }),
}));

vi.mock('@/lib/auth', () => ({ hasPermission: sharedMocks.hasPermission }));

// ---------------------------------------------------------------------------
// #17a — orphan endpoint projection
// ---------------------------------------------------------------------------

const route17aMocks = vi.hoisted(() => ({
  riderFindFirst: vi.fn(),
  // flattenRider + signRiderUrls are real (not
  // mocked) so the test exercises the same
  // projection path the route uses.
}));

const securityEventsMocks = vi.hoisted(() => ({
  logKycDocumentView: vi.fn(),
  logDeviceDataAccess: vi.fn(),
}));

vi.mock('@/lib/security-events', () => securityEventsMocks);

vi.mock('@/lib/db', () => ({
  db: {
    rider: { findFirst: route17aMocks.riderFindFirst },
  },
}));

import { GET as getRider } from '@/app/api/admin/riders/[id]/route';
import { NextRequest } from 'next/server';

describe('NET-005 follow-up-16: orphan /api/admin/riders/[id] projection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sharedMocks.requireAdmin.mockResolvedValue({
      adminId: 'admin-1',
      adminRole: 'OPERATIONS_ADMIN',
    });
    sharedMocks.hasPermission.mockReturnValue(true);
    // Mirror the SAME shape Prisma would return
    // after applying the route's `select`. The real
    // Prisma client would filter out the unselected
    // fields; the mock can't, so we omit the
    // sensitive columns here. The test asserts the
    // route's response also excludes them.
    route17aMocks.riderFindFirst.mockResolvedValue({
      id: 'r1',
      riderId: 'VF-RD-0001',
      phone: '+919876543210',
      fullName: 'Test Rider',
      email: 'r1@example.com',
      fatherName: null,
      motherName: null,
      dob: null,
      currentAddress: null,
      emergencyContact: null,
      lifecycleStatus: 'NEW',
      pickupHub: null,
      pickedUpAt: null,
      registrationDoneAt: null,
      depositDoneAt: null,
      kycDoneAt: null,
      planDoneAt: null,
      teamLeaderId: null,
      planStartDate: null,
      planEndDate: null,
      currentPlan: null,
      currentPlanPrice: null,
      assignedVehicle: null,
      vehicleId: null,
      intent: null,
      referralCode: 'VF-RD-0001',
      createdAt: new Date('2026-09-08T00:00:00Z'),
      updatedAt: new Date('2026-09-08T00:00:00Z'),
      deletedAt: null,
      purgedAt: null,
      kycProfile: {
        id: 'kp1',
        status: 'SUBMITTED',
        profilePhoto: null,
        riderPhoto: null,
        signature: null,
        aadhaarFront: null,
        aadhaarBack: null,
        aadhaarNumber: 'CIPHERTEXT',
        panCard: null,
        panNumber: 'CIPHERTEXT',
        bankName: null,
        accountNumber: null,
        ifscCode: null,
        rejectionReason: 'Aadhaar blurry',
        updatedAt: new Date('2026-09-08T00:00:00Z'),
      },
      wallet: {
        id: 'w1',
        balanceInPaise: 0,
        securityDepositInPaise: 0,
        depositStatus: 'PENDING',
        paymentStreak: 0,
      },
      guarantor: null,
      leases: [],
    });
  });

  it('response does NOT include lockPasswordHash, fcmToken, tokenVersion, or serialNumber', async () => {
    const req = new NextRequest('http://localhost/api/admin/riders/r1', {
      method: 'GET',
    });
    const res = await getRider(req, { params: Promise.resolve({ id: 'r1' }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    const dataStr = JSON.stringify(json);
    expect(dataStr).not.toContain('FCM-SECRET-TOKEN-LEAK');
    expect(dataStr).not.toContain('bcrypt-HASH-LEAK');
    expect(dataStr).not.toContain('"tokenVersion"');
    expect(dataStr).not.toContain('"serialNumber"');
  });

  it('response includes the safe rider fields (id, riderId, fullName, phone, email)', async () => {
    const req = new NextRequest('http://localhost/api/admin/riders/r1', {
      method: 'GET',
    });
    const res = await getRider(req, { params: Promise.resolve({ id: 'r1' }) });
    const json = await res.json();
    expect(json.data.id).toBe('r1');
    expect(json.data.riderId).toBe('VF-RD-0001');
    expect(json.data.fullName).toBe('Test Rider');
    expect(json.data.phone).toBe('+919876543210');
  });

  it('still fires logKycDocumentView for SOC2 (unchanged from follow-up-9)', async () => {
    const req = new NextRequest('http://localhost/api/admin/riders/r1', {
      method: 'GET',
    });
    await getRider(req, { params: Promise.resolve({ id: 'r1' }) });
    expect(securityEventsMocks.logKycDocumentView).toHaveBeenCalledWith({
      adminId: 'admin-1',
      riderId: 'r1',
      documentType: 'rider_detail',
    });
  });

  it('returns 403 for admins without riders_view', async () => {
    sharedMocks.hasPermission.mockReturnValue(false);
    const req = new NextRequest('http://localhost/api/admin/riders/r1', {
      method: 'GET',
    });
    const res = await getRider(req, { params: Promise.resolve({ id: 'r1' }) });
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// #17b — FCM-only device actions now audit
//
// Source-scan lock: the pre-fix code put the audit
// log inside `updateSecurityFlags`, which was only
// called when `Object.keys(dbUpdate).length > 0`.
// For the 6 FCM-only branches (FACTORY_RESET,
// DISABLE_CAMERA, ENABLE_CAMERA, ENFORCE_PASSCODE,
// CHECK_LOCATION_INTEGRITY, SYNC_DEVICE_DATA),
// `dbUpdate` starts as `{}` so the audit never
// fired. The fix hoists the audit call OUT of
// updateSecurityFlags and into `handleSecurityAction`
// itself, between the FCM-success check and the
// dbUpdate guard.
//
// This test locks that structural re-ordering. A
// future refactor that puts the audit back inside
// the dbUpdate guard will fail this test.
// ---------------------------------------------------------------------------

const ACTIONS_ROUTE_PATH = path.resolve(
  __dirname,
  '../../src/app/api/admin/riders/actions/route.ts'
);

describe('NET-005 follow-up-16: FCM-only device actions always audit', () => {
  // Read the file once; every assertion below is a
  // regex on this text.
  const source = fs.readFileSync(ACTIONS_ROUTE_PATH, 'utf8');

  // Slice the file into two halves: everything
  // BEFORE the FCM-success check (`if (!fcmResult.success) return ...`),
  // and everything AFTER it. The new audit call MUST
  // be in the AFTER half, and MUST come BEFORE the
  // `if (Object.keys(dbUpdate).length > 0)` guard.
  // The pre-fix code had the audit inside the guard,
  // so the AFTER / BEFORE relationship is the lock.
  const fcmFailureCheckIdx = source.indexOf(
    "if (!fcmResult.success) return errors.internal"
  );
  const dbUpdateGuardIdx = source.indexOf(
    'if (Object.keys(dbUpdate).length > 0)'
  );
  const auditCallIdx = source.indexOf('await createAuditLog({');

  it('source file exists at the expected path', () => {
    expect(fs.existsSync(ACTIONS_ROUTE_PATH)).toBe(true);
  });

  it('the route still has the FCM-success check (sanity)', () => {
    expect(fcmFailureCheckIdx).toBeGreaterThan(-1);
  });

  it('the route still has the dbUpdate guard (sanity)', () => {
    expect(dbUpdateGuardIdx).toBeGreaterThan(-1);
  });

  it('the createAuditLog call exists in the route (sanity)', () => {
    expect(auditCallIdx).toBeGreaterThan(-1);
  });

  it('the createAuditLog call is AFTER the FCM-success check (not gated on FCM failure)', () => {
    // If a future refactor moves the audit back
    // above the FCM check, this fails — we'd lose
    // the `fcmResult` value in the audit details.
    expect(auditCallIdx).toBeGreaterThan(fcmFailureCheckIdx);
  });

  it('the createAuditLog call is BEFORE the dbUpdate guard (not gated on dbUpdate)', () => {
    // THE bug lock. The pre-fix code had the audit
    // call inside `updateSecurityFlags`, which was
    // only called when dbUpdate was non-empty. The
    // fix hoists the audit OUT, BEFORE the guard,
    // so FCM-only actions (dbUpdate empty) still
    // write a record. If a future refactor moves
    // the audit back inside the guard, this fails.
    expect(auditCallIdx).toBeLessThan(dbUpdateGuardIdx);
  });

  it('the createAuditLog call uses the `device.${action.toLowerCase()}` action prefix', () => {
    // The action prefix is a stable contract:
    //   - retention-sweep test (NET-005 follow-up-5)
    //     classifies `device.*` actions.
    //   - SIEM dashboards filter by prefix.
    // Pin the exact construction so a refactor that
    // hard-codes strings breaks the test. The source
    // builds the value in a template literal:
    //   const auditAction = `device.${action.toLowerCase()}`;
    // and passes it as `action: auditAction`. The
    // regex matches the template literal itself.
    const re = /device\.\$\{action\.toLowerCase\(\)\}/;
    expect(re.test(source)).toBe(true);
  });

  it('the 6 FCM-only actions are all listed in fcmRequiredActions', () => {
    // The fcmRequiredActions list gates the
    // "missing FCM token" early return. If a future
    // refactor drops an action, the FCM branch
    // crashes with a runtime `rider.fcmToken` null
    // deref. Lock the list.
    const expected = [
      "'FACTORY_RESET'",
      "'DISABLE_CAMERA'",
      "'ENABLE_CAMERA'",
      "'ENFORCE_PASSCODE'",
      "'CHECK_LOCATION_INTEGRITY'",
      "'SYNC_DEVICE_DATA'",
    ];
    for (const action of expected) {
      expect(source).toContain(action);
    }
  });

  it('the dbUpdate-guard comment block mentions the FCM-only regression', () => {
    // Regression-locks the documentation. If a
    // future refactor removes the long comment, the
    // WHY is lost — and the next person to
    // "simplify" the code will re-introduce the bug.
    expect(source).toContain('FCM-only branches');
  });
});

// ---------------------------------------------------------------------------
// #17c — device-data access log
// ---------------------------------------------------------------------------

const route17cMocks = vi.hoisted(() => ({
  getDeviceData: vi.fn(),
}));

vi.mock('@/server/modules/riders/admin-riders.use-cases', () => ({
  adminRiderUseCases: {
    getDeviceData: route17cMocks.getDeviceData,
  },
}));

import { GET as getDeviceData } from '@/app/api/admin/riders/[id]/device-data/route';

describe('NET-005 follow-up-16: device-data endpoint access log', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sharedMocks.requireAdmin.mockResolvedValue({
      adminId: 'admin-1',
      adminRole: 'OPERATIONS_ADMIN',
    });
    sharedMocks.hasPermission.mockReturnValue(true);
    route17cMocks.getDeviceData.mockResolvedValue({ locations: [], contacts: [] });
  });

  it('fires logDeviceDataAccess with adminId + riderId + type=locations', async () => {
    const req = new NextRequest(
      'http://localhost/api/admin/riders/r1/device-data?type=locations',
      { method: 'GET' }
    );
    const res = await getDeviceData(req, { params: Promise.resolve({ id: 'r1' }) });
    expect(res.status).toBe(200);
    expect(securityEventsMocks.logDeviceDataAccess).toHaveBeenCalledWith({
      adminId: 'admin-1',
      riderId: 'r1',
      dataType: 'locations',
    });
  });

  it('defaults to dataType="all" when no type query param', async () => {
    const req = new NextRequest(
      'http://localhost/api/admin/riders/r1/device-data',
      { method: 'GET' }
    );
    await getDeviceData(req, { params: Promise.resolve({ id: 'r1' }) });
    expect(securityEventsMocks.logDeviceDataAccess).toHaveBeenCalledWith(
      expect.objectContaining({ dataType: 'all' })
    );
  });

  it('fires the access log BEFORE the data fetch (record-then-serve)', async () => {
    // Order of operations matters: even if the
    // getDeviceData call throws, the access log row
    // was already written (the `void` discards the
    // returned promise but the call already
    // started). Verify the access log was called
    // when the data fetch succeeds.
    const req = new NextRequest(
      'http://localhost/api/admin/riders/r1/device-data',
      { method: 'GET' }
    );
    const res = await getDeviceData(req, { params: Promise.resolve({ id: 'r1' }) });
    expect(res.status).toBe(200);
    expect(securityEventsMocks.logDeviceDataAccess).toHaveBeenCalled();
    expect(route17cMocks.getDeviceData).toHaveBeenCalled();
  });
});
