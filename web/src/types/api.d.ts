// Currency utilities — all amounts stored as paise in DB, displayed as rupees
export type Paise = number;
export type Rupees = number;

// Rider states
export type RiderState = 'ONBOARDING' | 'PRE_ACTIVE' | 'POST_ACTIVE' | 'SUSPENDED';
export type KycStatus = 'PENDING' | 'SUBMITTED' | 'VERIFIED' | 'APPROVED' | 'REJECTED';
export type AccountStatus = 'PRE_ACTIVE' | 'ACTIVE' | 'SUSPENDED' | 'TERMINATED';
export type PlanStatus = 'NONE' | 'SELECTED' | 'ACTIVE' | 'EXPIRED';
export type RentalStatus = 'NONE' | 'PICKUP_PENDING' | 'ACTIVE' | 'RETURN_REQUIRED' | 'PENDING_RETURN' | 'RETURNED';
export type RiderLifecycleStatus = 'NEW' | 'KYC_SUBMITTED' | 'ACTIVE' | 'SUSPENDED' | 'CLOSED';
export type TransactionType = 'CREDIT' | 'DEBIT';
export type TransactionPurpose =
  | 'TOP_UP'
  | 'SECURITY_DEPOSIT'
  | 'RENTAL_FEE'
  | 'REWARD'
  | 'ADJUSTMENT'
  | 'PENALTY'
  | 'REFUND';
export type TransactionStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUCCESS';
export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

// API Response envelope
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  message?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Flattened Rider (for frontend use — backend joins tables and returns this shape)
export interface FlatRider {
  // Core
  id: string;
  riderId: string;
  phone: string;
  fullName: string | null;
  email: string | null;
  fatherName: string | null;
  motherName: string | null;
  dob: string | null;
  currentAddress: string | null;

  intent: string | null;
  lifecycleStatus: string;
  state: RiderState;
  accountStatus: AccountStatus;

  // Virtual from KycProfile
  kycStatus: KycStatus;
  profilePhoto: string | null;
  riderPhoto: string | null;
  signature: string | null;
  aadhaarFront: string | null;
  aadhaarBack: string | null;
  aadhaarNumber: string | null;
  panCard: string | null;
  panNumber: string | null;
  bankAccount: string | null;
  bankIfsc: string | null;
  bankName: string | null;
  accountNumber: string | null;
  ifscCode: string | null;

  // Virtual from Guarantor
  guarantorStatus: KycStatus;
  guarantorName: string | null;
  guarantorRelation: string | null;
  guarantorDob: string | null;
  guarantorPhone: string | null;
  guarantorAadhaarFront: string | null;
  guarantorAadhaarBack: string | null;
  guarantorPan: string | null;
  guarantorVideo: string | null;
  guarantorSignature: string | null;
  guarantorLivePhoto: string | null;
  guarantorFatherName: string | null;
  guarantorMotherName: string | null;
  guarantorAddress: string | null;
  guarantorPhoto: string | null;

  // Virtual from Wallet
  walletBalance: number; // in rupees (display)
  securityDeposit: number; // in rupees (display)
  depositStatus: string;
  paymentStreak: number;

  // Vehicle
  assignedVehicle: string | null;
  pickupHub: string | null;

  // Plan
  planStatus: PlanStatus;
  currentPlan: string | null;
  planStartDate: string | null;
  planEndDate: string | null;

  // Rental
  rentalStatus: RentalStatus;
  preferredShift: string | null;
  teamLeader: string | null;
  emergencyContact: string | null;

  // Referral
  referralCode: string;
  referredBy: string | null;

  // Permissions
  locationGranted: boolean;
  batteryGranted: boolean;
  contactsGranted: boolean;
  callLogsGranted: boolean;
  micGranted: boolean;
  cameraGranted: boolean;
  phoneGranted: boolean;

  // Approval
  registrationDone: boolean;
  depositDone: boolean;
  kycDone: boolean;
  planDone: boolean;
  pickupDone: boolean;

  pickupPhotoFront: string | null;
  pickupPhotoBack: string | null;
  pickupPhotoLeft: string | null;
  pickupPhotoRight: string | null;
  pickupPhotoWithVehicle: string | null;
  deliveryId: string | null;

  // Meta
  unreadNotifications?: number;
  createdAt: string;
  updatedAt: string;
}
