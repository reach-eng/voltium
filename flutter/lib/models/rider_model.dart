// Enum definitions for RiderModel field types

import 'package:json_annotation/json_annotation.dart';

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
  final String? currentPlan;
  final DateTime? planStartDate;
  final DateTime? planEndDate;

  // ── Rental ──────────────────────────────────────────────────────────────
  final String rentalStatus;
  final String? assignedVehicle;
  final String? pickupHub;
  final String? teamLeader;
  final String? emergencyContact;
  final String? intent;
  final DateTime? submissionDate;
  final bool returnPending;
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

  // ── Account ─────────────────────────────────────────────────────────────
  final AccountStatus accountStatus;
  final String lifecycleStatus;

  // ── Referral & Rewards ───────────────────────────────────────────────────
  final String? referralCode;
  final int totalRewardPoints;

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
    this.paymentStreak = 0,
    this.planStatus = 'NONE',
    this.currentPlan,
    this.planStartDate,
    this.planEndDate,
    this.rentalStatus = 'NONE',
    this.assignedVehicle,
    this.pickupHub,
    this.teamLeader,
    this.emergencyContact,
    this.registrationDone = false,
    this.depositDone = false,
    this.kycDone = false,
    this.planDone = false,
    this.pickupDone = false,
    this.accountStatus = AccountStatus.preActive,
    this.lifecycleStatus = 'NEW',
    this.referralCode,
    this.totalRewardPoints = 0,
    this.createdAt,
    this.updatedAt,
    this.intent,
    this.submissionDate,
    this.returnPending = false,
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
    return other is RiderModel &&
        other.id == id &&
        other.updatedAt == updatedAt;
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hashAll([id, updatedAt]);

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
    DateTime? planStartDate,
    DateTime? planEndDate,
    String? rentalStatus,
    String? assignedVehicle,
    String? pickupHub,
    String? teamLeader,
    String? emergencyContact,
    bool? registrationDone,
    bool? depositDone,
    bool? kycDone,
    bool? planDone,
    bool? pickupDone,
    AccountStatus? accountStatus,
    String? lifecycleStatus,
    DateTime? createdAt,
    DateTime? updatedAt,
    String? intent,
    DateTime? submissionDate,
    bool? returnPending,
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
      planStartDate: planStartDate ?? this.planStartDate,
      planEndDate: planEndDate ?? this.planEndDate,
      rentalStatus: rentalStatus ?? this.rentalStatus,
      assignedVehicle: assignedVehicle ?? this.assignedVehicle,
      pickupHub: pickupHub ?? this.pickupHub,
      teamLeader: teamLeader ?? this.teamLeader,
      emergencyContact: emergencyContact ?? this.emergencyContact,
      registrationDone: registrationDone ?? this.registrationDone,
      depositDone: depositDone ?? this.depositDone,
      kycDone: kycDone ?? this.kycDone,
      planDone: planDone ?? this.planDone,
      pickupDone: pickupDone ?? this.pickupDone,
      accountStatus: accountStatus ?? this.accountStatus,
      lifecycleStatus: lifecycleStatus ?? this.lifecycleStatus,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      intent: intent ?? this.intent,
      submissionDate: submissionDate ?? this.submissionDate,
      returnPending: returnPending ?? this.returnPending,
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
    switch (currentPlan?.toUpperCase()) {
      case 'WEEKLY_MAX':
        return 1500.0;
      case 'WEEKLY_BASIC':
        return 1000.0;
      case 'DAILY_FLEX':
        return 250.0;
      default:
        // Default safe fallback plan price.
        return 1500.0;
    }
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
      currentPlan: json['currentPlan'] as String?,
      planStartDate: json['planStartDate'] != null
          ? DateTime.tryParse(json['planStartDate'] as String)
          : null,
      planEndDate: json['planEndDate'] != null
          ? DateTime.tryParse(json['planEndDate'] as String)
          : null,
      rentalStatus: json['rentalStatus'] as String? ?? 'NONE',
      assignedVehicle: json['assignedVehicle'] as String?,
      pickupHub: json['pickupHub'] as String?,
      teamLeader: json['teamLeader'] as String?,
      emergencyContact: json['emergencyContact'] as String?,
      registrationDone: json['registrationDone'] as bool? ?? false,
      depositDone: json['depositDone'] as bool? ?? false,
      kycDone: json['kycDone'] as bool? ?? false,
      planDone: json['planDone'] as bool? ?? false,
      pickupDone: json['pickupDone'] as bool? ?? false,
      accountStatus: _parseAccountStatus(json['accountStatus']),
      lifecycleStatus: json['lifecycleStatus'] as String? ?? 'NEW',
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
    );
  }

  // ── toCacheMap (minimal fields for instant UI load) ─────────────────────

  Map<String, dynamic> toCacheMap() {
    return {
      'id': id,
      'riderId': riderId,
      'walletBalance': walletBalance,
      'currentPlan': currentPlan,
      'assignedVehicle': assignedVehicle,
      'accountStatus': accountStatus.name,
      'lifecycleStatus': lifecycleStatus,
      'kycStatus': kycStatus.name,
      'rentalStatus': rentalStatus,
      'name': name,
      'phone': phone,
      'intent': intent,
      'submissionDate': submissionDate?.toIso8601String(),
      'returnPending': returnPending,
      'registrationDone': registrationDone,
      'depositDone': depositDone,
      'kycDone': kycDone,
      'planDone': planDone,
      'pickupDone': pickupDone,
    };
  }

  // ── fromCacheMap (hydrates only cache-able fields) ─────────────────────

  factory RiderModel.fromCacheMap(Map<String, dynamic> cache) {
    return RiderModel(
      id: cache['id'] as String?,
      riderId: cache['riderId'] as String? ?? '',
      name: cache['name'] as String? ?? '',
      phone: cache['phone'] as String? ?? '',
      walletBalance: _toDouble(cache['walletBalance']),
      currentPlan: cache['currentPlan'] as String?,
      assignedVehicle: cache['assignedVehicle'] as String?,
      accountStatus: _parseAccountStatus(cache['accountStatus']),
      lifecycleStatus: cache['lifecycleStatus'] as String? ?? 'NEW',
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

  static double _toDouble(dynamic value) {
    if (value == null) return 0.0;
    if (value is double) return value;
    if (value is int) return value.toDouble();
    if (value is String) return double.tryParse(value) ?? 0.0;
    return 0.0;
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
