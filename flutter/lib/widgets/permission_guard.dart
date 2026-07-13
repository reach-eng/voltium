import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:permission_handler/permission_handler.dart';
import '../theme/app_theme.dart';

import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/theme/app_typography.dart';

class PermissionGuard extends ConsumerWidget {
  const PermissionGuard({super.key});

  String _permissionName(String id) {
    switch (id) {
      case 'device_admin':
        return 'Device Admin';
      case 'display_over_apps':
        return 'Display over other apps';
      case 'location':
        return 'Location';
      case 'camera':
        return 'Camera';
      case 'mic':
        return 'Microphone';
      case 'contacts':
        return 'Contacts';
      case 'phone':
        return 'Phone';
      default:
        return id;
    }
  }

  IconData _permissionIcon(String id) {
    switch (id) {
      case 'device_admin':
        return Icons.admin_panel_settings_outlined;
      case 'display_over_apps':
        return Icons.picture_in_picture_alt_outlined;
      case 'location':
        return Icons.location_on_outlined;
      case 'camera':
        return Icons.camera_alt_outlined;
      case 'mic':
        return Icons.mic_none_outlined;
      case 'contacts':
        return Icons.contacts_outlined;
      case 'phone':
        return Icons.phone_outlined;
      default:
        return Icons.security_outlined;
    }
  }

  Future<void> _openSettings() async {
    await openAppSettings();
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final hasViolation =
        ref.watch(appProvider.select((p) => p.hasPermissionViolation));
    if (!hasViolation) return const SizedBox.shrink();

    final permId =
        ref.watch(appProvider.select((p) => p.violationPermissionId)) ??
            'unknown';
    final permName = _permissionName(permId);
    final icon = _permissionIcon(permId);

    return PopScope(
      canPop: false,
      child: Scaffold(
        backgroundColor: AppColors.slate900,
        body: Container(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                AppColors.slate900,
                AppColors.slate900.withValues(alpha: 0.9),
                AppColors.primaryDeep.withValues(alpha: 0.8),
              ],
            ),
          ),
          child: SafeArea(
            child: Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(32),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 96,
                      height: 96,
                      decoration: BoxDecoration(
                        color: Colors.red.withValues(alpha: 0.15),
                        shape: BoxShape.circle,
                      ),
                      child: Icon(icon, color: Colors.redAccent, size: 48),
                    ),
                    SizedBox(height: 32),
                    Text(
                      'REQUIRED PERMISSION\nREVOKED',
                      textAlign: TextAlign.center,
                      style: AppTypography.headingMedium.copyWith(
                          color: Colors.white, letterSpacing: 1.5, height: 1.3),
                    ),
                    SizedBox(height: 16),
                    Text(
                      'The "$permName" permission has been revoked. This permission is mandatory for the app to function.',
                      textAlign: TextAlign.center,
                      style: GoogleFonts.plusJakartaSans(
                        color: Colors.white.withValues(alpha: 0.7),
                        fontSize: 15,
                        height: 1.5,
                      ),
                    ),
                    SizedBox(height: 12),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 20,
                        vertical: 10,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.red.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(
                            color: Colors.red.withValues(alpha: 0.3)),
                      ),
                      child: Text(
                        permName.toUpperCase(),
                        style: AppTypography.bodyMediumEmphasis.copyWith(
                            color: Colors.redAccent, letterSpacing: 1),
                      ),
                    ),
                    SizedBox(height: 40),
                    SizedBox(
                      width: double.infinity,
                      height: 56,
                      child: ElevatedButton.icon(
                        onPressed: _openSettings,
                        icon: const Icon(Icons.settings),
                        label: Text(
                          'OPEN SETTINGS',
                          style: AppTypography.titleSmall
                              .copyWith(letterSpacing: 0.5),
                        ),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.primary,
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                          elevation: 4,
                        ),
                      ),
                    ),
                    SizedBox(height: 16),
                    TextButton(
                      onPressed: () => ref.read(appProvider).clearViolation(),
                      child: Text(
                        'I\'ve re-enabled it',
                        style: GoogleFonts.plusJakartaSans(
                          color: Colors.white.withValues(alpha: 0.5),
                          fontSize: 13,
                        ),
                      ),
                    ),
                    SizedBox(height: 32),
                    Text(
                      'Voltium Security System v3.0',
                      style: GoogleFonts.plusJakartaSans(
                        color: Colors.white.withValues(alpha: 0.2),
                        fontSize: 12,
                        fontStyle: FontStyle.italic,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
