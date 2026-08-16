/// App-wide configuration constants — the single source of truth for static
/// values that were previously scattered across screens (the support contact
/// email/phone lived in 3 different files with 3 different values, see
/// audits #12 / #18 / #19).
///
/// CONSOLIDATED-FIX-2026-08-16 §4.14: centralised support contact info.
///
/// When these values need to change (a real support number, a real domain),
/// this is the one file to edit. Callers should import `AppConfig` rather
/// than hardcoding a phone/email/policy string.
class AppConfig {
  AppConfig._();

  // ── Support contact ──────────────────────────────────────────────────
  /// Support email shown to the rider in the legal page, the FAQ screen,
  /// and the support centre. Single source of truth.
  static const String supportEmail = 'support@voltium.app';

  /// Support phone shown to the rider in the same three surfaces. Use the
  /// unformatted E.164 string when building `tel:` / `mailto:` URIs.
  static const String supportPhone = '+91 1800-889-VOLT';
  static const String supportPhoneCompact = '+9118008898658';

  // ── Legal / policy ───────────────────────────────────────────────────
  /// The current legal document version. Increment when any of the 5 inlined
  /// legal documents in `legal_page_content.dart` change so existing riders
  /// are prompted to re-consent. (See audit #5 P0-2 / plan §4.4 — the long
  /// term fix is server-driven legal content.)
  static const String legalVersion = 'public-beta-v1';
}
