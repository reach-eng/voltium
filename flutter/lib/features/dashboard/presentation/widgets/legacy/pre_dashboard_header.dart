import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:voltium_rider/features/notifications/presentation/screens/notifications_screen.dart';
import 'package:voltium_rider/theme/app_theme.dart';
import 'package:voltium_rider/theme/app_typography.dart';
import 'package:voltium_rider/utils/app_navigator.dart';
import 'package:voltium_rider/widgets/dialogs.dart';

/// Top header for the pre-dashboard: brand mark + page title on the
/// left, logout + notifications icons on the right.
///
/// Owns no state. The parent provides the navigation callback so this
/// widget doesn't depend on the router directly.
class PreDashboardHeader extends ConsumerWidget {
  /// Called when the user confirms logout (taps "Sign Out" in the
  /// confirmation dialog). The parent runs the actual logout + nav
  /// back to the auth shell.
  final void Function() onLogoutConfirmed;

  const PreDashboardHeader({super.key, required this.onLogoutConfirmed});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = AppColors.of(context);
    return SafeArea(
      bottom: false,
      child: Container(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 14),
        decoration: BoxDecoration(
          color: colors.card,
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Row(
              children: [
                Container(
                  width: 32,
                  height: 32,
                  decoration: BoxDecoration(
                    color: AppColors.primary,
                    borderRadius: BorderRadius.circular(AppRadius.sm),
                  ),
                  child: const Icon(Icons.bolt, color: Colors.white, size: 18),
                ),
                const SizedBox(width: 10),
                Text(
                  'Dashboard',
                  style: AppTypography.titleLarge
                      .copyWith(color: colors.onSurface),
                ),
              ],
            ),
            Row(
              children: [
                IconButton(
                  key: const Key('preDashboardLogoutButton'),
                  icon: const Icon(
                    Icons.logout,
                    color: AppColors.error,
                    size: 22,
                  ),
                  onPressed: () async {
                    final confirmed = await showLogoutConfirmation(context);
                    if (confirmed == true) {
                      onLogoutConfirmed();
                    }
                  },
                ),
                IconButton(
                  icon: Icon(
                    Icons.notifications_outlined,
                    color: colors.onSurfaceVariant,
                    size: 22,
                  ),
                  onPressed: () => AppNavigator.push(
                    context,
                    const NotificationsScreen(),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
