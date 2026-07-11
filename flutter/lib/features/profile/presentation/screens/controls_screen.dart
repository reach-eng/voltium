import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';

import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/theme/theme_provider.dart';
import 'package:voltium_rider/theme/app_theme.dart';
import 'package:voltium_rider/utils/app_navigator.dart';
import 'package:voltium_rider/widgets/fade_up_widget.dart';
import 'package:voltium_rider/features/profile/presentation/widgets/profile_widgets.dart';

import 'package:voltium_rider/features/support/presentation/screens/feedback_screen.dart';
import 'package:voltium_rider/features/onboarding/presentation/screens/legal_page_screen.dart';

class ControlsScreen extends ConsumerWidget {
  const ControlsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final themeProv = ref.watch(themeProviderRef);
    final isDark = themeProv.isDarkMode;

    return Scaffold(
      backgroundColor: AppColors.iconBackground,
      appBar: AppBar(
        backgroundColor: AppColors.iconBackground,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        centerTitle: false,
        title: Text(
          'Controls',
          style: GoogleFonts.plusJakartaSans(
            fontSize: 20,
            fontWeight: FontWeight.w800,
            color: const Color(0xFF1E293B),
            letterSpacing: -0.5,
          ),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const _SectionLabel('PREFERENCES'),
            const SizedBox(height: 12),
            
            FadeUpWidget(
              delay: 0,
              child: QuickLinkItem(
                key: const Key('darkModeLink'),
                icon: Icons.dark_mode_outlined,
                iconColor: AppColors.slate500,
                iconBgColor: AppColors.iconBackground,
                title: 'Dark Mode',
                trailing: Switch.adaptive(
                  value: isDark,
                  onChanged: (v) => themeProv.setDarkMode(v),
                  activeTrackColor: AppColors.primary,
                ),
              ),
            ),
            const SizedBox(height: 24),

            const _SectionLabel('SUPPORT & LEGAL'),
            const SizedBox(height: 12),

            FadeUpWidget(
              delay: 50,
              child: QuickLinkItem(
                key: const Key('feedbackLink'),
                icon: Icons.rate_review_outlined,
                activeIcon: Icons.rate_review,
                iconColor: const Color(0xFF7E22CE),
                iconBgColor: const Color(0xFFF3E8FF),
                title: 'Feedback',
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
                title: 'Legal',
                onTap: () =>
                    AppNavigator.push(context, const LegalPageScreen()),
              ),
            ),
            const SizedBox(height: 24),

            const _SectionLabel('ABOUT'),
            const SizedBox(height: 12),

            FadeUpWidget(
              delay: 150,
              child: QuickLinkItem(
                key: const Key('appVersionLink'),
                icon: Icons.info_outline,
                iconColor: AppColors.slate500,
                iconBgColor: AppColors.iconBackground,
                title: 'App Version',
                trailing: const Text(
                  'v2.1.0',
                  style: TextStyle(
                    color: AppColors.slate500,
                    fontSize: 14,
                    fontWeight: FontWeight.bold,
                  ),
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
                title: 'Rate Us',
                onTap: () async {
                  // Implementation for Rate Us using url_launcher
                },
              ),
            ),
            const SizedBox(height: 24),

            const _SectionLabel('ACCOUNT'),
            const SizedBox(height: 12),

            FadeUpWidget(
              delay: 250,
              child: QuickLinkItem(
                key: const Key('deleteAccountLink'),
                icon: Icons.delete_outline,
                iconColor: const Color(0xFFDC2626),
                iconBgColor: const Color(0xFFFFE4E6),
                title: 'Delete Account',
                onTap: () => _showDeleteAccountDialog(context),
              ),
            ),
            const SizedBox(height: 16),

            FadeUpWidget(
              delay: 300,
              child: ProfileLogoutButton(
                onTap: () => ref.read(appProvider).logout(),
              ),
            ),
            const SizedBox(height: 48),
          ],
        ),
      ),
    );
  }

  void _showDeleteAccountDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete Account'),
        content: const Text(
          'This action is irreversible. All your data, including KYC documents, wallet balance, and rental history will be permanently deleted. Are you sure?',
        ),
        actions: [
          TextButton(
            key: const Key('cancelDeleteButton'),
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          FilledButton(
            key: const Key('confirmDeleteButton'),
            onPressed: () {
              Navigator.pop(ctx);
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text(
                    'Account deletion is not yet available. Please contact support.',
                  ),
                  backgroundColor: AppColors.warning,
                ),
              );
            },
            style: FilledButton.styleFrom(
              backgroundColor: const Color(0xFFDC2626),
            ),
            child: const Text('Delete'),
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
    return Text(
      label,
      style: const TextStyle(
        fontSize: 12,
        fontWeight: FontWeight.w900,
        color: Color(0xFF475569),
        letterSpacing: 1.2,
      ),
    );
  }
}
