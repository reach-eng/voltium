import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:url_launcher/url_launcher.dart';

import 'package:voltium_rider/core/localization/locale_provider.dart';
import 'package:voltium_rider/core/network/api_client.dart';
import 'package:voltium_rider/core/network/generated/api_client.dart';
import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/models/rider_model.dart';
import 'package:voltium_rider/services/notification_service.dart';
import 'package:voltium_rider/theme/app_theme.dart';
import 'package:voltium_rider/theme/theme_provider.dart';
import 'package:voltium_rider/utils/app_navigator.dart';
import 'package:voltium_rider/widgets/fade_up_widget.dart';
import 'package:voltium_rider/widgets/language_toggle.dart';
import 'package:voltium_rider/features/profile/presentation/screens/edit_profile_screen.dart';
import 'package:voltium_rider/features/profile/presentation/widgets/profile_widgets.dart';

import 'package:voltium_rider/features/notifications/presentation/screens/notification_preferences_screen.dart';
import 'package:voltium_rider/features/support/presentation/screens/feedback_screen.dart';
import 'package:voltium_rider/features/onboarding/presentation/screens/legal_page_screen.dart';
import 'package:voltium_rider/widgets/dialogs.dart';
import 'package:voltium_rider/theme/app_typography.dart';
import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:voltium_rider/utils/app_info.dart';
import 'package:voltium_rider/utils/app_logger.dart';
import 'package:voltium_rider/utils/haptic_service.dart';
import 'package:voltium_rider/utils/toast.dart';
import 'package:voltium_rider/core/observability/posthog_service.dart';

/// App Settings screen.
///
/// Renders the rider's account summary, app preferences, support/legal
/// links, about info, and account/danger-zone actions.
///
/// Exposed widget keys (must stay in sync with
/// `integration_test/e2e_individual/24_settings_screen_test.dart`):
/// - `appSettingsLink`   — the entry-point on the Profile screen.
/// - `backButton`        — the AppBar back button.
/// - `themeOption`       — the Appearance tile on the Preferences section
///   (opens the tri-state theme dialog with `themeSystemRadio` /
///   `themeLightRadio` / `themeDarkRadio`).
/// - `rateUsTile`        — the "Rate Us" row.
/// - `deleteAccountButton` — the "Delete Account" row in the danger zone.
/// - `cancelDeleteButton`  / `confirmDeleteButton` — buttons in the delete dialog.
/// - `logoutButton`      — handled by `ProfileLogoutButton`.
class SettingsScreen extends ConsumerStatefulWidget {
  const SettingsScreen({super.key});

