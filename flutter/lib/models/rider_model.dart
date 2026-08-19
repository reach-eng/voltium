// Enum definitions for RiderModel field types

import 'package:json_annotation/json_annotation.dart';
import 'deposit_record.dart';
import 'rider_lifecycle_stage.dart';
import 'upcoming_rent_prompt.dart';
import '../utils/lifecycle_rank.dart';

part 'rider_model.g.dart';

@JsonEnum(fieldRename: FieldRename.screamingSnake)
enum KycStatus {
  pending,
  draft,
  submitted,
  verified,
  approved,
  rejected,
  infoRequired,
  expired
}

@JsonEnum(fieldRename: FieldRename.screamingSnake)
enum GuarantorStatus {
  pending,
  draft,
  submitted,
  verified,
  approved,
  rejected,
  infoRequired,
  replaced
}

@JsonEnum(fieldRename: FieldRename.screamingSnake)
enum AccountStatus { preActive, active, suspended, terminated, inactive }

@JsonEnum(fieldRename: FieldRename.screamingSnake)
enum DepositStatus {
  pending,
  notSubmitted,
  pendingVerification,
  approved,
  rejected,
  refundRequested,
  refunded,
  forfeited,
  partiallyRefunded
}

/// Rider model matching the Prisma Rider schema.
/// Extends Equatable pattern manually (no external equatable package).
@JsonSerializable(createFactory: false)
class RiderModel {
  // ── Identity ────────────────────────────────────────────────────────────
  final String? id;
  final String riderId;
  final String phone;
  final String name;
  final String? email;
  final String? fatherName;
  final String? motherName;
  final DateTime? dob;

  // ── Addresses ───────────────────────────────────────────────────────────
  final String? currentAddress;

  // ── Photos & Signature ──────────────────────────────────────────────────
  final String? profilePhoto;
  final String? riderPhoto;
  final String? signature;

  // ── KYC ─────────────────────────────────────────────────────────────────
  final KycStatus kycStatus;
  final String? aadhaarFront;
  final String? aadhaarBack;
  final String? panCard;
  final String? kycRejectionReason;
  final List<String>? kycEditableFields;

  // ── Bank ────────────────────────────────────────────────────────────────
  final String? bankAccount;
  final String? bankIfsc;
  final String? bankName;
  final String? bankPassbook;

  // ── Guarantor ───────────────────────────────────────────────────────────
  final String? guarantorName;
  final String? guarantorRelation;
  final DateTime? guarantorDob;
  final String? guarantorPhone;
  final String? guarantorAadhaarFront;
  final String? guarantorAadhaarBack;
  final String? guarantorPan;
  final String? guarantorVideo;
  final String? guarantorSignature;
  final String? guarantorPhoto;
  final String? guarantorAddress;
  final GuarantorStatus guarantorStatus;

  // ── Wallet & Deposit ────────────────────────────────────────────────────
  final double walletBalance;
  final double securityDeposit;
  final DepositStatus depositStatus;
  final int paymentStreak;

  // ── Metrics (Parity with Web KPIGrid/PerformanceMetrics) ────────────────
  final double weeklyDistance;
  final double carbonSaved;
  final double currentSpeed;
  final double batteryPercent;

  // ── Plan ────────────────────────────────────────────────────────────────
  final String planStatus;
  final String? planRejectionReason;

  // ── Deposit Record ──────────────────────────────────────────────────────
  final DepositRecord? depositRecord;

  // ── Device policy (Phase 2.6) ──────────────────────────────────────────
  // Mirrors the corresponding Prisma columns used by the FCM overlay
  // and security flags. Server is source of truth; the rider app
  // mirrors the values into the secure storage so the FCM service
  // can read them synchronously.
  final String? fcmToken;
  final bool isAdminLocked;
  final bool isUninstallBlocked;
  final bool isLocationMandatory;
  final bool isAppsControlRestricted;
  final bool deviceAdminGranted;
  final bool displayOverlayGranted;
  final DateTime? lastDeviceViolationAt;
  final int deviceViolationCount;
  final String? currentPlan;
  final String? currentPlanId;
  final double? currentPlanPrice;
  // PR-RUPEES-2026-08-08: the current plan's security deposit in
  // **rupees** (server-joined via `currentPlanRef.securityDepositInPaise`
  // and converted to rupees at the API boundary). Replaces the
  // hardcoded `AppConstants.planSecurityDepositRupees` map. Was
  // `currentPlanSecurityDepositInPaise` (int) before this PR.
  final double? currentPlanSecurityDepositInRupees;
  final DateTime? planStartDate;
  final DateTime? planEndDate;
  final bool advanceRentPaid;

  // ── Rental ──────────────────────────────────────────────────────────────
  final String rentalStatus;
  final String? assignedVehicle;
  final String? vehicleModel;
  final String? pickupHub;
  final String? teamLeader;
  final String? teamLeaderPhone;
  final String? emergencyContact;
  final String? intent;
  final DateTime? submissionDate;
  final bool returnPending;
  // LANGUAGE-AUDIT (2026-08-16) #6: BCP-47 language tag for the
  // rider's chosen language. NULL means "follow system". Mirrored
  // from the server's `Rider.preferredLocale` column on every
  // profile fetch and on every `LocaleNotifier.setLocale()` call.
  final String? preferredLocale;
  final String? pickupPhotoFront;
  final String? pickupPhotoBack;
  final String? pickupPhotoLeft;
  final String? pickupPhotoRight;
  final String? pickupPhotoWithVehicle;

