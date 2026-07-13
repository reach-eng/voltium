/// Unified toast helper — thin top-anchored snackbar with icons.
///
/// THE canonical toast utility for the Voltium Flutter app.
/// Replaces ad-hoc SnackBar/ScaffoldMessenger usage, ToastService (deprecated),
/// and dialogs.dart snackbar helpers (deprecated).
///
/// Usage:
///   Toast.success(context, 'Wallet topped up!');
///   Toast.error(context, 'Payment failed');
///   Toast.info(context, 'Syncing...');
///   Toast.show(context, 'Custom', ToastStyle.info, duration: Duration(seconds: 5));
///
library;

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:voltium_rider/theme/app_theme.dart';

enum ToastStyle { success, error, info, warning }

/// Unified toast helper — thin floating snackbar with icons.
///
/// THE canonical toast utility for the Voltium Flutter app.
/// Use via: `Toast.success(context, 'Wallet topped up!')`
class Toast {
  /// Convenience: shows a success toast with green background + check icon.
  static void success(BuildContext context, String message) {
    show(context, message, ToastStyle.success);
  }

  /// Convenience: shows an error toast with red background + error icon.
  static void error(BuildContext context, String message) {
    show(context, message, ToastStyle.error,
        duration: const Duration(seconds: 4));
  }

  /// Convenience: shows an info toast with blue background + info icon.
  static void info(BuildContext context, String message) {
    show(context, message, ToastStyle.info);
  }

  /// Convenience: shows a warning toast with amber background + warning icon.
  static void warning(BuildContext context, String message) {
    show(context, message, ToastStyle.warning);
  }

  /// Core show method. All toasts go through here.
  static void show(
    BuildContext context,
    String message,
    ToastStyle style, {
    Duration duration = const Duration(seconds: 3),
    VoidCallback? onTap,
  }) {
    final messenger = ScaffoldMessenger.of(context);
    messenger.hideCurrentSnackBar();

    final (Color bg, IconData icon) = switch (style) {
      ToastStyle.success => (AppColors.successGreen, Icons.check_circle),
      ToastStyle.error => (AppColors.errorRedAlt, Icons.error_outline),
      ToastStyle.info => (AppColors.primary, Icons.info_outline),
      ToastStyle.warning => (AppColors.warningDark, Icons.warning_amber),
    };

    messenger.showSnackBar(SnackBar(
      content: GestureDetector(
        onTap: onTap,
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, color: Colors.white, size: 18),
            SizedBox(width: 10),
            Flexible(
              child: Text(
                message,
                style: GoogleFonts.plusJakartaSans(
                    color: Colors.white, fontSize: 14),
              ),
            ),
          ],
        ),
      ),
      backgroundColor: bg,
      behavior: SnackBarBehavior.floating,
      margin: const EdgeInsets.fromLTRB(16, 0, 16, 16),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      duration: duration,
    ));
  }

  /// Dismiss any currently visible toast.
  static void dismiss(BuildContext context) {
    ScaffoldMessenger.maybeOf(context)?.hideCurrentSnackBar();
  }
}
