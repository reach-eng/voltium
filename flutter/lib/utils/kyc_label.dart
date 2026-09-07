/// RIDER-FORMAT-2026-09-07 (P3-4): shared KYC-status label. Maps the
/// raw status enum name (e.g. `SUBMITTED`, `APPROVED`, `PENDING`,
/// `REJECTED`) to the rider-facing display label. Centralized so
/// the KYC pill, the identity card, and any future surface show
/// the same wording.
String formatKycLabel(String raw) {
  switch (raw.toUpperCase()) {
    case 'SUBMITTED':
      return 'Under Review';
    case 'APPROVED':
    case 'VERIFIED':
      return 'Verified';
    case 'REJECTED':
      return 'Rejected';
    case 'PENDING':
    case '':
      return 'Pending';
    default:
      // Unknown status — title-case the raw value as a safe fallback.
      if (raw.isEmpty) return 'Pending';
      return raw[0].toUpperCase() + raw.substring(1).toLowerCase();
  }
}
