/// KYC status entity matching backend state machine.
enum KycDocumentStatus { draft, submitted, approved, rejected, infoRequired }

/// KYC domain entity representing the rider's identity verification state.
class KycEntity {
  final KycDocumentStatus status;
  final String? aadhaarFrontUrl;
  final String? aadhaarBackUrl;
  final String? panCardUrl;
  final String? profilePhotoUrl;
  final String? signatureUrl;
  final String? rejectionReason;

  const KycEntity({
    this.status = KycDocumentStatus.draft,
    this.aadhaarFrontUrl,
    this.aadhaarBackUrl,
    this.panCardUrl,
    this.profilePhotoUrl,
    this.signatureUrl,
    this.rejectionReason,
  });

  bool get isComplete =>
      status == KycDocumentStatus.submitted ||
      status == KycDocumentStatus.approved;

  factory KycEntity.fromJson(Map<String, dynamic> json) {
    return KycEntity(
      status: _parseStatus(json['kycStatus'] as String?),
      aadhaarFrontUrl: json['aadhaarFront'] as String?,
      aadhaarBackUrl: json['aadhaarBack'] as String?,
      panCardUrl: json['panCard'] as String?,
      profilePhotoUrl: json['profilePhoto'] as String?,
      signatureUrl: json['signature'] as String?,
      rejectionReason: json['rejectionReason'] as String?,
    );
  }

  static KycDocumentStatus _parseStatus(String? status) {
    switch (status?.toUpperCase()) {
      case 'DRAFT':
        return KycDocumentStatus.draft;
      case 'SUBMITTED':
        return KycDocumentStatus.submitted;
      case 'APPROVED':
        return KycDocumentStatus.approved;
      case 'REJECTED':
        return KycDocumentStatus.rejected;
      case 'INFO_REQUIRED':
        return KycDocumentStatus.infoRequired;
      default:
        return KycDocumentStatus.draft;
    }
  }
}
