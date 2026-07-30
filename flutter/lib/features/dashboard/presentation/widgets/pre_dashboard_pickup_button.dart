import 'package:flutter/material.dart';
import 'package:voltium_rider/theme/app_theme.dart';
import 'package:voltium_rider/theme/app_typography.dart';

/// Big primary "PICKUP YOUR VEHICLE" CTA shown on the pre-dashboard
/// when KYC + deposit are done but pickup hasn't happened yet.
class PreDashboardPickupButton extends StatelessWidget {
  /// Called when the user taps the button. The parent typically
  /// navigates to the pickup hub.
  final VoidCallback onPressed;

  const PreDashboardPickupButton({super.key, required this.onPressed});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      child: ElevatedButton(
        onPressed: onPressed,
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.primary,
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(vertical: 18),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadius.xl),
          ),
          elevation: 8,
          shadowColor: AppColors.primary.withValues(alpha: 0.4),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.local_shipping, size: 22),
            const SizedBox(width: 12),
            Text(
              'PICKUP YOUR VEHICLE',
              style: AppTypography.buttonMedium.copyWith(letterSpacing: 1.2),
            ),
          ],
        ),
      ),
    );
  }
}