  final bool registrationDone;
  final bool depositDone;
  final bool kycDone;
  final bool planDone;
  final bool pickupDone;

  // ── Account ──────────────────────────────────────────────────────────────────
  final AccountStatus accountStatus;
  final String lifecycleStatus;
  // PR-K.2: the new canonical 5-value stage. Preferred over `lifecycleStatus`
  // (15 values) for routing decisions. `lifecycleStatus` is kept for
  // backward compat with cached payloads and the legacy column.
  final RiderLifecycleStage lifecycleStage;
  final bool isNewRider;

  // ── Referral & Rewards ───────────────────────────────────────────────────────
  final String? referralCode;
  final int totalRewardPoints;

  // ── Proactive Rent Prompt ──────────────────────────────────────────────────
  final UpcomingRentPrompt? upcomingRentPrompt;

  // ── Timestamps ──────────────────────────────────────────────────────────
  final DateTime? createdAt;
  final DateTime? updatedAt;

  // ── Constructor ─────────────────────────────────────────────────────────

  const RiderModel({
    this.id,
    required this.riderId,
    required this.phone,
    required this.name,
    this.email,
    this.fatherName,
    this.motherName,
    this.dob,
    this.currentAddress,
    this.profilePhoto,
    this.riderPhoto,
    this.signature,
    this.kycStatus = KycStatus.pending,
    this.aadhaarFront,
    this.aadhaarBack,
    this.panCard,
    this.kycRejectionReason,
    this.kycEditableFields,
    this.bankAccount,
    this.bankIfsc,
    this.bankName,
    this.guarantorName,
    this.guarantorRelation,
    this.guarantorDob,
    this.guarantorPhone,
    this.guarantorAadhaarFront,
    this.guarantorAadhaarBack,
    this.guarantorPan,
    this.guarantorVideo,
    this.guarantorSignature,
    this.guarantorStatus = GuarantorStatus.pending,
    this.walletBalance = 0.0,
    this.securityDeposit = 0.0,
    this.depositStatus = DepositStatus.pending,
    this.depositRecord,
    this.paymentStreak = 0,
    this.planStatus = 'NONE',
    this.planRejectionReason,
    // Device policy defaults (Phase 2.6). Server is source of truth.
    this.fcmToken,
    this.isAdminLocked = false,
    this.isUninstallBlocked = false,
    this.isLocationMandatory = false,
    this.isAppsControlRestricted = false,
    this.deviceAdminGranted = false,
    this.displayOverlayGranted = false,
    this.lastDeviceViolationAt,
    this.deviceViolationCount = 0,
    this.currentPlan,
    this.currentPlanId,
    this.currentPlanPrice,
    this.currentPlanSecurityDepositInRupees,
    this.planStartDate,
    this.planEndDate,
    this.advanceRentPaid = false,
    this.rentalStatus = 'NONE',
    this.assignedVehicle,
    this.vehicleModel,
    this.pickupHub,
    this.teamLeader,
    this.teamLeaderPhone,
    this.emergencyContact,
    this.registrationDone = false,
    this.depositDone = false,
    this.kycDone = false,
    this.planDone = false,
    this.pickupDone = false,
    this.accountStatus = AccountStatus.preActive,
    this.lifecycleStatus = 'NEW',
    this.lifecycleStage = RiderLifecycleStage.newRider,
    this.isNewRider = false,
    this.referralCode,
    this.totalRewardPoints = 0,
    this.upcomingRentPrompt,
    this.createdAt,
    this.updatedAt,
    this.intent,
    this.submissionDate,
    this.returnPending = false,
    this.preferredLocale,
    this.pickupPhotoFront,
    this.pickupPhotoBack,
    this.pickupPhotoLeft,
    this.pickupPhotoRight,
    this.pickupPhotoWithVehicle,
    this.bankPassbook,
    this.guarantorPhoto,
    this.guarantorAddress,
    this.weeklyDistance = 0.0,
    this.carbonSaved = 0.0,
    this.currentSpeed = 0.0,
    this.batteryPercent = 0.0,
  });

