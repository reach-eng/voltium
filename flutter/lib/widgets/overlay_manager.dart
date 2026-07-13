import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';
import 'locked_overlay.dart';
import 'permission_guard.dart';

import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/core/state/app_provider.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:voltium_rider/theme/app_typography.dart';
import 'package:voltium_rider/theme/app_theme.dart';

class OverlayManager extends ConsumerWidget {
  final Widget child;

  const OverlayManager({super.key, required this.child});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final provider = ref.watch(appProvider);

    return Stack(
      children: [
        child,
        if (provider.lockedByAdmin) _buildAdminLockOverlay(context, provider),
        if (provider.forceUpdate && !provider.lockedByAdmin)
          _buildForceUpdateOverlay(context, provider),
        if (provider.hasPermissionViolation &&
            !provider.lockedByAdmin &&
            !provider.forceUpdate)
          const PermissionGuard(),
        if (provider.walletBalanceLow &&
            !provider.lockedByAdmin &&
            !provider.forceUpdate &&
            !provider.hasPermissionViolation)
          _buildBalanceBanner(context, provider),
      ],
    );
  }

  Widget _buildAdminLockOverlay(BuildContext context, AppProvider provider) {
    return const LockedOverlay();
  }

  Widget _buildForceUpdateOverlay(BuildContext context, AppProvider provider) {
    final colors = AppColors.of(context);
    return Container(
      color: Colors.black87,
      width: double.infinity,
      height: double.infinity,
      child: Center(
        child: Container(
          margin: const EdgeInsets.symmetric(horizontal: 32),
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            color: colors.card,
            borderRadius: BorderRadius.circular(24),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(
                Icons.system_update_rounded,
                color: Colors.blue,
                size: 64,
              ),
              SizedBox(height: 16),
              Text(
                'Update Required',
                style: AppTypography.titleLarge,
              ),
              SizedBox(height: 12),
              Text(
                'A critical update is required to continue using the app. This version is no longer supported.',
                textAlign: TextAlign.center,
                style:
                    GoogleFonts.plusJakartaSans(color: colors.onSurfaceVariant),
              ),
              const SizedBox(height: 24),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () =>
                      _launchUpdateUrl(provider.mandatoryUpdateUrl),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.blue,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  child: const Text('UPDATE NOW'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildBalanceBanner(BuildContext context, AppProvider provider) {
    return Positioned(
      top: 0,
      left: 0,
      right: 0,
      child: SafeArea(
        child: Material(
          color: Colors.transparent,
          child: Container(
            margin: const EdgeInsets.all(12),
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: BoxDecoration(
              color: Colors.orange.shade800,
              borderRadius: BorderRadius.circular(12),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.2),
                  blurRadius: 8,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: Row(
              children: [
                const Icon(Icons.warning_amber_rounded, color: Colors.white),
                SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Low Wallet Balance',
                        style: GoogleFonts.plusJakartaSans(
                          color: Colors.white,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      Text(
                        'Current balance: ₹${provider.currentBalance.toStringAsFixed(2)}. Please top up to avoid interruptions.',
                        style: GoogleFonts.plusJakartaSans(
                          color: Colors.white70,
                          fontSize: 12,
                        ),
                      ),
                    ],
                  ),
                ),
                TextButton(
                  onPressed: () => provider.setWalletBalanceWarning(false),
                  child: Text(
                    'DISMISS',
                    style: GoogleFonts.plusJakartaSans(color: Colors.white),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  void _launchUpdateUrl(String? url) async {
    if (url == null) return;
    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }
}