  @override
  ConsumerState<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends ConsumerState<SettingsScreen> {
  @override
  void initState() {
    super.initState();
    PostHogService.screen('settings_screen');
  }

  @override
  Widget build(BuildContext context) {
    final themeProv = ref.watch(themeProvider);
    final colors = AppColors.of(context);
    final l10n = AppLocalizations.of(context);
    final rider = ref.watch(riderProvider.select((p) => p.rider));
    final isLoading = rider == null;
    final localeProv = ref.watch(localeProvider);

    return Scaffold(
      backgroundColor: colors.surface,
      appBar: AppBar(
        key: const Key('settingsAppBar'),
        backgroundColor: colors.surface,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        centerTitle: false,
        leading: IconButton(
          key: const Key('backButton'),
          icon: const Icon(Icons.arrow_back),
          onPressed: () {
            HapticService.light();
            Navigator.of(context).maybePop();
          },
        ),
        title: Text(
          l10n?.settings_title ?? 'Settings',
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
            _SectionLabel(l10n?.settings_preferences ?? 'Preferences'),
            const SizedBox(height: 12),
            FadeUpWidget(
              delay: 50,
              child: QuickLinkItem(
                key: const Key('themeOption'),
                icon: Icons.brightness_6_outlined,
                iconColor: colors.onSurfaceVariant,
                iconBgColor: colors.iconBackground,
                title: l10n?.settings_appearance ?? 'Appearance',
                trailing: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      _themeModeLabel(themeProv, l10n),
                      style: AppTypography.bodyMedium
                          .copyWith(fontWeight: FontWeight.w600)
                          .copyWith(color: colors.onSurfaceMuted),
                    ),
                    const SizedBox(width: 8),
                    Icon(Icons.chevron_right, color: colors.outline, size: 20),
                  ],
                ),
                onTap: () => _showThemeDialog(context, ref),
              ),
            ),
            const SizedBox(height: 8),
            FadeUpWidget(
              delay: 75,
              child: _NotificationsTile(),
            ),
            const SizedBox(height: 24),

            // ── Language & Region ───────────────────────────────────────
            _SectionLabel(l10n?.settings_language ?? 'Language'),
            const SizedBox(height: 12),
            FadeUpWidget(
              delay: 100,
              child: QuickLinkItem(
                key: const Key('languageOption'),
                icon: Icons.language,
                iconColor: AppColors.success,
                iconBgColor: colors.successSurface,
                title: l10n?.menu_language ?? 'Language',
                trailing: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      localeProv.isFollowingSystem
                          ? (l10n?.settings_followSystem ?? 'Follow system')
                          : LocaleNotifier.displayNameFor(localeProv.locale,
                              l10n ?? AppLocalizations.of(context)!),
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
            // TODO(audit 2026-08-22): BiometricService integration (biometric
            // unlock / step-up auth for this section) is planned but
            // deliberately deferred — tracked in the audit follow-ups.
            _SectionLabel(l10n?.settings_securitySection ?? 'Security'),
            const SizedBox(height: 12),
            FadeUpWidget(
              delay: 125,
              child: QuickLinkItem(
                key: const Key('editProfileTile'),
                icon: Icons.person_outline,
                iconColor: AppColors.info,
                iconBgColor: colors.primarySurface,
                title: l10n?.txteditProfile ?? 'Edit Profile',
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
                iconBgColor: colors.warningSurface,
                title: l10n?.txtchangeLockPassword ?? 'Change Lock Password',
                // AUDIT FIX (2026-08-22, HIGH): this tile used to verify
                // identity and then do NOTHING. After a successful verify it
                // now opens the in-dialog lock-password change flow below.
                onTap: () => _showVerifyLockPasswordDialog(
                  context,
                  onVerified: () {
                    if (!context.mounted) return;
                    Toast.success(
                      context,
                      'Identity verified',
                    );
                    _showChangeLockPasswordDialog(context);
                  },
                ),
              ),
            ),
            const SizedBox(height: 24),

            // ── Support & Legal ──────────────────────────────────────────
            _SectionLabel(l10n?.settings_supportLegal ?? 'Support & Legal'),
            const SizedBox(height: 12),
            FadeUpWidget(
              delay: 175,
              child: QuickLinkItem(
                key: const Key('feedbackLink'),
                icon: Icons.rate_review_outlined,
                activeIcon: Icons.rate_review,
                iconColor: AppColors.accentPurple,
                iconBgColor: colors.primarySurface,
                title: l10n?.settings_feedback ?? 'Feedback',
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
                iconBgColor: colors.successSurface,
                title: l10n?.settings_termsOfService ?? 'Terms of Service',
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
                iconBgColor: colors.successSurface,
                title: l10n?.settings_privacyPolicy ?? 'Privacy Policy',
                onTap: () => AppNavigator.push(
                    context,
                    const LegalPageScreen(
                        documentType: LegalDocumentType.privacy)),
              ),
            ),
            const SizedBox(height: 24),

            // ── About ────────────────────────────────────────────────────
            _SectionLabel(l10n?.settings_about ?? 'About'),
            const SizedBox(height: 12),
            FadeUpWidget(
              delay: 250,
              child: QuickLinkItem(
                key: const Key('appVersionTile'),
                icon: Icons.info_outline,
                iconColor: colors.onSurfaceVariant,
                iconBgColor: colors.iconBackground,
                title: l10n?.settings_appVersion ?? 'App version',
                trailing: Text(
                  // AUDIT FIX (2026-08-22): was a hardcoded 'v2.1.0' that
                  // drifted from pubspec (1.0.0+1). Read from AppInfo.
                  'v${AppInfo.version}',
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
                iconBgColor: colors.warningSurface,
                title: l10n?.settings_rateUs ?? 'Rate us',
                onTap: () async {
                  final url = Uri.parse(
                      'https://play.google.com/store/apps/details?id=com.voltium.rider');
                  try {
                    await launchUrl(url, mode: LaunchMode.externalApplication);
                  } catch (e) {
                    // AUDIT FIX (2026-08-22): was a silent `catch (_) {}`.
                    appDebug(
                        'SettingsScreen: failed to open store listing: $e');
                  }
                },
              ),
            ),
            const SizedBox(height: 24),

            // ── Account / danger zone ───────────────────────────────────
            _SectionLabel(l10n?.settings_accountSection ?? 'Account'),
            const SizedBox(height: 12),
            FadeUpWidget(
              delay: 300,
              child: QuickLinkItem(
                key: const Key('deleteAccountButton'),
                icon: Icons.delete_outline,
                iconColor: AppColors.error,
                iconBgColor: colors.errorSurface,
                title: l10n?.settings_deleteAccount ?? 'Delete account',
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
                    // AUDIT FIX (2026-08-22): logout() is async — await it so
                    // popUntil can't race the session teardown / cache wipe.
                    await ref.read(riderProvider.notifier).logout();
                    if (context.mounted) {
                      Navigator.of(context).popUntil((route) => route.isFirst);
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

  /// Opens the lock-password verification dialog.
  ///
  /// AUDIT FIX (2026-08-22): converted from a StatefulBuilder with a leaked
  /// TextEditingController to a proper StatefulWidget that disposes its
  /// controllers. The dialog now only pops on SUCCESS; failures stay open
  /// with a friendly mapped message (raw server strings are never shown).
  /// [onVerified] runs after a successful verification — used both by the
  /// change-password flow and as step-up auth for account deletion.
  void _showVerifyLockPasswordDialog(
    BuildContext context, {
    VoidCallback? onVerified,
  }) {
    showDialog(
      context: context,
      builder: (_) => _VerifyLockPasswordDialog(onVerified: onVerified),
    );
  }

  /// AUDIT FIX (2026-08-22, HIGH): minimal in-dialog change flow. The lock
  /// PIN is stored server-side as `lockPasswordHash` (admin-managed today);
  /// this dialog validates a new 4-digit PIN and POSTs it to
  /// `/api/rider/device/set-lock`, which the backend is expected to hash and
  /// persist. Failures map to friendly text — never a raw server message.
  void _showChangeLockPasswordDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (_) => const _ChangeLockPasswordDialog(),
    );
  }

  /// AUDIT FIX (2026-08-22): account deletion now requires lock-password
  /// step-up verification before the request is submitted.
  void _showDeleteAccountDialog(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final colors = AppColors.of(context);
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: colors.surface,
        title: Text(l10n?.settings_deleteConfirmTitle ?? 'Delete Account'),
        content: Text(
          l10n?.settings_deleteConfirmBody ??
              'Are you sure you want to delete your account? This action cannot be undone.',
        ),
        actions: [
          TextButton(
            key: const Key('cancelDeleteButton'),
            onPressed: () => Navigator.pop(ctx),
            child: Text(MaterialLocalizations.of(ctx).cancelButtonLabel),
          ),
          FilledButton(
            key: const Key('confirmDeleteButton'),
            // PR-3 (2026-08-07 verification report, Section 2): the request
            // goes to the dedicated delete-request endpoint (audit log +
            // rider marker). AUDIT FIX (2026-08-22): gated behind lock
            // password step-up verification.
            onPressed: () {
              Navigator.pop(ctx);
              _showVerifyLockPasswordDialog(
                context,
                onVerified: () => _submitAccountDeletionRequest(context, l10n),
              );
            },
            style: FilledButton.styleFrom(
              backgroundColor: AppColors.error,
            ),
            child: Text(l10n?.settings_delete ?? 'Delete'),
          ),
        ],
      ),
    );
  }

  Future<void> _submitAccountDeletionRequest(
    BuildContext context,
    AppLocalizations? l10n,
  ) async {
    // In-flight feedback (replaced by the result toast below).
    Toast.info(context, 'Submitting account deletion request…');
    try {
      // PR-13: was a wrapper call to
      // `VoltiumApiService.post` (a 1-line pass-through to
      // `ApiClient.post`). Call the transport directly.
      await ref.read(apiClientProvider).post(
        '/api/rider/account/delete-request',
        body: {
          'reason':
              l10n?.settings_deleteReason ?? 'Rider requested account deletion',
          'timestamp': DateTime.now().toIso8601String(),
        },
      );
    } catch (_) {
      if (context.mounted) {
        Toast.error(
          context,
          'Failed to submit deletion request. Please try again or contact support.',
        );
      }
      return;
    }
    if (context.mounted) {
      Toast.success(
        context,
        'Account deletion request submitted successfully. An administrator will review and process it.',
      );
    }
  }

  void _showLanguageDialog(BuildContext context, WidgetRef ref) {
    showAppLanguageDialog(context, ref);
  }

  /// Tri-state theme picker (Follow System / Light / Dark).
  void _showThemeDialog(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final currentMode = ref.read(themeProvider).themeMode;
    final colors = AppColors.of(context);

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: colors.surface,
        title: Text(l10n?.settings_appearance ?? 'Appearance'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              title: Text(l10n?.settings_followSystem ?? 'Follow system'),
              leading: Radio<ThemeMode>(
                key: const Key('themeSystemRadio'),
                value: ThemeMode.system,
                groupValue: currentMode,
                onChanged: (v) {
                  ref
                      .read(themeProvider.notifier)
                      .setThemeMode(ThemeMode.system);
                  Navigator.pop(ctx);
                },
              ),
              onTap: () {
                ref.read(themeProvider.notifier).setThemeMode(ThemeMode.system);
                Navigator.pop(ctx);
              },
            ),
            ListTile(
              title: Text(l10n?.settings_themeLight ?? 'Light mode'),
              leading: Radio<ThemeMode>(
                key: const Key('themeLightRadio'),
                value: ThemeMode.light,
                groupValue: currentMode,
                onChanged: (v) {
                  ref
                      .read(themeProvider.notifier)
                      .setThemeMode(ThemeMode.light);
                  Navigator.pop(ctx);
                },
              ),
              onTap: () {
                ref.read(themeProvider.notifier).setThemeMode(ThemeMode.light);
                Navigator.pop(ctx);
              },
            ),
            ListTile(
              title: Text(l10n?.settings_themeDark ?? 'Dark mode'),
              leading: Radio<ThemeMode>(
                key: const Key('themeDarkRadio'),
                value: ThemeMode.dark,
                groupValue: currentMode,
                onChanged: (v) {
                  ref.read(themeProvider.notifier).setThemeMode(ThemeMode.dark);
                  Navigator.pop(ctx);
                },
              ),
              onTap: () {
                ref.read(themeProvider.notifier).setThemeMode(ThemeMode.dark);
                Navigator.pop(ctx);
              },
            ),
          ],
        ),
      ),
    );
  }