  // ── Equatable (manual) ─────────────────────────────────────────────────

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    if (other is! RiderModel) return false;
    // PR-AUDIT-FIX 2026-08-12: equality must include the fields that
    // drive routing and screen rebuilds — not just `id` and `updatedAt`.
    //
    // The bug: hangTight's auto-redirect watches `rider.pickupDone`
    // via `ref.watch(riderProvider.select((p) => p.rider))`. The
    // select uses this `==` to decide whether to re-fire. If the API
    // returned two responses that share id+updatedAt but differ in
    // pickupDone/lifecycleStatus (which can happen when the server
    // cache serves a pre-activation response for one or two polls
    // after admin flips the rider to ACTIVE), the watch saw them as
    // equal and never re-fired. The rider stayed stuck on hangTight
    // for the full cache TTL plus however long it took for a real
    // updatedAt bump to land.
    //
    // The fix: include `lifecycleStatus` and `pickupDone` in the
    // equality contract. These are the two fields the routing layer
    // cares about (lifecycle gate reads lifecycleStatus, hangTight
    // reads pickupDone). Other fields (pickup photos, plan choice,
    // KYC sub-fields) can be ignored because they don't drive
    // screen-level state transitions.
    //
    // PR-ONBOARDING-FLOW-2026-08-13: extend the contract to also
    // include `kycStatus` and `depositStatus`. A rider on HangTight
    // (rank 10) whose KYC or deposit is approved by admin in another
    // tab needs the status row on the HangTight screen to flip
    // immediately — the rider watches this screen for an hour or
    // more waiting for admin to flip them to ACTIVE, and seeing
    // "KYC under review" after admin has approved it is confusing.
    // Including these two fields in equality ensures the watch
    // re-fires on KYC / deposit transitions even when the rider's
    // `updatedAt` doesn't bump (e.g., when only `kycDoneAt` is set
    // PR-AUDIT-FIX 2026-08-17 (HT-P1-1): include assignedVehicle,
    // guarantorStatus, and planStatus so changes made by admin
    // immediately re-render HangTightScreen and other selective listeners.
    return other.id == id &&
        other.updatedAt == updatedAt &&
        other.lifecycleStatus == lifecycleStatus &&
        other.pickupDone == pickupDone &&
        other.kycStatus == kycStatus &&
        other.depositStatus == depositStatus &&
        other.assignedVehicle == assignedVehicle &&
        other.guarantorStatus == guarantorStatus &&
        other.planStatus == planStatus;
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hashAll(
        [
          id,
          updatedAt,
          lifecycleStatus,
          pickupDone,
          kycStatus,
          depositStatus,
          assignedVehicle,
          guarantorStatus,
          planStatus,
        ],
      );

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  String toString() =>
      'RiderModel(riderId: $riderId, name: $name, intent: $intent, submissionDate: $submissionDate)';

