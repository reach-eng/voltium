/// RIDER-FORMAT-2026-09-07 (P3-4): shared phone formatter. Strips
/// non-digits, keeps the last 10 (handles values like
/// `+919876543210`, `919876543210`, `9876543210`), and renders
/// `+91 XXXXX XXXXX` (the convention used in the personal-details
/// card). Falls back to the raw string if the value is too short
/// to format (e.g. legacy/empty values during a draft).
String formatRiderPhone(String raw) {
  final cleanDigits = raw.replaceAll(RegExp(r'\D'), '');
  if (cleanDigits.length < 10) return raw;
  final tenDigits = cleanDigits.substring(cleanDigits.length - 10);
  return '+91 ${tenDigits.substring(0, 5)} ${tenDigits.substring(5)}';
}
