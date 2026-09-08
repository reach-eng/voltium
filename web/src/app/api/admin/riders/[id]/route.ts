import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { requireAdmin, adminUnauthorized, adminForbidden } from '@/lib/rbac';
import { hasPermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { logKycDocumentView } from '@/lib/security-events';
import { signRiderUrls } from '@/lib/sign-rider';
import { withApiHandler } from '@/lib/api-handler';

export const GET = withApiHandler(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const session = await requireAdmin();
    if (!session) return adminUnauthorized();
    if (!hasPermission(session.adminRole || '', 'riders_view')) return adminForbidden();

    const { id } = await params;
    if (!id) return errors.badRequest('Rider ID is required');

    // NET-005 follow-up-16 (2026-09-08): the
    // pre-fix code did `db.rider.findFirst({include})`
    // with NO `select`, returning every rider
    // column (lockPasswordHash, fcmToken,
    // tokenVersion, serialNumber, deletionRequestReason,
    // and the encrypted-Aadhaar/PAN ciphertext via
    // the kycProfile include) to any `riders_view`
    // admin — including TEAM_LEADER. The endpoint is
    // an orphan (no UI consumer; the per-rider
    // detail dialog renders from the list payload)
    // but the route exists in OpenAPI and the
    // NET-005 kyc_live_workflow integration test
    // calls it to read back state, so deleting it
    // is not an option. Mirror the list endpoint's
    // `select` (the production-proven safe
    // projection at `admin-riders.use-cases.ts:220`)
    // so the detail endpoint returns the same
    // shape as the list — none of the four extra
    // sensitive columns. The single source of
    // truth for the admin projection is the list
    // endpoint's `select` block; the detail
    // endpoint mirrors it.
    //
    // Note: do NOT run this through `flattenRider` —
    // the rider-facing helper preserves `serialNumber`
    // and `deletionRequestReason` (only the
    // rider-app secret-stripper drops those; admin
    // serializers keep the full shape per the
    // comment at `flatten-rider.ts:67-68`). The
    // raw `select` shape is the right surface for
    // an admin endpoint.
    const rider = await db.rider.findFirst({
      where: {
        OR: [{ id }, { riderId: id }],
      },
      select: {
        id: true,
        riderId: true,
        fullName: true,
        phone: true,
        email: true,
        fatherName: true,
        motherName: true,
        dob: true,
        currentAddress: true,
        emergencyContact: true,
        lifecycleStatus: true,
        pickupHub: true,
        pickedUpAt: true,
        registrationDoneAt: true,
        depositDoneAt: true,
        kycDoneAt: true,
        planDoneAt: true,
        teamLeaderId: true,
        planStartDate: true,
        planEndDate: true,
        currentPlan: true,
        currentPlanPrice: true,
        assignedVehicle: true,
        vehicleId: true,
        intent: true,
        referralCode: true,
        createdAt: true,
        updatedAt: true,
        deletedAt: true,
        purgedAt: true,
        kycProfile: {
          select: {
            id: true,
            status: true,
            profilePhoto: true,
            riderPhoto: true,
            signature: true,
            aadhaarFront: true,
            aadhaarBack: true,
            aadhaarNumber: true,
            panCard: true,
            panNumber: true,
            bankName: true,
            accountNumber: true,
            ifscCode: true,
            rejectionReason: true,
            updatedAt: true,
          },
        },
        wallet: {
          select: {
            id: true,
            balanceInPaise: true,
            securityDepositInPaise: true,
            depositStatus: true,
            paymentStreak: true,
          },
        },
        guarantor: {
          select: {
            id: true,
            status: true,
            name: true,
            relation: true,
            dob: true,
            phone: true,
            aadhaarFront: true,
            aadhaarBack: true,
            pan: true,
            video: true,
            signature: true,
            fatherName: true,
            motherName: true,
            address: true,
            photo: true,
          },
        },
        leases: {
          where: { status: 'ACTIVE' },
          take: 1,
          select: { createdAt: true, vehicle: { select: { vehicleNumber: true, model: true } } },
        },
      },
    });

    if (!rider) return errors.notFound('Rider not found');

    // SOC2: every admin access to a rider's KYC
    // data is recorded. The audit row is fired
    // fire-and-forget so it doesn't block the
    // Sign the CDN URLs in the KYC doc fields
    // before returning.
    const signed = (await signRiderUrls(
      rider as Parameters<typeof signRiderUrls>[0]
    )) as Record<string, any>;

    // P1-6 (Phase 6): Gate KYC & guarantor document fields on kyc_view permission.
    const canViewKyc = hasPermission(session.adminRole || '', 'kyc_view');
    if (!canViewKyc) {
      if (signed.kycProfile) {
        signed.kycProfile.profilePhoto = null;
        signed.kycProfile.riderPhoto = null;
        signed.kycProfile.signature = null;
        signed.kycProfile.aadhaarFront = null;
        signed.kycProfile.aadhaarBack = null;
        signed.kycProfile.panCard = null;
      }
      if (signed.guarantor) {
        signed.guarantor.aadhaarFront = null;
        signed.guarantor.aadhaarBack = null;
        signed.guarantor.pan = null;
        signed.guarantor.video = null;
        signed.guarantor.signature = null;
        signed.guarantor.photo = null;
      }
    } else if (rider.kycProfile) {
      // SOC2: every admin access to a rider's KYC
      // data is recorded. Fired only when admin has kyc_view.
      void logKycDocumentView({
        adminId: session.adminId ?? session.riderDbId ?? 'unknown',
        riderId: rider.id,
        documentType: 'rider_detail',
      });
    }

    return success(signed);
  }
);