  RiderModel copyWith({
    String? id,
    String? riderId,
    String? phone,
    String? name,
    String? email,
    String? fatherName,
    String? motherName,
    DateTime? dob,
    String? currentAddress,
    String? profilePhoto,
    String? riderPhoto,
    String? signature,
    KycStatus? kycStatus,
    String? aadhaarFront,
    String? aadhaarBack,
    String? panCard,
    String? bankAccount,
    String? bankIfsc,
    String? bankName,
    String? guarantorName,
    String? guarantorRelation,
    DateTime? guarantorDob,
    String? guarantorPhone,
    String? guarantorAadhaarFront,
    String? guarantorAadhaarBack,
    String? guarantorPan,
    String? guarantorVideo,
    String? guarantorSignature,
    GuarantorStatus? guarantorStatus,
    double? walletBalance,
    double? securityDeposit,
    DepositStatus? depositStatus,
    int? paymentStreak,
    String? planStatus,
    String? currentPlan,
    String? currentPlanId,
    double? currentPlanPrice,
    double? currentPlanSecurityDepositInRupees,
    DateTime? planStartDate,
    DateTime? planEndDate,
    String? rentalStatus,
    String? assignedVehicle,
    String? vehicleModel,
    String? pickupHub,
    String? teamLeader,
    String? teamLeaderPhone,
    String? emergencyContact,
    bool? registrationDone,
    bool? depositDone,
    bool? kycDone,
    bool? planDone,
    bool? pickupDone,
    AccountStatus? accountStatus,
    String? lifecycleStatus,
    RiderLifecycleStage? lifecycleStage,
    bool? isNewRider,
    DateTime? createdAt,
    DateTime? updatedAt,
    String? intent,
    DateTime? submissionDate,
    bool? returnPending,
    String? preferredLocale,
    String? bankPassbook,
    String? guarantorPhoto,
    String? guarantorAddress,
    double? weeklyDistance,
    double? carbonSaved,
    double? currentSpeed,
    double? batteryPercent,
  }) {
    return RiderModel(
      id: id ?? this.id,
      riderId: riderId ?? this.riderId,
      phone: phone ?? this.phone,
      name: name ?? this.name,
      email: email ?? this.email,
      fatherName: fatherName ?? this.fatherName,
      motherName: motherName ?? this.motherName,
      dob: dob ?? this.dob,
      currentAddress: currentAddress ?? this.currentAddress,
      profilePhoto: profilePhoto ?? this.profilePhoto,
      riderPhoto: riderPhoto ?? this.riderPhoto,
      signature: signature ?? this.signature,
      kycStatus: kycStatus ?? this.kycStatus,
      aadhaarFront: aadhaarFront ?? this.aadhaarFront,
      aadhaarBack: aadhaarBack ?? this.aadhaarBack,
      panCard: panCard ?? this.panCard,
      bankAccount: bankAccount ?? this.bankAccount,
      bankIfsc: bankIfsc ?? this.bankIfsc,
      bankName: bankName ?? this.bankName,
      guarantorName: guarantorName ?? this.guarantorName,
      guarantorRelation: guarantorRelation ?? this.guarantorRelation,
      guarantorDob: guarantorDob ?? this.guarantorDob,
      guarantorPhone: guarantorPhone ?? this.guarantorPhone,
      guarantorAadhaarFront:
          guarantorAadhaarFront ?? this.guarantorAadhaarFront,
      guarantorAadhaarBack: guarantorAadhaarBack ?? this.guarantorAadhaarBack,
      guarantorPan: guarantorPan ?? this.guarantorPan,
      guarantorVideo: guarantorVideo ?? this.guarantorVideo,
      guarantorSignature: guarantorSignature ?? this.guarantorSignature,
      guarantorStatus: guarantorStatus ?? this.guarantorStatus,
      walletBalance: walletBalance ?? this.walletBalance,
      securityDeposit: securityDeposit ?? this.securityDeposit,
      depositStatus: depositStatus ?? this.depositStatus,
      paymentStreak: paymentStreak ?? this.paymentStreak,
      planStatus: planStatus ?? this.planStatus,
      currentPlan: currentPlan ?? this.currentPlan,
      currentPlanId: currentPlanId ?? this.currentPlanId,
      currentPlanPrice: currentPlanPrice ?? this.currentPlanPrice,
      currentPlanSecurityDepositInRupees: currentPlanSecurityDepositInRupees ??
          this.currentPlanSecurityDepositInRupees,
      planStartDate: planStartDate ?? this.planStartDate,
      planEndDate: planEndDate ?? this.planEndDate,
      rentalStatus: rentalStatus ?? this.rentalStatus,
      assignedVehicle: assignedVehicle ?? this.assignedVehicle,
      vehicleModel: vehicleModel ?? this.vehicleModel,
      pickupHub: pickupHub ?? this.pickupHub,
      teamLeader: teamLeader ?? this.teamLeader,
      teamLeaderPhone: teamLeaderPhone ?? this.teamLeaderPhone,
      emergencyContact: emergencyContact ?? this.emergencyContact,
      registrationDone: registrationDone ?? this.registrationDone,
      depositDone: depositDone ?? this.depositDone,
      kycDone: kycDone ?? this.kycDone,
      planDone: planDone ?? this.planDone,
      pickupDone: pickupDone ?? this.pickupDone,
      accountStatus: accountStatus ?? this.accountStatus,
      lifecycleStatus: lifecycleStatus ?? this.lifecycleStatus,
      lifecycleStage: lifecycleStage ?? this.lifecycleStage,
      isNewRider: isNewRider ?? this.isNewRider,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      intent: intent ?? this.intent,
      submissionDate: submissionDate ?? this.submissionDate,
      returnPending: returnPending ?? this.returnPending,
      preferredLocale: preferredLocale ?? this.preferredLocale,
      pickupPhotoFront: pickupPhotoFront,
      pickupPhotoBack: pickupPhotoBack,
      pickupPhotoLeft: pickupPhotoLeft,
      pickupPhotoRight: pickupPhotoRight,
      pickupPhotoWithVehicle: pickupPhotoWithVehicle,
      bankPassbook: bankPassbook ?? this.bankPassbook,
      guarantorPhoto: guarantorPhoto ?? this.guarantorPhoto,
      guarantorAddress: guarantorAddress ?? this.guarantorAddress,
      weeklyDistance: weeklyDistance ?? this.weeklyDistance,
      carbonSaved: carbonSaved ?? this.carbonSaved,
      currentSpeed: currentSpeed ?? this.currentSpeed,
      batteryPercent: batteryPercent ?? this.batteryPercent,
    );
  }

  /// Helper to get the price of the active rental plan. Ideally this should come
  /// down from the backend, but mapped here for client logic.
  @JsonKey(includeFromJson: false, includeToJson: false)
  double get activeRentalPlanPrice {
    // Use actual price from backend if available (already converted from paise in fromJson).
    if (currentPlanPrice != null && currentPlanPrice! > 0) {
      return currentPlanPrice!;
    }
    return 0.0;
  }

  /// PR-RUPEES-2026-08-08: the security deposit for the active rental
  /// plan, in **rupees**. Reads from `currentPlanSecurityDepositInRupees`
  /// (server-joined via `currentPlanRef`); returns 0.0 when no plan is
  /// active. Replaces the hardcoded
  /// `AppConstants.planSecurityDepositRupees` map.
  @JsonKey(includeFromJson: false, includeToJson: false)
  double get activeRentalPlanSecurityDeposit {
    return currentPlanSecurityDepositInRupees ?? 0.0;
  }

  // ── Derived Lifecycle & Progress Status Getters ─────────────────────────

  @JsonKey(includeFromJson: false, includeToJson: false)
  int get lifecycleRankValue => lifecycleRank(this);

  @JsonKey(includeFromJson: false, includeToJson: false)
  bool get isRegistrationDone =>
      registrationDone ||
      (lifecycleStatus.isNotEmpty && lifecycleRank(this) >= 2);

