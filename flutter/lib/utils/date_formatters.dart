/// Date formatting helpers shared across rider flows.
///
/// The server's Zod schemas expect ISO `yyyy-MM-dd` for DOB fields.
/// Localized (dd-MM-yyyy) strings are silently rejected with a 400, so every
/// DOB sent to the API must be formatted through [formatDobForApi]
/// (audit #5 P0-3).
library;

/// Formats [d] as the server-required ISO date `yyyy-MM-dd`.
String formatDobForApi(DateTime d) {
  return '${d.year.toString().padLeft(4, '0')}-'
      '${d.month.toString().padLeft(2, '0')}-'
      '${d.day.toString().padLeft(2, '0')}';
}

/// Formats [d] as the display date `dd-MM-yyyy` used by input fields.
String formatDobForDisplay(DateTime d) {
  return '${d.day.toString().padLeft(2, '0')}-'
      '${d.month.toString().padLeft(2, '0')}-'
      '${d.year.toString().padLeft(4, '0')}';
}
