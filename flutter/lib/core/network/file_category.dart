/// Strongly typed file upload categories supported by the Voltium backend API.
///
/// Matches `category` enum in `web/src/server/modules/files/files.schemas.ts`.
enum FileCategory {
  kycDocument('kyc_document'),
  profilePhoto('profile_photo'),
  vehiclePhoto('vehicle_photo'),
  paymentProof('payment_proof'),
  supportAttachment('support_attachment'),
  pickupVerification('pickup_verification'),
  returnPhoto('RETURN_PHOTO'),
  topupProof('TOPUP_PROOF'),
  vehicleReturn('vehicle_return'),
  securityDeposit('security_deposit');

  final String value;
  const FileCategory(this.value);

  /// Helper to convert a raw string to [FileCategory], or default to [kycDocument].
  static FileCategory fromString(String category) {
    for (final c in FileCategory.values) {
      if (c.value == category || c.name == category) {
        return c;
      }
    }
    // Backward compatibility mappings for legacy strings
    if (category == 'support_ticket') return FileCategory.supportAttachment;
    if (category == 'profile_selfie') return FileCategory.profilePhoto;
    return FileCategory.kycDocument;
  }

  @override
  String toString() => value;
}
