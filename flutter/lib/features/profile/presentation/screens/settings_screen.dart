import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:url_launcher/url_launcher.dart';

import 'package:voltium_rider/core/localization/locale_provider.dart';
import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/models/rider_model.dart';
import 'package:voltium_rider/services/notification_service.dart';
import 'package:voltium_rider/services/voltium_api_service.dart';
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
import 'package:voltium_rider/main.dart';
import 'package:voltium_rider/widgets/dialogs.dart';
import 'package:voltium_rider/theme/app_typography.dart';
import 'package:voltium_rider/gen/app_localizations.dart';

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
class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final themeProv = ref.watch(themeProvider);
    final colors = AppColors.of(context);
    final l10n = AppLocalizations.of(context)!;
    final rider = ref.watch(riderProvider.select((p) => p.rider));
    final isLoading = rider == null;
    final localeProv = ref.watch(localeProvider);

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
                key: const Key('themeOption'),
                icon: Icons.brightness_6_outlined,
                iconColor: colors.onSurfaceVariant,
                iconBgColor: colors.iconBackground,
                title: l10n.settings_appearance,
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
            // LANGUAGE-AUDIT (2026-08-16) #4: was a hardcoded 'LANGUAGE'
            // string, the only ALL-CAPS section label on the screen —
            // every other section uses `l10n.settings_*Section` (or the
            // existing styled `l10n.settings_*` keys) so the rider sees
            // a localised Title-Case header in sync with the rest of
            // the section. The `_SectionLabel` widget applies w800 +
            // letterSpacing 1.2 — that's the only visual treatment.
            _SectionLabel(l10n.settings_language),
            const SizedBox(height: 12),
            FadeUpWidget(
              delay: 100,
              child: QuickLinkItem(
                key: const Key('languageOption'),
                icon: Icons.language,
                iconColor: AppColors.success,
                iconBgColor: AppColors.of(context).successLight,
                title: l10n.menu_language,
                trailing: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // LANGUAGE-AUDIT (2026-08-16) #11: was a hardcoded
                    // `currentLocale == 'hi' ? l10n.settings_hindi :
                    // l10n.settings_english` ternary. Now uses the
                    // LocaleNotifier helper so a 3rd language shows
                    // its own name without a code change here.
                    Text(
                      localeProv.isFollowingSystem
                          ? l10n.settings_followSystem
                          : LocaleNotifier.displayNameFor(
                              localeProv.locale, l10n),
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
                iconBgColor: AppColors.of(context).primarySurface,
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
                iconBgColor: AppColors.of(context).warningLight,
                // PR-VER-2026-08-07 (LEGAL_DEVICE P0-2 / PASS3): the tile opens
                // the lock-password VERIFICATION step of a change flow — label
                // it as what the rider is actually doing.
                // LANGUAGE-AUDIT (2026-08-16) T-66: hardcoded
                // English. Localised via `txtchangeLockPassword`
                // (new ARB key, see app_en.arb).
                title: l10n.txtchangeLockPassword,
                onTap: () => _showVerifyLockPasswordDialog(context),
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
                iconBgColor: AppColors.of(context).successLight,
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
                iconBgColor: AppColors.of(context).successLight,
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
                iconBgColor: AppColors.of(context).warningLight,
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
            // PR-3 (2026-08-07 verification, Section 2): delete flow now
            // records a real request via /api/rider/account/delete-request
            // (audit log + rider marker) — the tile is safe to show in all
            // builds (audit #6 P0-4 was resolved by the endpoint).
            FadeUpWidget(
              delay: 300,
              child: QuickLinkItem(
                key: const Key('deleteAccountButton'),
                icon: Icons.delete_outline,
                iconColor: AppColors.error,
                iconBgColor: AppColors.of(context).errorRose,
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
                    ref.read(riderProvider.notifier).logout();
                    if (context.mounted) {
                      // Clear the whole stack so the back button can't
                      // resurrect the logged-out rider's screens; the router
                      // re-renders the splash/auth flow from app state.
                      Navigator.of(context).pushAndRemoveUntil(
                        MaterialPageRoute(
                          builder: (_) => const AppShell(),
                        ),
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

  void _showVerifyLockPasswordDialog(BuildContext context) {
    final controller = TextEditingController();
    final colors = AppColors.of(context);
    // LANGUAGE-AUDIT (2026-08-16) T-66: every string in the
    // dialog body, the actions row, and the error snackbar is
    // now routed through `l10n`. Three new ARB keys
    // (`txtchangeLockPassword`, `txtlockPassword`,
    // `txtlockPasswordVerifyFailed`, `txtlockPasswordSubtitle`)
    // were added in this PR; `txtchangeLockPassword` is shared
    // with the tile label above.
    final l10n = AppLocalizations.of(context)!;

    showDialog(
      context: context,
      builder: (ctx) {
        bool isSubmitting = false;
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              backgroundColor: colors.surface,
              title: Text(l10n.txtchangeLockPassword),
              content: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      l10n.txtlockPasswordSubtitle,
                    ),
                    const SizedBox(height: 16),
                    TextField(
                      key: const Key('lockPasswordInput'),
                      controller: controller,
                      obscureText: true,
                      decoration: InputDecoration(
                        labelText: l10n.txtlockPassword,
                        border: const OutlineInputBorder(),
                      ),
                    ),
                  ],
                ),
              ),
              actions: [
                TextButton(
                  onPressed: isSubmitting ? null : () => Navigator.pop(ctx),
                  child: Text(l10n.txtcancel),
                ),
                ElevatedButton(
                  key: const Key('confirmVerifyLockButton'),
                  onPressed: isSubmitting
                      ? null
                      : () async {
                          final pw = controller.text.trim();
                          if (pw.isEmpty) return;
                          setDialogState(() => isSubmitting = true);
                          try {
                            final result = await VoltiumApiService()
                                .verifyLockPassword(pw);
                            if (ctx.mounted) Navigator.pop(ctx);
                            final isSuccess =
                                result['data']?['success'] == true ||
                                    result['success'] == true;
                            final msg = result['message'] as String? ??
                                (isSuccess
                                    ? 'Lock password verified successfully'
                                    : 'Verification failed');
                            if (context.mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(
                                  content: Text(msg),
                                  backgroundColor: isSuccess
                                      ? AppColors.success
                                      : AppColors.error,
                                ),
                              );
                            }
                          } catch (e) {
                            if (ctx.mounted) Navigator.pop(ctx);
                            if (context.mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(
                                  content:
                                      Text(l10n.txtlockPasswordVerifyFailed),
                                  backgroundColor: AppColors.error,
                                ),
                              );
                            }
                          }
                        },
                  child: isSubmitting
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : Text(l10n.txtverify),
                ),
              ],
            );
          },
        );
      },
    );
  }

  void _showLanguageDialog(BuildContext context, WidgetRef ref) {
    showAppLanguageDialog(context, ref);
  }

  /// Tri-state theme picker (Follow System / Light / Dark).
  void _showThemeDialog(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context)!;
    final currentMode = ref.read(themeProvider).themeMode;

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(l10n.settings_appearance),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              title: Text(l10n.settings_followSystem),
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
              title: Text(l10n.settings_themeLight),
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
              title: Text(l10n.settings_themeDark),
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

  static String _themeModeLabel(ThemeState theme, AppLocalizations l10n) {
    switch (theme.themeMode) {
      case ThemeMode.light:
        return l10n.settings_themeLight;
      case ThemeMode.dark:
        return l10n.settings_themeDark;
      case ThemeMode.system:
        return l10n.settings_followSystem;
    }
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
            onPressed: () async {
              Navigator.pop(ctx);
              // PR-3 (2026-08-07 verification report, Section 2): the old
              // code POSTed `{action: 'DELETE_REQUEST'}` to /api/rider/profile
              // which had no handler — the request was silently dropped while
              // the app showed a success snackbar. Now records the request via
              // the dedicated endpoint (audit log + rider marker).
              try {
                await VoltiumApiService().post(
                  '/api/rider/account/delete-request',
                  body: {
                    'reason': l10n.settings_deleteReason,
                    'timestamp': DateTime.now().toIso8601String(),
                  },
                );
              } catch (_) {
                // Best-effort: the request is also recorded client-side only
                // on success; on failure surface an error instead of a false
                // success.
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text(
                        'Failed to submit deletion request. Please try again or contact support.',
                      ),
                      duration: Duration(seconds: 5),
                      backgroundColor: AppColors.error,
                    ),
                  );
                }
                return;
              }
              if (context.mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text(
                      'Account deletion request submitted successfully. An administrator will review and process it.',
                    ),
                    duration: Duration(seconds: 5),
                    backgroundColor: AppColors.success,
                  ),
                );
              }
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
              color: verified
                  ? AppColors.of(context).successLight
                  : AppColors.warningSurface,
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
      iconBgColor: AppColors.of(context).primarySurface,
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
