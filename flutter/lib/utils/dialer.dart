import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import 'package:voltium_rider/utils/app_logger.dart';
import 'package:voltium_rider/utils/toast.dart';

/// Guarded `tel:` dialer used by every call action in the app.
///
/// Audit 2026-08-22: three divergent implementations existed — the dashboard
/// TL handler (correct: try/catch + toast fallback) and the SOS/contacts
/// handlers (silent no-op when no dialer is available). This is the single
/// canonical implementation; never launch a `tel:` URI directly.
///
/// Returns true if the dialer was launched.
Future<bool> launchDialer(
  BuildContext context,
  String rawNumber, {
  String? failureMessage,
}) async {
  final sanitized = rawNumber.replaceAll(RegExp(r'[^\d+]'), '');
  final uri = Uri(scheme: 'tel', path: sanitized);
  try {
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
      return true;
    }
    appDebug('launchDialer: cannot launch $uri');
  } catch (e) {
    appDebug('launchDialer failed: $e');
  }
  if (!context.mounted) return false;
  Toast.error(
    context,
    failureMessage ?? 'Unable to open the dialer for $sanitized',
  );
  return false;
}