  @JsonKey(includeFromJson: false, includeToJson: false)
  bool get isKycApproved =>
      kycDone ||
      kycStatus == KycStatus.approved ||
      (lifecycleStatus.isNotEmpty && lifecycleRank(this) >= 10);

  @JsonKey(includeFromJson: false, includeToJson: false)
  bool get isDepositDone =>
      depositDone ||
      depositStatus == DepositStatus.approved ||
      (securityDeposit > 0) ||
      (lifecycleStatus.isNotEmpty && lifecycleRank(this) >= 10);

  @JsonKey(includeFromJson: false, includeToJson: false)
  bool get isPlanDone =>
      planDone ||
      (currentPlan?.isNotEmpty ?? false) ||
      (lifecycleStatus.isNotEmpty && lifecycleRank(this) >= 9);

  @JsonKey(includeFromJson: false, includeToJson: false)
  // PR-ONBOARDING-FLOW-2026-08-13: pickupDone threshold bumped from
  // rank >= 10 to rank >= 11 to match the server-side computation
  // (flatten-rider.ts). PICKUP_SCHEDULED (rank 10) means the rider
  // has submitted the pickup form but is still waiting for admin
  // approval on the hangTight screen — `pickupDone` should NOT be
  // true at this rank, otherwise the hangTight auto-redirect fires
  // immediately and the rider skips the admin-approval wait.
  bool get isPickupDone =>
      pickupDone ||
      (assignedVehicle?.isNotEmpty ?? false) ||
      (lifecycleStatus.isNotEmpty && lifecycleRank(this) >= 11);

  @JsonKey(includeFromJson: false, includeToJson: false)
  bool get isKycRejected => kycStatus == KycStatus.rejected;

  @JsonKey(includeFromJson: false, includeToJson: false)
  bool get isKycSubmitted => kycStatus == KycStatus.submitted;

  @JsonKey(includeFromJson: false, includeToJson: false)
  bool get isActuallyActive =>
      accountStatus == AccountStatus.active ||
      (lifecycleStatus.isNotEmpty && lifecycleRank(this) >= 11);

  // ── Compound State Getters (used by PreDashboardScreen) ────────────────

  @JsonKey(includeFromJson: false, includeToJson: false)
  bool get isPlanRejected => planStatus == 'REJECTED';

  @JsonKey(includeFromJson: false, includeToJson: false)
  bool get isDepositRejected => depositRecord?.status == DepositStatus.rejected;

  @JsonKey(includeFromJson: false, includeToJson: false)
  bool get isAwaitingPickup => isPlanDone && !isPickupDone;

  @JsonKey(includeFromJson: false, includeToJson: false)
  bool get needsPlanSelection => isRegistrationDone && !isPlanDone;

  @JsonKey(includeFromJson: false, includeToJson: false)
  bool get needsRegistrationStart =>
      !isRegistrationDone && !isKycRejected && !isKycSubmitted;

  @JsonKey(includeFromJson: false, includeToJson: false)
  bool get needsDeposit => isPlanDone && !isDepositDone;

  @JsonKey(includeFromJson: false, includeToJson: false)
  bool get canSubmitDeposit =>
      depositRecord == null ||
      depositRecord!.status == DepositStatus.notSubmitted;

  @JsonKey(includeFromJson: false, includeToJson: false)
  bool get isDepositPending =>
      depositRecord != null &&
      (depositRecord!.status == DepositStatus.pending ||
          depositRecord!.status == DepositStatus.pendingVerification ||
          depositRecord!.status == DepositStatus.rejected);

  @JsonKey(includeFromJson: false, includeToJson: false)
  bool get isReadyForPickup => isDepositDone && isKycApproved && !isPickupDone;

  /// Calculate the required payment amount (security deposit + advance rent if advanceRentPaid is true, else security deposit).
  double requiredPaymentAmount(double walletMinTopup) {
    final secDeposit = activeRentalPlanSecurityDeposit;
    final planPrice = activeRentalPlanPrice;

    if (advanceRentPaid) {
      return secDeposit + planPrice;
    }
    return secDeposit > 0
        ? secDeposit
        : (planPrice > 0 ? planPrice : walletMinTopup);
  }

  // ── fromJson ────────────────────────────────────────────────────────────

