/**
 * Phase 4 & Phase 5 unit tests for Rider Admin section.
 *
 * Phase 4:
 * - P1-5: UI Role gating on Add Rider, Bulk Approve/Suspend/Delete, Row Delete, KYC decisions,
 *         Unlock/Save changes in DetailDialog, and Wallet Adjust.
 * - P1-6: 403 matrix for non-authorized roles (TEAM_LEADER x delete/suspend/bulkKyc),
 *         batch audit logging for bulk operations, and cache invalidation.
 *
 * Phase 5:
 * - P2 Item 1: Barrel re-export sanity for DetailGroup, MediaPreview, etc.
 * - P2 Item 2: Server logger.warn on stripped keys during PUT /api/admin/riders without failing valid payloads.
 * - P2 Item 4: 12-column CSV export unification matching RiderFiltersBar.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  getAdminSession: vi.fn(),
  hasPermission: vi.fn(),
  invalidateCache: vi.fn(),
  invalidateRiderCache: vi.fn(),
  createAuditLog: vi.fn().mockResolvedValue(undefined),
  useCaseUpdate: vi.fn().mockResolvedValue({ id: 'r1', fullName: 'Updated Rider' }),
  useCaseSuspend: vi.fn().mockResolvedValue({ id: 'r1', lifecycleStatus: 'SUSPENDED' }),
  useCaseDelete: vi.fn().mockResolvedValue({ success: true }),
  loggerWarn: vi.fn(),
  loggerInfo: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    warn: mocks.loggerWarn,
    info: mocks.loggerInfo,
    error: mocks.loggerError,
    debug: vi.fn(),
  },
}));

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: any) => (open ? <div data-testid="dialog">{children}</div> : null),
  DialogContent: ({ children, className }: any) => <div className={className}>{children}</div>,
  DialogHeader: ({ children, className }: any) => <div className={className}>{children}</div>,
  DialogTitle: ({ children, className }: any) => <div className={className}>{children}</div>,
  DialogFooter: ({ children, className }: any) => <div className={className}>{children}</div>,
}));

vi.mock('@/lib/cache', () => ({
  invalidateCache: mocks.invalidateCache,
  getOrSetResponse: vi.fn(),
}));

vi.mock('@/lib/server-cache', () => ({
  invalidateRiderCache: mocks.invalidateRiderCache,
}));

vi.mock('@/lib/audit-log', () => ({
  createAuditLog: mocks.createAuditLog,
}));

vi.mock('@/lib/rbac', () => ({
  requireAdmin: mocks.requireAdmin,
  adminUnauthorized: () =>
    new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 401 }),
  adminForbidden: () =>
    new Response(JSON.stringify({ success: false, error: 'Forbidden' }), { status: 403 }),
}));

vi.mock('@/lib/get-session', () => ({
  getAdminSession: mocks.getAdminSession,
}));

vi.mock('@/lib/auth', () => ({
  hasPermission: mocks.hasPermission,
}));

vi.mock('@/lib/api-middleware', () => ({
  withIdempotency: (handler: (req: NextRequest) => Promise<Response>) => (req: NextRequest) =>
    handler(req),
}));

vi.mock('@/server/modules/riders/admin-riders.use-cases', () => ({
  adminRiderUseCases: {
    update: mocks.useCaseUpdate,
    suspend: mocks.useCaseSuspend,
    delete: mocks.useCaseDelete,
  },
}));

import { POST as bulkPostRoute } from '@/app/api/admin/riders/bulk/route';
import { PUT as updateRiderRoute } from '@/app/api/admin/riders/route';
import { bulkActionSchema } from '@/lib/validators';
import { hasPermission as actualHasPermission } from '@/lib/permissions';
import { ROLE_PERMISSIONS } from '@/lib/permissions-roles';
import type { SessionPayload } from '@/lib/session-payload';
import type { Rider, RiderEditForm } from '@/lib/types/admin';

// UI components
import { RiderFiltersBar } from '@/components/admin/screens/rider-management/RiderFiltersBar';
import { RiderBulkActionsBar } from '@/components/admin/screens/rider-management/RiderBulkActionsBar';
import { RiderRow } from '@/components/admin/screens/rider-management/RiderRow';
import { RiderMoneyTab } from '@/components/admin/screens/rider-management/detail/RiderMoneyTab';
import { RiderDetailDialog } from '@/components/admin/screens/rider-management/RiderDetailDialog';
import { buildSelectedRiderCsv } from '@/components/admin/screens/rider-management/exportSelectedRiders';
import * as RiderManagementBarrel from '@/components/admin/screens/rider-management';
import { Tabs } from '@/components/ui/tabs';

describe('Phase 4: P1-6 Bulk Route RBAC 403 Matrix & Batch Audit Logs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const makePostReq = (body: Record<string, unknown>) =>
    new NextRequest('http://localhost/api/admin/riders/bulk', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });

  it('403 Matrix: TEAM_LEADER gets 403 on bulk delete, bulkKyc, and suspend', async () => {
    const teamLeaderSession = {
      adminId: 'tl-1',
      adminRole: 'TEAM_LEADER',
    };
    mocks.requireAdmin.mockResolvedValue(teamLeaderSession);

    // Mock hasPermission to evaluate permissions realistically
    mocks.hasPermission.mockImplementation((sess: any, perm: string) => {
      return actualHasPermission(sess.adminRole, perm as any);
    });

    // 1. Bulk Delete -> 403 (riders_delete not held by TEAM_LEADER)
    const delReq = makePostReq({ ids: ['r1'], action: 'delete' });
    const delRes = await bulkPostRoute(delReq);
    expect(delRes.status).toBe(403);

    // 2. Bulk KYC -> 403 (kyc_bulk_approve / kyc_approve not held by TEAM_LEADER)
    const kycReq = makePostReq({ ids: ['r1'], action: 'bulkKyc', value: 'APPROVED' });
    const kycRes = await bulkPostRoute(kycReq);
    expect(kycRes.status).toBe(403);

    // 3. Bulk Suspend -> 403 (riders_update not held by TEAM_LEADER)
    const suspendReq = makePostReq({ ids: ['r1'], action: 'suspend' });
    const suspendRes = await bulkPostRoute(suspendReq);
    expect(suspendRes.status).toBe(403);

    // 4. Bulk UpdateStatus -> 403 (riders_update not held by TEAM_LEADER)
    const statusReq = makePostReq({ ids: ['r1'], action: 'updateStatus', value: 'ACTIVE' });
    const statusRes = await bulkPostRoute(statusReq);
    expect(statusRes.status).toBe(403);
  });

  it('writes batch audit log and invalidates cache on successful bulk delete', async () => {
    mocks.requireAdmin.mockResolvedValue({
      adminId: 'ops-admin-1',
      adminRole: 'OPERATIONS_ADMIN',
    });
    mocks.hasPermission.mockReturnValue(true);

    const req = makePostReq({ ids: ['r1', 'r2'], action: 'delete' });
    const res = await bulkPostRoute(req);
    expect(res.status).toBe(200);

    expect(mocks.useCaseDelete).toHaveBeenCalledTimes(2);
    expect(mocks.invalidateCache).toHaveBeenCalledWith('admin:*');
    expect(mocks.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'rider.bulk_delete',
        entity: 'rider',
        entityId: 'multiple',
        actorId: 'ops-admin-1',
        details: expect.objectContaining({
          ids: ['r1', 'r2'],
          count: 2,
          failedCount: 0,
        }),
      })
    );
  });

  it('writes batch audit log on successful bulk KYC approval', async () => {
    mocks.requireAdmin.mockResolvedValue({
      adminId: 'kyc-reviewer-1',
      adminRole: 'KYC_REVIEWER',
    });
    mocks.hasPermission.mockReturnValue(true);

    const req = makePostReq({ ids: ['r1'], action: 'bulkKyc', value: 'APPROVED' });
    const res = await bulkPostRoute(req);
    expect(res.status).toBe(200);

    expect(mocks.useCaseUpdate).toHaveBeenCalledWith(
      'r1',
      { kycStatus: 'APPROVED' },
      expect.objectContaining({ actorId: 'kyc-reviewer-1' })
    );
    expect(mocks.invalidateCache).toHaveBeenCalledWith('admin:*');
    expect(mocks.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'rider.bulk_bulkKyc',
        entity: 'rider',
        entityId: 'multiple',
        actorId: 'kyc-reviewer-1',
      })
    );
  });

  it('writes batch audit log on successful bulk suspend', async () => {
    mocks.requireAdmin.mockResolvedValue({
      adminId: 'ops-admin-2',
      adminRole: 'OPERATIONS_ADMIN',
    });
    mocks.hasPermission.mockReturnValue(true);

    const req = makePostReq({ ids: ['r1', 'r2'], action: 'suspend', value: 'Violation' });
    const res = await bulkPostRoute(req);
    expect(res.status).toBe(200);

    expect(mocks.useCaseSuspend).toHaveBeenCalledTimes(2);
    expect(mocks.invalidateCache).toHaveBeenCalledWith('admin:*');
    expect(mocks.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'rider.bulk_suspend',
        entity: 'rider',
        entityId: 'multiple',
        actorId: 'ops-admin-2',
      })
    );
  });

  it('rejects unknown bulk action with 400 Bad Request via Zod validation', async () => {
    mocks.requireAdmin.mockResolvedValue({
      adminId: 'ops-admin-1',
      adminRole: 'OPERATIONS_ADMIN',
    });

    const parsed = bulkActionSchema.safeParse({
      ids: ['r1'],
      action: 'unsupportedAction',
    });
    expect(parsed.success).toBe(false);

    const req = makePostReq({ ids: ['r1'], action: 'unsupportedAction' });
    const res = await bulkPostRoute(req);
    expect(res.status).toBe(400);
  });
});

describe('Phase 4: P1-5 Role-Gated UI Elements', () => {
  it('RiderFiltersBar disables Add Rider button when canCreate is false with descriptive title', () => {
    const htmlDisabled = renderToStaticMarkup(
      <RiderFiltersBar
        search=""
        searching={false}
        stateFilter="ALL"
        kycFilter="ALL"
        onSearchChange={() => {}}
        onStateFilterChange={() => {}}
        onKycFilterChange={() => {}}
        onAddRider={() => {}}
        canCreate={false}
      />
    );

    expect(htmlDisabled).toContain('disabled=""');
    expect(htmlDisabled).toContain('title="Requires riders_create permission"');

    const htmlEnabled = renderToStaticMarkup(
      <RiderFiltersBar
        search=""
        searching={false}
        stateFilter="ALL"
        kycFilter="ALL"
        onSearchChange={() => {}}
        onStateFilterChange={() => {}}
        onKycFilterChange={() => {}}
        onAddRider={() => {}}
        canCreate={true}
      />
    );

    expect(htmlEnabled).not.toContain('Requires riders_create permission');
  });

  it('RiderBulkActionsBar disables action buttons when corresponding permissions are false', () => {
    const htmlGated = renderToStaticMarkup(
      <RiderBulkActionsBar
        selectedIds={new Set(['r1', 'r2'])}
        selectedCount={2}
        canApprove={false}
        canSuspend={false}
        canDelete={false}
        canUndo={true}
      />
    );

    expect(htmlGated).toContain('title="Requires kyc_bulk_approve permission"');
    expect(htmlGated).toContain('title="Requires riders_update permission"');
    expect(htmlGated).toContain('title="Requires riders_delete permission"');
    expect(htmlGated).toContain('Undo');
    expect(htmlGated).toContain('2 selected');
  });

  it('RiderRow hides Trash2 button when canDelete is false', () => {
    const mockRider = {
      id: 'r1',
      riderId: 'VR-101',
      fullName: 'Alice Bob',
      phone: '9876543210',
      lifecycleStatus: 'ACTIVE',
    } as unknown as Rider;

    const htmlGated = renderToStaticMarkup(
      <table>
        <tbody>
          <RiderRow
            rider={mockRider}
            isSelected={false}
            onToggleSelect={() => {}}
            onViewDetails={() => {}}
            onDelete={() => {}}
            canDelete={false}
          />
        </tbody>
      </table>
    );

    expect(htmlGated).not.toContain('Remove Rider');
  });

  it('RiderMoneyTab disables Adjust Balance button when canAdjustWallet is false', () => {
    const mockRider = {
      id: 'r1',
      walletBalance: 2500,
    } as unknown as Rider;

    const htmlGated = renderToStaticMarkup(
      <Tabs value="money">
        <RiderMoneyTab
          rider={mockRider}
          isEditing={false}
          editForm={{} as RiderEditForm}
          setEditForm={() => {}}
          setShowAdjustWallet={() => {}}
          canAdjustWallet={false}
        />
      </Tabs>
    );

    expect(htmlGated).toContain('disabled=""');
    expect(htmlGated).toContain('title="Requires transactions_manage permission"');
  });

  it('RiderDetailDialog disables Unlock to Edit and Save Changes when canUpdate is false', () => {
    const mockRider = {
      id: 'r1',
      fullName: 'Bob Rider',
      phone: '9988776655',
    } as unknown as Rider;

    const htmlViewOnly = renderToStaticMarkup(
      <RiderDetailDialog
        rider={mockRider}
        onClose={() => {}}
        isEditing={false}
        setIsEditing={() => {}}
        editForm={{} as any}
        setEditForm={() => {}}
        saving={false}
        canUpdate={false}
        handleUpdateRider={() => {}}
        handleDeleteKycDoc={() => {}}
        handleBulkDeleteKycDocs={() => {}}
        toggleKycDoc={() => {}}
        handleClearGuarantor={() => {}}
        selectedKycDocs={new Set()}
        setSelectedKycDocs={() => {}}
        setConfirmKycAction={() => {}}
        setShowAdjustWallet={() => {}}
      />
    );

    expect(htmlViewOnly).toContain('title="Requires riders_update permission"');
    expect(htmlViewOnly).toContain('disabled=""');
  });

  it('evaluates TEAM_LEADER session permissions correctly according to role policy', () => {
    const teamLeaderSession: SessionPayload = {
      riderId: 'admin-tl-1',
      riderDbId: 'admin-tl-1',
      phone: '9999999999',
      role: 'TEAM_LEADER',
      adminRole: 'TEAM_LEADER',
    };

    expect(actualHasPermission(teamLeaderSession, 'riders_view')).toBe(true);
    expect(actualHasPermission(teamLeaderSession, 'riders_create')).toBe(true);
    expect(actualHasPermission(teamLeaderSession, 'riders_update')).toBe(false);
    expect(actualHasPermission(teamLeaderSession, 'riders_delete')).toBe(false);
    expect(actualHasPermission(teamLeaderSession, 'kyc_approve')).toBe(false);
    expect(actualHasPermission(teamLeaderSession, 'kyc_bulk_approve')).toBe(false);
    expect(actualHasPermission(teamLeaderSession, 'transactions_manage')).toBe(false);
  });
});

describe('Phase 5: P2 Batch Items', () => {
  it('P2 Item 1: Barrel re-exports DetailGroup and MediaPreview from helpers without broken imports', () => {
    expect(RiderManagementBarrel.DetailGroup).toBeDefined();
    expect(RiderManagementBarrel.MediaPreview).toBeDefined();
    expect(RiderManagementBarrel.RiderBulkActionsBar).toBeDefined();
    expect(RiderManagementBarrel.buildSelectedRiderCsv).toBeDefined();
    expect(RiderManagementBarrel.downloadSelectedRiderCsv).toBeDefined();
  });

  it('P2 Item 2: Server logs warning on stripped keys during PUT /api/admin/riders and does not 400', async () => {
    mocks.getAdminSession.mockResolvedValue({
      adminId: 'ops-1',
      adminRole: 'OPERATIONS_ADMIN',
    });
    mocks.hasPermission.mockReturnValue(true);

    const req = new NextRequest('http://localhost/api/admin/riders', {
      method: 'PUT',
      body: JSON.stringify({
        id: 'r1',
        fullName: 'Valid Name',
        tlAction: 'approve', // unexpected extra key
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await updateRiderRoute(req);
    expect(res.status).toBe(200);

    expect(mocks.loggerWarn).toHaveBeenCalledWith(
      'PUT /api/admin/riders stripped unexpected keys from payload',
      expect.objectContaining({
        riderId: 'r1',
        strippedKeys: ['tlAction'],
      })
    );
    expect(mocks.useCaseUpdate).toHaveBeenCalledWith(
      'r1',
      expect.objectContaining({ fullName: 'Valid Name' }),
      expect.objectContaining({ actorId: 'ops-1' })
    );
  });

  it('P2 Item 4: buildSelectedRiderCsv unifies on canonical 12-column shape matching RiderFiltersBar', () => {
    const riders: Rider[] = [
      {
        id: 'r-1',
        riderId: 'VF-RD-001',
        fullName: 'John "The Bolt" Doe',
        phone: '9876543210',
        email: 'john@example.com',
        state: 'DELHI',
        kycStatus: 'APPROVED',
        walletBalance: 1250,
        securityDeposit: 3000,
        depositStatus: 'PAID',
        guarantorName: 'Jane Doe',
        guarantorPhone: '9123456780',
        createdAt: '2026-09-08T10:00:00Z',
      } as unknown as Rider,
    ];

    const selectedIds = new Set(['r-1']);
    const csv = buildSelectedRiderCsv(riders, selectedIds);
    const lines = csv.split('\n');

    expect(lines[0]).toBe(
      'Rider ID,Name,Phone,Email,State,KYC Status,Wallet Balance,Security Deposit,Deposit Status,Guarantor Name,Guarantor Phone,Created At'
    );
    expect(lines[1]).toContain('"VF-RD-001"');
    expect(lines[1]).toContain('"John ""The Bolt"" Doe"');
    expect(lines[1]).toContain('1250');
    expect(lines[1]).toContain('3000');
    expect(lines[1]).toContain('"Jane Doe"');
  });
});
