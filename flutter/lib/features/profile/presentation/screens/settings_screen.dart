import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:url_launcher/url_launcher.dart';

import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/theme/theme_provider.dart';
import 'package:voltium_rider/core/localization/locale_provider.dart';
import 'package:voltium_rider/models/rider_model.dart';
import 'package:voltium_rider/services/notification_service.dart';
import 'package:voltium_rider/theme/app_theme.dart';
import 'package:voltium_rider/utils/app_navigator.dart';
import 'package:voltium_rider/widgets/fade_up_widget.dart';
import 'package:voltium_rider/features/profile/presentation/screens/edit_profile_screen.dart';
import 'package:voltium_rider/features/profile/presentation/widgets/profile_widgets.dart';

import 'package:voltium_rider/features/notifications/presentation/screens/notification_preferences_screen.dart';
import 'package:voltium_rider/features/support/presentation/screens/feedback_screen.dart';
import 'package:voltium_rider/features/onboarding/presentation/screens/legal_page_screen.dart';
import 'package:voltium_rider/main.dart';
import 'package:voltium_rider/widgets/dialogs.dart';
import 'package:voltium_rider/theme/app_typography.dart';
import 'package:voltium_rider/gen/app_localizations.dart';

/// App Settings screen.
///
/// Renders the rider's account summary, app preferences, support/legal
/// links, about info, and account/danger-zone actions.
///
/// Exposed widget keys (must stay in sync with `integration_test/e2e/settings_test.dart`):
/// - `appSettingsLink`   — the entry-point on the Profile screen.
/// - `backButton`        — the AppBar back button.
/// - `darkModeSwitch`    — the dark-mode switch on the Preferences tile.
/// - `rateUsTile`        — the "Rate Us" row.
/// - `deleteAccountButton` — the "Delete Account" row in the danger zone.
/// - `cancelDeleteButton`  / `confirmDeleteButton` — buttons in the delete dialog.
/// - `logoutButton`      — handled by `ProfileLogoutButton`.
class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final themeProv = ref.watch(themeProvider);
    final isDark = themeProv.isDarkMode;
    final colors = AppColors.of(context);
    final l10n = AppLocalizations.of(context)!;
    final rider = ref.watch(riderProvider.select((p) => p.rider));
    final isLoading = rider == null;
    final localeProv = ref.watch(localeProvider);
    final currentLocale = localeProv.locale.languageCode;

    return Scaffold(
      backgroundColor: colors.iconBackground,
      appBar: AppBar(
        key: const Key('settingsAppBar'),
        backgroundColor: colors.iconBackground,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        centerTitle: false,
        leading: IconButton(
          key: const Key('backButton'),
          icon: const Icon(Icons.arrow_back),
          onPressed: () => Navigator.of(context).maybePop(),
        ),
        title: Text(
          l10n.settings_title,
          style: AppTypography.titleLarge
              .copyWith(color: colors.onSurface, letterSpacing: -0.5),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // ── Rider identity block ─────────────────────────────────────
            // Light reminder of who's logged in. Mirrors the pattern used by
            // iOS Settings / Google Settings at the top of the screen.
            FadeUpWidget(
              delay: 0,
              child: _RiderIdentityCard(rider: rider, isLoading: isLoading),
            ),
            const SizedBox(height: 24),

            // ── Preferences ──────────────────────────────────────────────
            _SectionLabel(l10n.settings_preferences),
            const SizedBox(height: 12),
            FadeUpWidget(
              delay: 50,
              child: QuickLinkItem(
                key: const Key('darkModeTile'),
                icon: Icons.dark_mode_outlined,
                iconColor: colors.onSurfaceVariant,
                iconBgColor: colors.iconBackground,
                title: l10n.settings_darkMode,
                trailing: Switch.adaptive(
                  key: const Key('darkModeSwitch'),
                  value: isDark,
                  onChanged: (v) =>
                      ref.read(themeProvider.notifier).setDarkMode(v),
                  activeTrackColor: AppColors.primary,
                ),
              ),
            ),
            const SizedBox(height: 8),
            FadeUpWidget(
              delay: 75,
              child: _NotificationsTile(),
            ),
            const SizedBox(height: 24),

            // ── Language & Region ───────────────────────────────────────
            _SectionLabel('LANGUAGE'),
            const SizedBox(height: 12),
            FadeUpWidget(
              delay: 100,
              child: QuickLinkItem(
                key: const Key('languageOption'),
                icon: Icons.language,
                iconColor: AppColors.success,
                iconBgColor: AppColors.successLight,
                title: l10n.menu_language,
                trailing: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      currentLocale == 'hi'
                          ? l10n.settings_hindi
                          : l10n.settings_english,
                      style: AppTypography.bodyMedium
                          .copyWith(fontWeight: FontWeight.w600)
                          .copyWith(color: colors.onSurfaceMuted),
                    ),
                    const SizedBox(width: 8),
                    Icon(Icons.chevron_right, color: colors.outline, size: 20),
                  ],
                ),
                onTap: () => _showLanguageDialog(context, ref),
              ),
            ),
            const SizedBox(height: 24),

            // ── Security ─────────────────────────────────────────────────
            _SectionLabel(l10n.settings_securitySection),
            const SizedBox(height: 12),
            FadeUpWidget(
              delay: 125,
              child: QuickLinkItem(
                key: const Key('changePhoneTile'),
                icon: Icons.phone_outlined,
                iconColor: AppColors.info,
                iconBgColor: AppColors.primarySurface,
                title: l10n.settings_changePhone,
                onTap: () =>
                    AppNavigator.push(context, const EditProfileScreen()),
              ),
            ),
            const SizedBox(height: 8),
            FadeUpWidget(
              delay: 150,
              child: QuickLinkItem(
                key: const Key('changePasswordTile'),
                icon: Icons.lock_outline,
                iconColor: AppColors.warning,
                iconBgColor: AppColors.warningLight,
                title: l10n.settings_changePassword,
                onTap: () => _showComingSoonSnack(context, l10n),
              ),
            ),
            const SizedBox(height: 24),

            // ── Support & Legal ──────────────────────────────────────────
            _SectionLabel(l10n.settings_supportLegal),
            const SizedBox(height: 12),
            FadeUpWidget(
              delay: 175,
              child: QuickLinkItem(
                key: const Key('feedbackLink'),
                icon: Icons.rate_review_outlined,
                activeIcon: Icons.rate_review,
                iconColor: AppColors.accentPurple,
                iconBgColor: AppColors.accentPurpleSurface,
                title: l10n.settings_feedback,
                onTap: () => AppNavigator.push(context,
                    FeedbackScreen(onSubmit: () => Navigator.pop(context))),
              ),
            ),
            const SizedBox(height: 8),
            FadeUpWidget(
              delay: 200,
              child: QuickLinkItem(
                key: const Key('termsTile'),
                icon: Icons.description_outlined,
                iconColor: AppColors.successDark,
                iconBgColor: AppColors.successLight,
                title: l10n.settings_termsOfService,
                onTap: () => AppNavigator.push(
                    context,
                    const LegalPageScreen(
                        documentType: LegalDocumentType.terms)),
              ),
            ),
            const SizedBox(height: 8),
            FadeUpWidget(
              delay: 225,
              child: QuickLinkItem(
                key: const Key('privacyTile'),
                icon: Icons.privacy_tip_outlined,
                iconColor: AppColors.successDark,
                iconBgColor: AppColors.successLight,
                title: l10n.settings_privacyPolicy,
                onTap: () => AppNavigator.push(
                    context,
                    const LegalPageScreen(
                        documentType: LegalDocumentType.privacy)),
              ),
            ),
            const SizedBox(height: 24),

            // ── About ────────────────────────────────────────────────────
            _SectionLabel(l10n.settings_about),
            const SizedBox(height: 12),
            FadeUpWidget(
              delay: 250,
              child: QuickLinkItem(
                key: const Key('appVersionTile'),
                icon: Icons.info_outline,
                iconColor: colors.onSurfaceVariant,
                iconBgColor: colors.iconBackground,
                title: l10n.settings_appVersion,
                trailing: Text(
                  'v2.1.0',
                  style: AppTypography.bodyMedium
                      .copyWith(fontWeight: FontWeight.w600)
                      .copyWith(color: colors.onSurfaceMuted),
                ),
              ),
            ),
            const SizedBox(height: 8),
            FadeUpWidget(
              delay: 275,
              child: QuickLinkItem(
                key: const Key('rateUsTile'),
                icon: Icons.star_outline,
                iconColor: AppColors.warning,
                iconBgColor: AppColors.warningLight,
                title: l10n.settings_rateUs,
                onTap: () async {
                  final url = Uri.parse(
                      'https://play.google.com/store/apps/details?id=com.voltium.rider');
                  if (await canLaunchUrl(url)) {
                    await launchUrl(url, mode: LaunchMode.externalApplication);
                  }
                },
              ),
            ),
            const SizedBox(height: 24),

            // ── Account / danger zone ───────────────────────────────────
            _SectionLabel(l10n.settings_accountSection),
            const SizedBox(height: 12),
            FadeUpWidget(
              delay: 300,
              child: QuickLinkItem(
                key: const Key('deleteAccountButton'),
                icon: Icons.delete_outline,
                iconColor: AppColors.error,
                iconBgColor: AppColors.errorRose,
                title: l10n.settings_deleteAccount,
                onTap: () => _showDeleteAccountDialog(context),
              ),
            ),
            const SizedBox(height: 16),
            FadeUpWidget(
              delay: 325,
              child: ProfileLogoutButton(
                onTap: () async {
                  final confirmed = await showLogoutConfirmation(context);
                  if (confirmed == true && context.mounted) {
                    ref.read(riderProvider).logout();
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

  void _showLanguageDialog(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context)!;
    final localeProv = ref.read(localeProvider);
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(l10n.menu_selectLanguage),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              title: Text(l10n.settings_english),
              leading: Radio<String>(
                key: const Key('englishRadio'),
                value: 'en',
                groupValue: localeProv.locale.languageCode,
                onChanged: (v) {
                  ref.read(localeProvider.notifier).setEnglish();
                  Navigator.pop(ctx);
                },
                toggleable: true,
              ),
              onTap: () {
                ref.read(localeProvider.notifier).setEnglish();
                Navigator.pop(ctx);
              },
            ),
            ListTile(
              title: Text('${l10n.settings_hindi} (Hindi)'),
              leading: Radio<String>(
                key: const Key('hindiRadio'),
                value: 'hi',
                groupValue: localeProv.locale.languageCode,
                onChanged: (v) {
                  ref.read(localeProvider.notifier).setHindi();
                  Navigator.pop(ctx);
                },
              ),
              onTap: () {
                ref.read(localeProvider.notifier).setHindi();
                Navigator.pop(ctx);
              },
            ),
          ],
        ),
      ),
    );
  }

  void _showComingSoonSnack(BuildContext context, AppLocalizations l10n) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(l10n.settings_comingSoon),
        backgroundColor: AppColors.warning,
        duration: const Duration(seconds: 2),
      ),
    );
  }

  void _showDeleteAccountDialog(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(l10n.settings_deleteConfirmTitle),
        content: Text(
          l10n.settings_deleteConfirmBody,
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
                    l10n.settings_deleteNotAvailable,
                  ),
                  backgroundColor: AppColors.warning,
                ),
              );
            },
            style: FilledButton.styleFrom(
              backgroundColor: AppColors.error,
            ),
            child: Text(l10n.settings_delete),
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
      style: AppTypography.bodySmall
          .copyWith(fontWeight: FontWeight.w800, letterSpacing: 1.2)
          .copyWith(color: colors.onSurfaceMuted, letterSpacing: 1.2),
    );
  }
}

