import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/theme/app_theme.dart';
import 'package:voltium_rider/utils/app_navigator.dart';
import 'package:voltium_rider/widgets/fade_up_widget.dart';
import 'package:voltium_rider/features/profile/presentation/widgets/profile_widgets.dart';

import 'package:voltium_rider/features/support/presentation/screens/feedback_screen.dart';
import 'package:voltium_rider/features/onboarding/presentation/screens/legal_page_screen.dart';
import 'package:voltium_rider/main.dart';
import 'package:voltium_rider/widgets/dialogs.dart';
import 'package:voltium_rider/theme/app_typography.dart';
import 'package:voltium_rider/gen/app_localizations.dart';

class ControlsScreen extends ConsumerWidget {
  const ControlsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final themeProv = ref.watch(themeProviderRef);
    final isDark = themeProv.isDarkMode;
    final colors = AppColors.of(context);
    final l10n = AppLocalizations.of(context)!;

    return Scaffold(
      backgroundColor: colors.iconBackground,
      appBar: AppBar(
        backgroundColor: colors.iconBackground,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        centerTitle: false,
        title: Text(
          l10n.controls_title,
          style: AppTypography.titleLarge
              .copyWith(color: colors.onSurface, letterSpacing: -0.5),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _SectionLabel(l10n.controls_preferences),
            const SizedBox(height: 12),
            FadeUpWidget(
              delay: 0,
              child: QuickLinkItem(
                key: const Key('darkModeLink'),
                icon: Icons.dark_mode_outlined,
                iconColor: colors.onSurfaceVariant,
                iconBgColor: colors.iconBackground,
                title: l10n.controls_darkMode,
                trailing: Switch.adaptive(
                  value: isDark,
                  onChanged: (v) => themeProv.setDarkMode(v),
                  activeTrackColor: AppColors.primary,
                ),
              ),
            ),
            const SizedBox(height: 24),
            _SectionLabel(l10n.controls_supportLegal),
            const SizedBox(height: 12),
            FadeUpWidget(
              delay: 50,
              child: QuickLinkItem(
                key: const Key('feedbackLink'),
                icon: Icons.rate_review_outlined,
                activeIcon: Icons.rate_review,
                iconColor: const Color(0xFF7E22CE),
                iconBgColor: const Color(0xFFF3E8FF),
                title: l10n.controls_feedback,
                onTap: () => AppNavigator.push(context,
                    FeedbackScreen(onSubmit: () => Navigator.pop(context))),
              ),
            ),
            const SizedBox(height: 8),
            FadeUpWidget(
              delay: 100,
              child: QuickLinkItem(
                key: const Key('legalLink'),
                icon: Icons.gavel_outlined,
                activeIcon: Icons.gavel,
                iconColor: const Color(0xFF0F766E),
                iconBgColor: const Color(0xFFCCFBF1),
                title: l10n.controls_legal,
                onTap: () =>
                    AppNavigator.push(context, const LegalPageScreen()),
              ),
            ),
            const SizedBox(height: 24),
            _SectionLabel(l10n.controls_about),
            SizedBox(height: 12),
            FadeUpWidget(
              delay: 150,
              child: QuickLinkItem(
                key: const Key('appVersionLink'),
                icon: Icons.info_outline,
                iconColor: colors.onSurfaceVariant,
                iconBgColor: colors.iconBackground,
                title: l10n.controls_appVersion,
                trailing: Text(
                  'v2.1.0',
                  style: AppTypography.bodyMediumEmphasis
                      .copyWith(color: colors.onSurfaceMuted),
                ),
              ),
            ),
            const SizedBox(height: 8),
            FadeUpWidget(
              delay: 200,
              child: QuickLinkItem(
                key: const Key('rateUsLink'),
                icon: Icons.star_outline,
                iconColor: const Color(0xFFEAB308),
                iconBgColor: const Color(0xFFFEF9C3),
                title: l10n.controls_rateUs,
                onTap: () async {
                  // Implementation for Rate Us using url_launcher
                },
              ),
            ),
            const SizedBox(height: 24),
            _SectionLabel(l10n.controls_accountSection),
            const SizedBox(height: 12),
            FadeUpWidget(
              delay: 250,
              child: QuickLinkItem(
                key: const Key('deleteAccountLink'),
                icon: Icons.delete_outline,
                iconColor: AppColors.errorRed,
                iconBgColor: AppColors.errorRose,
                title: l10n.settings_deleteAccount,
                onTap: () => _showDeleteAccountDialog(context),
              ),
            ),
            const SizedBox(height: 16),
            FadeUpWidget(
              delay: 300,
              child: ProfileLogoutButton(
                onTap: () async {
                  final confirmed = await showLogoutConfirmation(context);
                  if (confirmed == true && context.mounted) {
                    await ref.read(appProvider).logout();
                    if (context.mounted) {
                      Navigator.pushAndRemoveUntil(
                        context,
                        MaterialPageRoute(builder: (_) => const AppShell()),
                        (route) => false,
                      );
                    }
                  }
                },
              ),
            ),
            const SizedBox(height: 48),
          ],
        ),
      ),
    );
  }

  void _showDeleteAccountDialog(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(l10n.controls_deleteConfirmTitle),
        content: Text(
          l10n.controls_deleteConfirmBody,
        ),
        actions: [
          TextButton(
            key: const Key('cancelDeleteButton'),
            onPressed: () => Navigator.pop(ctx),
            child: Text(MaterialLocalizations.of(ctx).cancelButtonLabel),
          ),
          FilledButton(
            key: const Key('confirmDeleteButton'),
            onPressed: () {
              Navigator.pop(ctx);
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text(
                    l10n.controls_deleteNotAvailable,
                  ),
                  backgroundColor: AppColors.warning,
                ),
              );
            },
            style: FilledButton.styleFrom(
              backgroundColor: AppColors.errorRed,
            ),
            child: Text(l10n.controls_delete),
          ),
        ],
      ),
    );
  }
}

class _SectionLabel extends StatelessWidget {
  final String label;
  const _SectionLabel(this.label);

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Text(
      label,
      style: AppTypography.bodySmallTracked
          .copyWith(color: colors.onSurfaceMuted, letterSpacing: 1.2),
    );
  }
}
