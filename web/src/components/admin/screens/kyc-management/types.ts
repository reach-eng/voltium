export interface KycRider {
  id: string;
  riderId: string;
  phone: string;
  fullName: string | null;
  kycStatus: string;
  state: string;
  lifecycleStatus: string;
  profilePhoto: string | null;
  riderPhoto: string | null;
  riderVideo: string | null;
  aadhaarFront: string | null;
  aadhaarBack: string | null;
  aadhaarNumber: string | null;
  panCard: string | null;
  panNumber: string | null;
  signature: string | null;
  fatherName: string | null;
  motherName: string | null;
  dob: string | null;
  currentAddress: string | null;
  emergencyContact: string | null;
  teamLeader: string | null;
  bankName: string | null;
  accountNumber: string | null;
  ifscCode: string | null;
  guarantorName: string | null;
  guarantorStatus: string;
  guarantorRelation: string | null;
  guarantorPhone: string | null;
  guarantorDob: string | null;
  guarantorAadhaarFront: string | null;
  guarantorAadhaarBack: string | null;
  guarantorPan: string | null;
  guarantorVideo: string | null;
  guarantorSignature: string | null;
  guarantorFatherName: string | null;
  guarantorMotherName: string | null;
  guarantorAddress: string | null;
  guarantorPhoto: string | null;
  kycRejectionReason: string | null;
  pickupPhoto: string | null;
  pickupPhotoFront: string | null;
  pickupPhotoBack: string | null;
  pickupPhotoLeft: string | null;
  pickupPhotoRight: string | null;
  pickupPhotoWithVehicle: string | null;
  photoFront: string | null;
  photoBack: string | null;
  photoLeft: string | null;
  photoRight: string | null;
  photoSpeedometer: string | null;
  createdAt: string;
  submissionDate: string | null;
  sharedGuarantorWith: string[];
}

export interface KycConfirmAction {
  rider: KycRider;
  // NET-005 follow-up-13 (2026-09-08): `reopen` is the
  // admin "Re-verify" action for EXPIRED rows. Maps
  // to the new `EXPIRED → PENDING` state-machine
  // transition + the kyc/route.ts REOPEN action.
  action: 'approve' | 'reject' | 'info_required' | 'reopen';
}

export interface LastKycBulkAction {
  ids: string[];
  previousStatuses: Record<string, string>;
  action: string;
}

export type KycBulkConfirmAction = 'approve' | 'reject' | 'info_required';

// NET-005 follow-up-12 (2026-09-08): the KYC review
// queue was hardcoded to limit=100 with no pagination
// UI (useKyc.ts:31). The pre-fix screen showed the
// first 100 records and silently dropped the rest.
// Match the `RIDER_PAGE_SIZE` pattern from the rider-
// management screen so the queue can be navigated
// page-by-page. The server's max limit is 100, so 100
// is the natural page size — no admin would set it
// lower for a KYC review queue.
export const KYC_PAGE_SIZE = 100;
