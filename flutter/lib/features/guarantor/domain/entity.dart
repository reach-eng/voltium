/// Guarantor status matching backend state machine.
enum GuarantorStatus { draft, submitted, approved, rejected, infoRequired, replaced }

/// Guarantor domain entity.
class GuarantorEntity {
  final GuarantorStatus status;
  final String? name;
  final String? relation;
  final String? phone;
  final String? rejectionReason;

  const GuarantorEntity({
    this.status = GuarantorStatus.draft,
    this.name,
    this.relation,
    this.phone,
    this.rejectionReason,
  });

  bool get isSubmitted =>
      status == GuarantorStatus.submitted || status == GuarantorStatus.approved;

  factory GuarantorEntity.fromJson(Map<String, dynamic> json) {
    return GuarantorEntity(
      status: _parseStatus(json['guarantorStatus'] as String?),
      name: json['name'] as String?,
      relation: json['relation'] as String?,
      phone: json['phone'] as String?,
      rejectionReason: json['rejectionReason'] as String?,
    );
  }

  static GuarantorStatus _parseStatus(String? status) {
    switch (status?.toUpperCase()) {
      case 'DRAFT':
        return GuarantorStatus.draft;
      case 'SUBMITTED':
        return GuarantorStatus.submitted;
      case 'APPROVED':
        return GuarantorStatus.approved;
      case 'REJECTED':
        return GuarantorStatus.rejected;
      case 'INFO_REQUIRED':
        return GuarantorStatus.infoRequired;
      case 'REPLACED':
        return GuarantorStatus.replaced;
      default:
        return GuarantorStatus.draft;
    }
  }
}