  factory RiderModel.fromJson(Map<String, dynamic> json) {
    return RiderModel(
      id: json['id'] as String?,
      riderId: json['riderId'] as String? ?? '',
      phone: json['phone'] as String? ?? '',
      name: json['name'] as String? ?? '',
      email: json['email'] as String?,
      fatherName: json['fatherName'] as String?,
      motherName: json['motherName'] as String?,
      dob: _parseDate(json['dob']),
      currentAddress: json['currentAddress'] as String?,
      profilePhoto: json['profilePhoto'] as String?,
      riderPhoto: json['riderPhoto'] as String?,
      signature: json['signature'] as String?,
      kycStatus: _parseKycStatus(json['kycStatus']),
      aadhaarFront: json['aadhaarFront'] as String?,
      aadhaarBack: json['aadhaarBack'] as String?,
      panCard: json['panCard'] as String?,
      kycRejectionReason: json['kycProfile'] is Map
          ? (json['kycProfile'] as Map)['rejectionReason'] as String?
          : null,
      bankAccount: json['bankAccount'] as String?,
      bankIfsc: json['bankIfsc'] as String?,
      bankName: json['bankName'] as String?,
      guarantorName: json['guarantorName'] as String?,
      guarantorRelation: json['guarantorRelation'] as String?,
      guarantorDob: _parseDate(json['guarantorDob']),
      guarantorPhone: json['guarantorPhone'] as String?,
      guarantorAadhaarFront: json['guarantorAadhaarFront'] as String?,
      guarantorAadhaarBack: json['guarantorAadhaarBack'] as String?,
      guarantorPan: json['guarantorPan'] as String?,
      guarantorVideo: json['guarantorVideo'] as String?,
      guarantorSignature: json['guarantorSignature'] as String?,
      guarantorStatus: _parseGuarantorStatus(json['guarantorStatus']),
      walletBalance: _toDouble(json['walletBalance']),
      securityDeposit: _toDouble(json['securityDeposit']),
      depositStatus: _parseDepositStatus(json['depositStatus']),
      paymentStreak: json['paymentStreak'] as int? ?? 0,
      planStatus: json['planStatus'] as String? ?? 'NONE',
      // Device policy (Phase 2.6).
      fcmToken: json['fcmToken'] as String?,
      isAdminLocked: json['isAdminLocked'] as bool? ?? false,
      isUninstallBlocked: json['isUninstallBlocked'] as bool? ?? false,
      isLocationMandatory: json['isLocationMandatory'] as bool? ?? false,
      isAppsControlRestricted:
          json['isAppsControlRestricted'] as bool? ?? false,
      deviceAdminGranted: json['deviceAdminGranted'] as bool? ?? false,
      displayOverlayGranted: json['displayOverlayGranted'] as bool? ?? false,
      lastDeviceViolationAt: json['lastDeviceViolationAt'] != null
          ? DateTime.tryParse(json['lastDeviceViolationAt'] as String)
          : null,
      deviceViolationCount: json['deviceViolationCount'] as int? ?? 0,
      currentPlan: json['currentPlan'] as String?,
      currentPlanId: json['currentPlanId'] as String?,
      currentPlanPrice: _toRupees(
              json['currentPlanPriceInRupees'], json['currentPlanPrice']) ??
          _toDouble(json['currentPlanPrice'], convertPaise: true),
      // PR-RUPEES-2026-08-08: prefer the new rupees field, fall back
      // to the legacy paise field for backwards-compat during the
      // rollout window.
      currentPlanSecurityDepositInRupees: _toRupees(
        json['currentPlanSecurityDepositInRupees'],
        json['currentPlanSecurityDepositInPaise'],
      ),
      planStartDate: json['planStartDate'] != null
          ? DateTime.tryParse(json['planStartDate'] as String)
          : null,
      planEndDate: json['planEndDate'] != null
          ? DateTime.tryParse(json['planEndDate'] as String)
          : null,
      rentalStatus: json['rentalStatus'] as String? ?? 'NONE',
      assignedVehicle: json['assignedVehicle'] as String?,
      vehicleModel: json['vehicleModel'] as String?,
      pickupHub: json['pickupHub'] as String?,
      teamLeader: json['teamLeader'] as String?,
      teamLeaderPhone: json['teamLeaderPhone'] as String?,
      emergencyContact: json['emergencyContact'] as String?,
      registrationDone: json['registrationDone'] as bool? ?? false,
      depositDone: json['depositDone'] as bool? ?? false,
      kycDone: json['kycDone'] as bool? ?? false,
      planDone: json['planDone'] as bool? ?? false,
      pickupDone: json['pickupDone'] as bool? ?? false,
      accountStatus: _parseAccountStatus(json['accountStatus']),
      lifecycleStatus: json['lifecycleStatus'] as String? ??
          json['state'] as String? ??
          'NEW',
      // PR-K.2: prefer the new 5-value stage column. Fall back to mapping
      // from the legacy 15-value status if the new column is null/empty.
      lifecycleStage: (json['lifecycleStage'] as String? ?? '').isNotEmpty
          ? parseRiderLifecycleStage(json['lifecycleStage'] as String?)
          : lifecycleStageFromStatus(
              json['lifecycleStatus'] as String? ?? 'NEW'),
      isNewRider: json['isNewRider'] as bool? ?? false,
      referralCode: json['referralCode'] as String?,
      totalRewardPoints: json['totalRewardPoints'] as int? ?? 0,
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'] as String)
          : null,
      updatedAt: json['updatedAt'] != null
          ? DateTime.tryParse(json['updatedAt'] as String)
          : null,
      intent: json['intent'] as String?,
      submissionDate: json['submissionDate'] != null
          ? DateTime.tryParse(json['submissionDate'] as String)
          : null,
      returnPending: json['returnPending'] as bool? ?? false,
      preferredLocale: json['preferredLocale'] as String?,
      advanceRentPaid: json['advanceRentPaid'] as bool? ?? false,
      pickupPhotoFront: json['pickupPhotoFront'] as String?,
      pickupPhotoBack: json['pickupPhotoBack'] as String?,
      pickupPhotoLeft: json['pickupPhotoLeft'] as String?,
      pickupPhotoRight: json['pickupPhotoRight'] as String?,
      pickupPhotoWithVehicle: json['pickupPhotoWithVehicle'] as String?,
      bankPassbook: json['bankPassbook'] as String?,
      guarantorPhoto: json['guarantorPhoto'] as String?,
      guarantorAddress: json['guarantorAddress'] as String?,
      weeklyDistance: _toDouble(json['weeklyDistance'] ?? 0.0),
      carbonSaved: _toDouble(json['carbonSaved'] ?? 0.0),
      currentSpeed: _toDouble(json['currentSpeed'] ?? 0.0),
      batteryPercent: _toDouble(json['batteryPercent'] ?? 0.0),
      upcomingRentPrompt: json['upcomingRentPrompt'] != null
          ? UpcomingRentPrompt.fromJson(
              json['upcomingRentPrompt'] as Map<String, dynamic>)
          : null,
    );
  }

