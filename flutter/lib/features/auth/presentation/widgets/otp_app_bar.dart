import 'package:flutter/material.dart';
import 'package:voltium_rider/theme/app_theme.dart';
import 'package:voltium_rider/theme/app_typography.dart';
import 'dart:ui' as ui;

/// Custom top bar for [OtpVerificationScreen]:
/// - White circle back button (left), backdrop-blurred
/// - "VOLTIUM" wordmark centered, uppercase, w800
/// - 40x40 spacer (right) to keep the bar balanced
///
/// Matches web OtpScreen.tsx exactly.
class OtpAppBar extends StatelessWidget {
  /// Called when the back button is tapped. Defaults to popping the
  /// route when null.
  final VoidCallback? onBack;

  const OtpAppBar({super.key, this.onBack});

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Stack(
        alignment: Alignment.center,
        children: [
          Align(
            alignment: Alignment.centerLeft,
            child: GestureDetector(
              onTap: onBack ?? () => Navigator.maybePop(context),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(AppRadius.full),
                child: BackdropFilter(
                  filter: ui.ImageFilter.blur(sigmaX: 16, sigmaY: 16),
                  child: Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: colors.card.withValues(alpha: 0.8),
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: colors.outline.withValues(alpha: 0.2),
                        width: 1.5,
                      ),
                      boxShadow: AppShadows.card,
                    ),
                    child: Icon(
                      Icons.arrow_back,
                      size: 20,
                      color: colors.onSurface,
                    ),
                  ),
                ),
              ),
            ),
          ),
          Text(
            'Voltium',
            style: AppTypography.titleMedium.copyWith(
              fontWeight: FontWeight.w800,
              color: colors.onSurface,
              letterSpacing: 1.5,
            ),
          ),
          const Align(
            alignment: Alignment.centerRight,
            child: SizedBox(width: 40, height: 40),
          ),
        ],
      ),
    );
  }
}
