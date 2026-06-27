import 'package:json_annotation/json_annotation.dart';

import 'rider_model.dart';

part 'rider_kyc.g.dart';

/// KYC verification, bank details, and guarantor information.
///
/// Extracted from [RiderModel] — widgets that show KYC status or
/// guarantor info can depend only on this sub-model.
@JsonSerializable()
class RiderKYC {
  final KycStatus kycStatus;
  final String? aadhaarFront;
  final String? aadhaarBack;
  final String? panCard;
  final String? kycRejectionReason;

  // ── Bank ──────────────────────────────────────────────────────────
  final String? bankAccount;
  final String? bankIfsc;
  final String? bankName;
  final String? bankPassbook;

  // ── Guarantor ─────────────────────────────────────────────────────
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

  // ── Deposit ───────────────────────────────────────────────────────
  final double securityDeposit;
  final DepositStatus depositStatus;

  // ── Lifecycle booleans (verification gates) ───────────────────────
  final bool registrationDone;
  final bool depositDone;
  final bool kycDone;

  const RiderKYC({
    this.kycStatus = KycStatus.pending,
    this.aadhaarFront,
    this.aadhaarBack,
    this.panCard,
    this.kycRejectionReason,
    this.bankAccount,
    this.bankIfsc,
    this.bankName,
    this.bankPassbook,
    this.guarantorName,
    this.guarantorRelation,
    this.guarantorDob,
    this.guarantorPhone,
    this.guarantorAadhaarFront,
    this.guarantorAadhaarBack,
    this.guarantorPan,
    this.guarantorVideo,
    this.guarantorSignature,
    this.guarantorPhoto,
    this.guarantorAddress,
    this.guarantorStatus = GuarantorStatus.pending,
    this.securityDeposit = 0.0,
    this.depositStatus = DepositStatus.pending,
    this.registrationDone = false,
    this.depositDone = false,
    this.kycDone = false,
  });

  RiderKYC copyWith({
    KycStatus? kycStatus,
    String? aadhaarFront,
    String? aadhaarBack,
    String? panCard,
    String? kycRejectionReason,
    String? bankAccount,
    String? bankIfsc,
    String? bankName,
    String? bankPassbook,
    String? guarantorName,
    String? guarantorRelation,
    DateTime? guarantorDob,
    String? guarantorPhone,
    String? guarantorAadhaarFront,
    String? guarantorAadhaarBack,
    String? guarantorPan,
    String? guarantorVideo,
    String? guarantorSignature,
    String? guarantorPhoto,
    String? guarantorAddress,
    GuarantorStatus? guarantorStatus,
    double? securityDeposit,
    DepositStatus? depositStatus,
    bool? registrationDone,
    bool? depositDone,
    bool? kycDone,
  }) {
    return RiderKYC(
      kycStatus: kycStatus ?? this.kycStatus,
      aadhaarFront: aadhaarFront ?? this.aadhaarFront,
      aadhaarBack: aadhaarBack ?? this.aadhaarBack,
      panCard: panCard ?? this.panCard,
      kycRejectionReason: kycRejectionReason ?? this.kycRejectionReason,
      bankAccount: bankAccount ?? this.bankAccount,
      bankIfsc: bankIfsc ?? this.bankIfsc,
      bankName: bankName ?? this.bankName,
      bankPassbook: bankPassbook ?? this.bankPassbook,
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
      guarantorPhoto: guarantorPhoto ?? this.guarantorPhoto,
      guarantorAddress: guarantorAddress ?? this.guarantorAddress,
      guarantorStatus: guarantorStatus ?? this.guarantorStatus,
      securityDeposit: securityDeposit ?? this.securityDeposit,
      depositStatus: depositStatus ?? this.depositStatus,
      registrationDone: registrationDone ?? this.registrationDone,
      depositDone: depositDone ?? this.depositDone,
      kycDone: kycDone ?? this.kycDone,
    );
  }

  factory RiderKYC.fromJson(Map<String, dynamic> json) =>
      _$RiderKYCFromJson(json);

  Map<String, dynamic> toJson() => _$RiderKYCToJson(this);
}
