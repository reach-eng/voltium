import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:voltium_rider/utils/toast.dart';

/// Central helper for support `tel:` / `mailto:` launches.
///
/// Guards: empty numbers, malformed URIs, launch failures.
/// Never throws — shows a toast on failure.
class SupportLauncher {
  const SupportLauncher._();

  static String sanitizePhone(String? raw) {
    if (raw == null) return '';
    // P0-3 follow-up (2026-09-07): vanity letters (e.g. the server-driven
    // "+91 1800-889-VOLT") are real dialpad keys — map them via T9
    // instead of dropping them. The old `\D` strip dialed a TRUNCATED
    // WRONG NUMBER (`+911800889`).
    const t9 = <String, String>{
      'A': '2',
      'B': '2',
      'C': '2',
      'D': '3',
      'E': '3',
      'F': '3',
      'G': '4',
      'H': '4',
      'I': '4',
      'J': '5',
      'K': '5',
      'L': '5',
      'M': '6',
      'N': '6',
      'O': '6',
      'P': '7',
      'Q': '7',
      'R': '7',
      'S': '7',
      'T': '8',
      'U': '8',
      'V': '8',
      'W': '9',
      'X': '9',
      'Y': '9',
      'Z': '9',
    };
    final buffer = StringBuffer();
    for (final rune in raw.runes) {
      final ch = String.fromCharCode(rune);
      final upper = ch.toUpperCase();
      if (t9.containsKey(upper)) {
        buffer.write(t9[upper]);
      } else if (RegExp(r'\d').hasMatch(ch)) {
        buffer.write(ch);
      } else if (ch == '+') {
        buffer.write('+');
      }
    }
    final digits = buffer.toString().replaceAll('+', '');
    if (digits.isEmpty) return '';
    final hadPlus = raw.trim().startsWith('+');
    // Basic E.164 length bound (7-15 digits).
    final clipped = digits.length > 15 ? digits.substring(0, 15) : digits;
    if (clipped.length < 7) return '';
    return hadPlus ? '+$clipped' : clipped;
  }

  static Future<bool> callPhone(BuildContext context, String? rawPhone) async {
    final sanitized = sanitizePhone(rawPhone);
    if (sanitized.isEmpty) {
      if (context.mounted) {
        Toast.warning(context, 'No contact number available.');
      }
      return false;
    }
    final uri = Uri.tryParse('tel:$sanitized');
    if (uri == null) {
      if (context.mounted) Toast.error(context, 'Invalid phone number.');
      return false;
    }
    try {
      if (await canLaunchUrl(uri)) {
        return await launchUrl(uri, mode: LaunchMode.externalApplication);
      }
      if (context.mounted) {
        Toast.error(context, 'Could not open the phone dialer.');
      }
      return false;
    } catch (_) {
      if (context.mounted) {
        Toast.error(context, 'Could not open the phone dialer.');
      }
      return false;
    }
  }

  static Future<bool> sendEmail(BuildContext context, String? email) async {
    final trimmed = (email ?? '').trim();
    final valid = RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch(trimmed);
    if (!valid) {
      if (context.mounted) {
        Toast.warning(context, 'No support email available.');
      }
      return false;
    }
    final uri = Uri(scheme: 'mailto', path: trimmed);
    try {
      if (await canLaunchUrl(uri)) {
        return await launchUrl(uri, mode: LaunchMode.externalApplication);
      }
      if (context.mounted) {
        Toast.error(context, 'Could not open the email app.');
      }
      return false;
    } catch (_) {
      if (context.mounted) {
        Toast.error(context, 'Could not open the email app.');
      }
      return false;
    }
  }
}