  static String _themeModeLabel(ThemeState theme, AppLocalizations? l10n) {
    switch (theme.themeMode) {
      case ThemeMode.light:
        return l10n?.settings_themeLight ?? 'Light mode';
      case ThemeMode.dark:
        return l10n?.settings_themeDark ?? 'Dark mode';
      case ThemeMode.system:
        return l10n?.settings_followSystem ?? 'Follow system';
    }
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
      // AUDIT FIX (2026-08-22): letterSpacing was chained twice via two
      // copyWith calls — collapsed into one.
      style: AppTypography.bodySmall.copyWith(
        fontWeight: FontWeight.w800,
        letterSpacing: 1.2,
        color: colors.onSurfaceMuted,
      ),
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
              color: verified ? colors.successSurface : colors.warningSurface,
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
                color: verified ? AppColors.success : AppColors.warningDark,
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
    final l10n = AppLocalizations.of(context);
    final colors = AppColors.of(context);
    return QuickLinkItem(
      key: const Key('notificationsTile'),
      icon: Icons.notifications_outlined,
      iconColor: AppColors.primary,
      iconBgColor: colors.primarySurface,
      title: l10n?.settings_notifications ?? 'Notifications',
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

/// Lock-password verification dialog.
///
/// AUDIT FIX (2026-08-22): a StatefulWidget (instead of the old
/// StatefulBuilder) so the TextEditingController is properly disposed.
/// Behaviour contract:
///   - pops ONLY on successful verification (failures keep the dialog open);
///   - failure messages are mapped to friendly text — raw server strings are
///     never rendered;
///   - the confirm button is disabled while the request is in flight;
///   - [onVerified] (optional) runs after a successful verification.
class _VerifyLockPasswordDialog extends StatefulWidget {
  final VoidCallback? onVerified;

  const _VerifyLockPasswordDialog({this.onVerified});

  @override
  State<_VerifyLockPasswordDialog> createState() =>
      _VerifyLockPasswordDialogState();
}

class _VerifyLockPasswordDialogState extends State<_VerifyLockPasswordDialog> {
  final _controller = TextEditingController();
  bool _submitting = false;
  String? _errorText;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _verify() async {
    final pw = _controller.text.trim();
    if (pw.isEmpty || _submitting) return;
    setState(() {
      _submitting = true;
      _errorText = null;
    });
    final l10n = AppLocalizations.of(context);
    try {
      // PR-13: was a wrapper call to
      // `VoltiumApiService.verifyLockPassword`, which was a 1-line
      // pass-through to `postRiderDeviceVerifyLock`. The generated
      // method already returns `Map<String, dynamic>` so the
      // call shape is identical. Ad-hoc client (not Riverpod) because
      // this dialog is a plain StatefulWidget, not ConsumerStatefulWidget.
      final result = await VoltiumApiClient(ApiClient())
          .postRiderDeviceVerifyLock({'password': pw});
      final isSuccess =
          result['data']?['success'] == true || result['success'] == true;
      if (!mounted) return;
      if (isSuccess) {
        Navigator.of(context).pop();
        widget.onVerified?.call();
      } else {
        // AUDIT FIX: friendly mapped message — never the raw server string.
        setState(() {
          _submitting = false;
          _errorText = 'Incorrect lock password. Please try again.';
        });
      }
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _errorText = l10n?.txtlockPasswordVerifyFailed ??
            'Lock password verification failed. Please try again.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final l10n = AppLocalizations.of(context);
    return AlertDialog(
      backgroundColor: colors.surface,
      title: Text(l10n?.txtchangeLockPassword ?? 'Change Lock Password'),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              l10n?.txtlockPasswordSubtitle ??
                  'Enter your 4-digit lock password to verify your identity.',
            ),
            const SizedBox(height: 16),
            TextField(
              key: const Key('lockPasswordInput'),
              controller: _controller,
              obscureText: true,
              keyboardType: TextInputType.number,
              maxLength: 4,
              enabled: !_submitting,
              decoration: InputDecoration(
                labelText: l10n?.txtlockPassword ?? 'Lock Password',
                border: const OutlineInputBorder(),
                errorText: _errorText,
                errorMaxLines: 2,
              ),
              onSubmitted: (_) => _verify(),
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: _submitting ? null : () => Navigator.of(context).pop(),
          child: Text(l10n?.txtcancel ?? 'Cancel'),
        ),
        ElevatedButton(
          key: const Key('confirmVerifyLockButton'),
          onPressed: _submitting ? null : _verify,
          child: _submitting
              ? const SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : Text(l10n?.txtverify ?? 'Verify'),
        ),
      ],
    );
  }
}

/// New-lock-PIN entry dialog (second step of the change flow).
///
/// AUDIT FIX (2026-08-22, HIGH): implements the previously-missing change
/// flow. Validates a 4-digit PIN (same shape the backend verify flow
/// expects), requires the confirmation field to match, then POSTs to
/// `/api/rider/device/set-lock` for the server to hash + persist. Success and
/// failure are surfaced via toast; failures keep the dialog open with
/// friendly text.
class _ChangeLockPasswordDialog extends StatefulWidget {
  const _ChangeLockPasswordDialog();

  @override
  State<_ChangeLockPasswordDialog> createState() =>
      _ChangeLockPasswordDialogState();
}

class _ChangeLockPasswordDialogState extends State<_ChangeLockPasswordDialog> {
  static final RegExp _pinPattern = RegExp(r'^\d{4}$');

  final _newController = TextEditingController();
  final _confirmController = TextEditingController();
  bool _submitting = false;
  String? _errorText;

  @override
  void dispose() {
    _newController.dispose();
    _confirmController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_submitting) return;
    final newPin = _newController.text.trim();
    final confirmPin = _confirmController.text.trim();
    if (!_pinPattern.hasMatch(newPin) || !_pinPattern.hasMatch(confirmPin)) {
      setState(() => _errorText = 'Enter a 4-digit lock password.');
      return;
    }
    if (newPin != confirmPin) {
      setState(() => _errorText = 'Passwords do not match.');
      return;
    }
    setState(() {
      _submitting = true;
      _errorText = null;
    });
    try {
      // PR-13: was a wrapper call to
      // `VoltiumApiService.post` (a 1-line pass-through to
      // `ApiClient.post`). Call the transport directly. Ad-hoc
      // client (not Riverpod) because this dialog is a plain
      // StatefulWidget, not ConsumerStatefulWidget.
      await ApiClient().post(
        '/api/rider/device/set-lock',
        body: {'password': newPin},
      );
      if (!mounted) return;
      Navigator.of(context).pop();
      Toast.success(context, 'Lock password updated successfully');
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _errorText =
            "Couldn't update the lock password right now. Please try again or contact support.";
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final l10n = AppLocalizations.of(context);
    return AlertDialog(
      backgroundColor: colors.surface,
      title: Text(l10n?.txtchangeLockPassword ?? 'Change Lock Password'),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(l10n?.txtchooseNewLockPassword ??
                'Choose a new 4-digit lock password.'),
            const SizedBox(height: 16),
            TextField(
              key: const Key('newLockPasswordInput'),
              controller: _newController,
              obscureText: true,
              keyboardType: TextInputType.number,
              maxLength: 4,
              enabled: !_submitting,
              decoration: const InputDecoration(
                labelText: 'New Lock Password',
                border: OutlineInputBorder(),
                counterText: '',
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              key: const Key('confirmNewLockPasswordInput'),
              controller: _confirmController,
              obscureText: true,
              keyboardType: TextInputType.number,
              maxLength: 4,
              enabled: !_submitting,
              decoration: InputDecoration(
                labelText: 'Confirm New Lock Password',
                border: const OutlineInputBorder(),
                counterText: '',
                errorText: _errorText,
                errorMaxLines: 2,
              ),
              onSubmitted: (_) => _submit(),
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: _submitting ? null : () => Navigator.of(context).pop(),
          child: Text(l10n?.txtcancel ?? 'Cancel'),
        ),
        ElevatedButton(
          key: const Key('confirmChangeLockButton'),
          onPressed: _submitting ? null : _submit,
          child: _submitting
              ? const SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : Text(l10n?.txtsave ?? 'Save'),
        ),
      ],
    );
  }
}