/// Compact identity card at the top of the Settings screen.
///
/// Shows the rider's name, phone, and KYC pill — answers "am I in the right
/// account?" at a glance, mirroring the iOS / Google Settings pattern.
class _RiderIdentityCard extends StatelessWidget {
  final RiderModel? rider;
  final bool isLoading;

  const _RiderIdentityCard({required this.rider, required this.isLoading});

  String _initials() {
    final name = rider?.name ?? '';
    if (name.isEmpty) return '?';
    return name.substring(0, 1).toUpperCase();
  }

  String _kycLabel() {
    final raw = rider?.kycStatus.name.toUpperCase() ?? 'PENDING';
    if (raw == 'SUBMITTED') return 'Under Review';
    if (raw.isEmpty) return 'Pending';
    return raw[0] + raw.substring(1).toLowerCase();
  }

  bool get _isVerified {
    final raw = rider?.kycStatus.name.toUpperCase() ?? '';
    return raw == 'VERIFIED' || raw == 'APPROVED';
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final name = rider?.name ?? (isLoading ? '…' : 'Rider');
    final phone = rider?.phone ?? '';
    final kyc = _kycLabel();
    final verified = _isVerified;

    return Container(
      padding: Spacing.paddingMd,
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.02),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: verified ? AppColors.success : AppColors.primary,
              shape: BoxShape.circle,
            ),
            alignment: Alignment.center,
            child: Text(
              _initials(),
              style: AppTypography.titleMedium.copyWith(color: Colors.white),
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  name,
                  style: AppTypography.titleSmall
                      .copyWith(color: colors.onSurface),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 2),
                if (phone.isNotEmpty)
                  Text(
                    phone,
                    style: AppTypography.bodySmall
                        .copyWith(fontWeight: FontWeight.w600)
                        .copyWith(color: colors.onSurfaceMuted),
                  ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
            decoration: BoxDecoration(
              color:
                  verified ? AppColors.successLight : AppColors.warningSurface,
              borderRadius: BorderRadius.circular(AppRadius.full),
              border: Border.all(
                color: verified
                    ? AppColors.success.withValues(alpha: 0.2)
                    : AppColors.warningBorder,
              ),
            ),
            child: Text(
              'KYC · $kyc',
              style: AppTypography.labelMedium.copyWith(
                color: verified ? AppColors.successDark : AppColors.warningDark,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Notifications preference tile.
///
/// Master switch for push notifications. Persists via the
/// `notif_push` shared-prefs key that [NotificationService] already reads.
/// Tapping the row (but not the switch) deep-links into the granular
/// `NotificationPreferencesScreen` for per-category controls.
class _NotificationsTile extends StatefulWidget {
  @override
  State<_NotificationsTile> createState() => _NotificationsTileState();
}

class _NotificationsTileState extends State<_NotificationsTile> {
  static const String _prefKey = 'notif_push';

  bool _enabled = true;
  bool _loaded = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      if (!mounted) return;
      setState(() {
        _enabled = prefs.getBool(_prefKey) ?? true;
        _loaded = true;
      });
    } catch (_) {
      if (mounted) setState(() => _loaded = true);
    }
  }

  Future<void> _setEnabled(bool value) async {
    setState(() => _enabled = value);
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setBool(_prefKey, value);
      // Keep the rest of the app in sync.
      await NotificationService().refreshNotificationPreference();
    } catch (_) {
      // fail-open — toggle UI already updated, do not crash the screen
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    return QuickLinkItem(
      key: const Key('notificationsTile'),
      icon: Icons.notifications_outlined,
      iconColor: AppColors.primary,
      iconBgColor: AppColors.primarySurface,
      title: l10n.settings_notifications,
      trailing: Switch.adaptive(
        key: const Key('notificationsSwitch'),
        value: _enabled,
        onChanged: _loaded ? _setEnabled : null,
        activeTrackColor: AppColors.primary,
      ),
      onTap: () =>
          AppNavigator.push(context, const NotificationPreferencesScreen()),
    );
  }
}
