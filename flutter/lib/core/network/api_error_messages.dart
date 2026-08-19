// ONBOARDING-AUDIT 2026-08-14 (fix #5c): central helper to translate
// raw exceptions into rider-safe SnackBar text.
//
// The previous code did `'Top-up submission failed: $e'` directly in a
// SnackBar, leaking `SocketException`, `ClientException`, raw
// `ApiException.toString()`, and the occasional HTTP body fragment to
// the rider. This helper maps the most common cases to a small
// vocabulary and falls back to a generic message for anything it
// doesn't recognise. New flows should call [safeErrorMessage] (or
// [safeErrorMessageFor] when the flow has a custom hint) rather than
// embedding `'$e'` in user-facing text.

import 'package:voltium_rider/core/network/api_client.dart';

/// Translate [error] into a short, rider-safe string for a SnackBar.
///
/// [context] is a short label for the flow that failed ("top-up",
/// "pickup", etc.) — used to compose the generic fallback. It is
/// never echoed back to the user from raw exception text.
String safeErrorMessage(Object error, [String? context]) {
  final msg = error.toString();
  final lower = msg.toLowerCase();

  // Connectivity — same trigger as the pre-check in pickup
  // verification; keep the messages identical so the rider sees the
  // same wording whether the check happened up front or the
  // request failed mid-flight.
  if (lower.contains('socketexception') ||
      lower.contains('failed host lookup') ||
      lower.contains('network is unreachable') ||
      lower.contains('networkerror') ||
      lower.contains('clientexception') ||
      lower.contains('connection refused') ||
      lower.contains('connection closed') ||
      lower.contains('connection reset')) {
    return "You're offline. Connect to the internet and try again.";
  }
  if (lower.contains('timeout') || lower.contains('timed out')) {
    return "The request timed out. Check your connection and try again.";
  }

  // Auth
  if (lower.contains('401') || lower.contains('unauthorized')) {
    return 'Session expired. Please log in again.';
  }
  if (lower.contains('403') || lower.contains('forbidden')) {
    return "You don't have permission to do that right now.";
  }

  // Validation — server tells us which fields; surface the hint
  // when it's short, generic otherwise.
  if (lower.contains('422') || lower.contains('validation')) {
    return 'Please check your details and try again.';
  }

  // Rate limit / server errors
  if (lower.contains('429') || lower.contains('too many requests')) {
    return "Too many requests. Please wait a moment and try again.";
  }
  if (lower.contains('500') ||
      lower.contains('502') ||
      lower.contains('503') ||
      lower.contains('504') ||
      lower.contains('internal server') ||
      lower.contains('bad gateway') ||
      lower.contains('service unavailable')) {
    return 'Something went wrong on our end. Please try again in a moment.';
  }

  // Typed ApiException — preserve the human-readable message if the
  // server sent one, otherwise fall through to the generic copy.
  if (error is ApiException) {
    final body = error.message;
    if (body.isNotEmpty && body.length < 200 && !_looksLikeStack(body)) {
      return body;
    }
  }

  // Generic fallback. Never embed the raw exception.
  if (context != null && context.isNotEmpty) {
    return "We couldn't complete the $context. Please try again.";
  }
  return 'Something went wrong. Please try again.';
}

bool _looksLikeStack(String body) {
  // Heuristic: a stack trace typically contains `at ` and a colon
  // followed by a line number, or `package:`, or a `Caused by` line.
  return body.contains('\n') ||
      body.contains('package:') ||
      body.contains(' at ') ||
      body.contains('Caused by');
}