  // ── toCacheMap (minimal fields for instant UI load) ─────────────────────

  Map<String, dynamic> toCacheMap() {
    return {
      'id': id,
      'riderId': riderId,
      'walletBalance': walletBalance,
      'securityDeposit': securityDeposit,
      'currentPlan': currentPlan,
      'currentPlanPrice': currentPlanPrice,
      'assignedVehicle': assignedVehicle,
      'vehicleModel': vehicleModel,
      'pickupHub': pickupHub,
      'teamLeader': teamLeader,
      'teamLeaderPhone': teamLeaderPhone,
      'emergencyContact': emergencyContact,
      'accountStatus': accountStatus.name,
      'lifecycleStatus': lifecycleStatus,
      'isNewRider': isNewRider,
      'kycStatus': kycStatus.name,
      'rentalStatus': rentalStatus,
      'name': name,
      'phone': phone,
      'intent': intent,
      'preferredLocale': preferredLocale,
      'submissionDate': submissionDate?.toIso8601String(),
      'returnPending': returnPending,
      'registrationDone': registrationDone,
      'depositDone': depositDone,
      'kycDone': kycDone,
      'planDone': planDone,
      'pickupDone': pickupDone,
      'planStartDate': planStartDate?.toIso8601String(),
      'planEndDate': planEndDate?.toIso8601String(),
      'paymentStreak': paymentStreak,
    };
  }

  // ── fromCacheMap (hydrates only cache-able fields) ─────────────────────

  factory RiderModel.fromCacheMap(Map<String, dynamic> cache) {
    return RiderModel(
      id: cache['id'] as String?,
      riderId: cache['riderId'] as String? ?? '',
      name: cache['name'] as String? ?? '',
      phone: cache['phone'] as String? ?? '',
      email: cache['email'] as String?,
      fatherName: cache['fatherName'] as String?,
      motherName: cache['motherName'] as String?,
      dob: cache['dob'] != null
          ? DateTime.tryParse(cache['dob'] as String)
          : null,
      currentAddress: cache['currentAddress'] as String?,
      emergencyContact: cache['emergencyContact'] as String?,
      profilePhoto: cache['profilePhoto'] as String?,
      walletBalance: _toDouble(cache['walletBalance']),
      securityDeposit: _toDouble(cache['securityDeposit']),
      currentPlan: cache['currentPlan'] as String?,
      currentPlanId: cache['currentPlanId'] as String?,
      currentPlanPrice: _toDouble(cache['currentPlanPrice']),
      currentPlanSecurityDepositInRupees:
          cache['currentPlanSecurityDepositInRupees'] as double?,
      assignedVehicle: cache['assignedVehicle'] as String?,
      vehicleModel: cache['vehicleModel'] as String?,
      pickupHub: cache['pickupHub'] as String?,
      teamLeader: cache['teamLeader'] as String?,
      teamLeaderPhone: cache['teamLeaderPhone'] as String?,
      paymentStreak: cache['paymentStreak'] as int? ?? 0,
      planStartDate: cache['planStartDate'] != null
          ? DateTime.tryParse(cache['planStartDate'] as String)
          : null,
      planEndDate: cache['planEndDate'] != null
          ? DateTime.tryParse(cache['planEndDate'] as String)
          : null,
      guarantorName: cache['guarantorName'] as String?,
      guarantorPhone: cache['guarantorPhone'] as String?,
      guarantorAddress: cache['guarantorAddress'] as String?,
      guarantorStatus: _parseGuarantorStatus(cache['guarantorStatus']),
      guarantorPhoto: cache['guarantorPhoto'] as String?,
      depositStatus: _parseDepositStatus(cache['depositStatus']),
      aadhaarFront: cache['aadhaarFront'] as String?,
      aadhaarBack: cache['aadhaarBack'] as String?,
      panCard: cache['panCard'] as String?,
      signature: cache['signature'] as String?,
      guarantorAadhaarFront: cache['guarantorAadhaarFront'] as String?,
      guarantorAadhaarBack: cache['guarantorAadhaarBack'] as String?,
      guarantorPan: cache['guarantorPan'] as String?,
      guarantorVideo: cache['guarantorVideo'] as String?,
      guarantorSignature: cache['guarantorSignature'] as String?,
      accountStatus: _parseAccountStatus(cache['accountStatus']),
      lifecycleStatus: cache['lifecycleStatus'] as String? ?? 'NEW',
      isNewRider: _toBool(cache['isNewRider']) ?? false,
      kycStatus: _parseKycStatus(cache['kycStatus']),
      rentalStatus: cache['rentalStatus'] as String? ?? 'NONE',
      returnPending: _toBool(cache['returnPending']) ?? false,
      intent: cache['intent'] as String?,
      submissionDate: cache['submissionDate'] != null
          ? DateTime.tryParse(cache['submissionDate'] as String)
          : null,
      registrationDone: _toBool(cache['registrationDone']) ?? false,
      depositDone: _toBool(cache['depositDone']) ?? false,
      kycDone: _toBool(cache['kycDone']) ?? false,
      planDone: _toBool(cache['planDone']) ?? false,
      pickupDone: _toBool(cache['pickupDone']) ?? false,
    );
  }

