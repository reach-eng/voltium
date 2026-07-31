/**
 * Shared admin panel types.
 *
 * Single source of truth for the Rider shape used across all admin screens.
 * Previously duplicated as inline `interface Rider { [key: string]: any }`
 * in RiderManagement.tsx and other screens.
 */

/** Rider record as returned by the admin API. */
export interface Rider {
  id: string;
  riderId: string;
  phone: string;
  fullName: string | null;
  email: string | null;
  kycStatus: string;
  kycRejectionReason?: string | null;
  state: string;
  lifecycleStatus: string;
  walletBalance: number;
  securityDeposit: number;
  depositStatus: string;
  rentalStatus: string;
  currentPlan: string | null;
  planStatus: string;
  vehicleId: string | null;
  pickupHub: string | null;
  referralCode: string;
  fatherName: string | null;
  motherName: string | null;
  dob: string | null;
  currentAddress: string | null;
  emergencyContact: string | null;
  intent: string | null;
  accountStatus: string;

  // Permissions
  locationGranted: boolean;
  batteryGranted: boolean;
  contactsGranted: boolean;
  callLogsGranted: boolean;
  micGranted: boolean;
  cameraGranted: boolean;
  phoneGranted: boolean;

  // Guarantor
  guarantorName: string | null;
  guarantorRelation: string | null;
  guarantorPhone: string | null;
  guarantorDob: string | null;
  guarantorStatus: string;
  guarantorAadhaarFront: string | null;
  guarantorAadhaarBack: string | null;
  guarantorPan: string | null;
  guarantorVideo: string | null;
  guarantorSignature: string | null;
  guarantorFatherName: string | null;
  guarantorMotherName: string | null;
  guarantorAddress: string | null;
  guarantorPhoto: string | null;

  // KYC / Documents
  profilePhoto: string | null;
  riderPhoto: string | null;
  riderVideo?: string | null;
  signature: string | null;
  aadhaarFront: string | null;
  aadhaarBack: string | null;
  aadhaarNumber: string | null;
  panCard: string | null;
  panNumber: string | null;

  // Banking
  bankName: string | null;
  accountNumber: string | null;
  ifscCode: string | null;

  // Operational
  createdAt: string;
  advanceRentPaid?: boolean;
  paymentStreak: number;
  pickedUpAt?: string | null;
  sharedGuarantorWith: string[];
  activeVehicle: string | null;
  activeVehicleModel: string | null;
  joiningDate: string | null;
  submissionDate: string | null;
  scooterSubmissionDate: string | null;
  preferredShift: string | null;
  referredBy: string | null;
  teamLeader: string | null;

  // Pickup photos
  pickupPhotoFront: string | null;
  pickupPhotoBack: string | null;
  pickupPhotoLeft: string | null;
  pickupPhotoRight: string | null;
  pickupPhotoWithVehicle: string | null;
  deliveryId: string | null;

  // Return & TL logic
  returnPending: boolean;
  tlChangeRequested: boolean;
  tlChangeReason: string | null;
  assignedTlId: string | null;
  assignedTlName: string | null;
  assignedTlPhone: string | null;

  // Lifecycle completion flags (dynamic access via lifecycle steps)
  registrationDone?: boolean;
  depositDone?: boolean;
  kycDone?: boolean;
  planDone?: boolean;
  pickupDone?: boolean;
  registrationDoneAt?: string | null;
  depositDoneAt?: string | null;
  kycDoneAt?: string | null;
  planDoneAt?: string | null;
}

/**
 * Editable form state for a rider.
 * Uses `any` for values because form inputs need flexible types
 * (strings from inputs, booleans from toggles, etc.).
 */
export type RiderEditForm = Record<string, any>;

/** Pagination metadata from the admin API. */
export interface PaginationMeta {
  totalPages: number;
  total: number;
  page: number;
  limit: number;
}

/** Admin API result envelope. */
export interface AdminApiResult<T> {
  data?: T;
  pagination?: PaginationMeta;
  error?: string;
  success: boolean;
}
