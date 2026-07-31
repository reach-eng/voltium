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

export const kycDocuments = [
  { key: 'aadhaarFront' as const, label: 'Aadhaar Front' },
  { key: 'aadhaarBack' as const, label: 'Aadhaar Back' },
  { key: 'panCard' as const, label: 'PAN Card' },
  { key: 'signature' as const, label: 'Signature' },
  { key: 'profilePhoto' as const, label: 'Rider Photo' },
];

export function getCompletion(rider: KycRider): number {
  const total = kycDocuments.length;
  const completed = kycDocuments.filter((doc) => rider[doc.key]).length;
  return Math.round((completed / total) * 100);
}