  // ── toJson ──────────────────────────────────────────────────────────────

  Map<String, dynamic> toJson() => _$RiderModelToJson(this);

  // ── Private helpers ─────────────────────────────────────────────────────

  static bool? _toBool(dynamic value) {
    if (value == null) return null;
    if (value is bool) return value;
    if (value is String) {
      return value.toLowerCase() == 'true';
    }
    return null;
  }

  static double _toDouble(dynamic value, {bool convertPaise = false}) {
    if (value == null) return 0.0;
    double d;
    if (value is double) {
      d = value;
    } else if (value is int) {
      d = value.toDouble();
    } else if (value is String) {
      d = double.tryParse(value) ?? 0.0;
    } else {
      d = 0.0;
    }
    // PR-RUPEES-2026-08-08: the `convertPaise` parameter is kept for
    // backwards-compat with existing callers, but the API now
    // returns rupees directly. New code should use the typed
    // `_toRupees()` helper instead.
    return convertPaise ? d / 100 : d;
  }

  /// PR-RUPEES-2026-08-08: helper for the deposit-in-rupees migration.
  /// Accepts the new `*InRupees` field as the primary source, with the
  /// legacy `*InPaise` field as a fallback during the rollout. Returns
  /// null when both are missing (caller treats as "no plan" / "no deposit").
  static double? _toRupees(dynamic rupeesValue, dynamic paiseValue) {
    if (rupeesValue is num) return rupeesValue.toDouble();
    if (rupeesValue is String) {
      final parsed = double.tryParse(rupeesValue);
      if (parsed != null) return parsed;
    }
    if (paiseValue is num) return paiseValue.toDouble() / 100.0;
    if (paiseValue is String) {
      final parsed = int.tryParse(paiseValue);
      if (parsed != null) return parsed / 100.0;
    }
    return null;
  }

  static DateTime? _parseDate(dynamic value) {
    if (value == null) return null;
    if (value is DateTime) return value;
    final str = value.toString().trim();
    if (str.isEmpty) return null;
    // Try ISO 8601 format first (YYYY-MM-DD)
    final DateTime? result = DateTime.tryParse(str);
    if (result != null) return result;
    // Try DD-MM-YYYY format
    final parts = str.split('-');
    if (parts.length == 3) {
      final day = int.tryParse(parts[0]);
      final month = int.tryParse(parts[1]);
      final year = int.tryParse(parts[2]);
      if (day != null &&
          month != null &&
          year != null &&
          day >= 1 &&
          day <= 31 &&
          month >= 1 &&
          month <= 12 &&
          year >= 1900) {
        return DateTime(year, month, day);
      }
    }
    return null;
  }

  static KycStatus _parseKycStatus(dynamic value) {
    if (value == null) return KycStatus.pending;
    if (value is KycStatus) return value;
    final str = value.toString().toUpperCase();
    return KycStatus.values.firstWhere(
      (e) => e.name.toUpperCase() == str,
      orElse: () => KycStatus.pending,
    );
  }

  static GuarantorStatus _parseGuarantorStatus(dynamic value) {
    if (value == null) return GuarantorStatus.pending;
    if (value is GuarantorStatus) return value;
    final str = value.toString().toUpperCase();
    return GuarantorStatus.values.firstWhere(
      (e) => e.name.toUpperCase() == str,
      orElse: () => GuarantorStatus.pending,
    );
  }

  static AccountStatus _parseAccountStatus(dynamic value) {
    if (value == null) return AccountStatus.preActive;
    if (value is AccountStatus) return value;
    final str = value.toString().toUpperCase();
    return AccountStatus.values.firstWhere(
      (e) => e.name.toUpperCase() == str,
      orElse: () => AccountStatus.preActive,
    );
  }

  static DepositStatus _parseDepositStatus(dynamic value) {
    if (value == null) return DepositStatus.pending;
    if (value is DepositStatus) return value;
    final str = value.toString().toUpperCase();
    return DepositStatus.values.firstWhere(
      (e) => e.name.toUpperCase() == str,
      orElse: () => DepositStatus.pending,
    );
  }
}
