import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:voltium_rider/core/network/api_client.dart';
import 'package:voltium_rider/core/observability/posthog_service.dart';

import 'package:voltium_rider/models/rider_model.dart';
import 'package:voltium_rider/utils/app_navigator.dart';
import 'package:voltium_rider/utils/haptic_service.dart';
import 'package:voltium_rider/widgets/fade_up_widget.dart';
import 'package:voltium_rider/widgets/language_toggle.dart';
import 'package:voltium_rider/core/localization/locale_provider.dart';
import 'package:voltium_rider/features/rewards/presentation/screens/rewards_screen.dart';
import 'profile_detail_screen.dart';
import 'package:voltium_rider/features/kyc/presentation/screens/documents_screen.dart';
import 'package:voltium_rider/features/referrals/presentation/screens/referral_screen.dart';

import 'package:voltium_rider/features/device_compliance/presentation/screens/emergency_sos_screen.dart';
import 'package:voltium_rider/features/workflows/presentation/screens/rider_workflow_hub_screen.dart';
import 'package:voltium_rider/features/profile/presentation/screens/settings_screen.dart';
import '../widgets/profile_widgets.dart';
import '../../../../theme/app_theme.dart';
import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/theme/app_typography.dart';
import 'package:voltium_rider/widgets/skeleton_loader.dart';
import 'package:voltium_rider/gen/app_localizations.dart';

/// Menu screen (formerly "Profile" tab).
/// Shows a compact rider header and a list of navigation links.
/// Detailed profile information lives in [ProfileDetailScreen].
class ProfileScreen extends ConsumerStatefulWidget {
  const ProfileScreen({super.key});

  @override
  ConsumerState<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends ConsumerState<ProfileScreen> {
  @override
  void initState() {
    super.initState();
    PostHogService.screen('profile_menu_screen');
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      backgroundColor: colors.surface,
      appBar: _buildAppBar(context),
      body: Consumer(
        builder: (context, innerRef, _) {
          final rider = innerRef.watch(riderProvider.select((p) => p.rider));
          final dataState =
              innerRef.watch(riderProvider.select((p) => p.dataState));
          final localeProv = innerRef.watch(localeProvider);
          final currentLocale = localeProv.locale.languageCode;
          final isLoading = rider == null &&
              (dataState == DataState.initial ||
                  dataState == DataState.loading);

          if (isLoading) {
            return const ProfileSkeleton();
          }

          return RefreshIndicator(
            onRefresh: () async {
              await ref.read(riderProvider.notifier).refreshFromApi();
            },
            child: SingleChildScrollView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // ── Compact rider header ──────────────────────────────────
                  FadeUpWidget(
                    delay: 0,
                    child: _CompactRiderHeader(rider: rider),
                  ),
                  const SizedBox(height: 24),

                  // ── Menu sections ─────────────────────────────────────────
                  _SectionLabel(l10n?.menu_account ?? 'ACCOUNT'),
                  const SizedBox(height: 12),

                  FadeUpWidget(
                    delay: 100,
                    child: _MenuGroupCard(
                      children: [
                        QuickLinkItem(
                          key: const Key('profileMenuLink'),
                          icon: Icons.person_outline,
                          activeIcon: Icons.person,
                          iconColor: AppColors.primary,
                          iconBgColor: colors.primarySurface,
                          title: l10n?.menu_profile ?? 'Profile',
                          showContainer: false,
                          onTap: () {
                            PostHogService.capture('profile_menu_item_clicked',
                                properties: {'item': 'profile'});
                            AppNavigator.push(
                                context, const ProfileDetailScreen());
                          },
                        ),
                        QuickLinkItem(
                          key: const Key('myDocumentsLink'),
                          icon: Icons.contact_page_outlined,
                          activeIcon: Icons.contact_page,
                          iconColor: AppColors.success,
                          iconBgColor: colors.successSurface,
                          title: l10n?.menu_myDocuments ?? 'My Documents',
                          showContainer: false,
                          onTap: () {
                            PostHogService.capture('profile_menu_item_clicked',
                                properties: {'item': 'documents'});
                            AppNavigator.push(
                                context, const MyDocumentsScreen());
                          },
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 24),

                  _SectionLabel(l10n?.menu_rewardsMore ?? 'REWARDS & MORE'),
                  const SizedBox(height: 12),

                  FadeUpWidget(
                    delay: 200,
                    child: _MenuGroupCard(
                      children: [
                        QuickLinkItem(
                          key: const Key('rewardsLink'),
                          icon: Icons.card_giftcard_outlined,
                          activeIcon: Icons.card_giftcard,
                          iconColor: AppColors.accentPurple,
                          iconBgColor: colors.primarySurface,
                          title: l10n?.menu_rewards ?? 'Rewards',
                          showContainer: false,
                          onTap: () {
                            PostHogService.capture('profile_menu_item_clicked',
                                properties: {'item': 'rewards'});
                            AppNavigator.push(context, const RewardsScreen());
                          },
                        ),
                        QuickLinkItem(
                          key: const Key('referralLink'),
                          icon: Icons.people_outline,
                          activeIcon: Icons.people,
                          iconColor: AppColors.warning,
                          iconBgColor: colors.warningSurface,
                          title:
                              l10n?.menu_referralProgram ?? 'Referral Program',
                          showContainer: false,
                          onTap: () {
                            PostHogService.capture('profile_menu_item_clicked',
                                properties: {'item': 'referral'});
                            AppNavigator.push(context, const ReferralScreen());
                          },
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 24),

                  _SectionLabel(l10n?.menu_general ?? 'GENERAL'),
                  const SizedBox(height: 12),

                  FadeUpWidget(
                    delay: 300,
                    child: _MenuGroupCard(
                      children: [
                        QuickLinkItem(
                          key: const Key('workflowHubLink'),
                          icon: Icons.route_outlined,
                          activeIcon: Icons.route,
                          iconColor: AppColors.primary,
                          iconBgColor: colors.primarySurface,
                          title: l10n?.menu_workflowServices ??
                              'Workflow & Services',
                          showContainer: false,
                          onTap: () {
                            PostHogService.capture('profile_menu_item_clicked',
                                properties: {'item': 'workflows'});
                            AppNavigator.push(
                                context, const RiderWorkflowHubScreen());
                          },
                        ),
                        QuickLinkItem(
                          key: const Key('appSettingsLink'),
                          icon: Icons.tune_outlined,
                          activeIcon: Icons.tune,
                          iconColor: colors.onSurfaceVariant,
                          iconBgColor: colors.iconBackground,
                          title: l10n?.menu_appSettings ?? 'App Settings',
                          showContainer: false,
                          onTap: () {
                            PostHogService.capture('profile_menu_item_clicked',
                                properties: {'item': 'settings'});
                            AppNavigator.push(context, const SettingsScreen());
                          },
                        ),
                        QuickLinkItem(
                          key: const Key('languageLink'),
                          icon: Icons.language,
                          iconColor: AppColors.success,
                          iconBgColor: colors.successSurface,
                          title: l10n?.menu_language ?? 'Language',
                          showContainer: false,
                          trailing: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(
                                localeProv.isFollowingSystem
                                    ? (l10n?.settings_followSystem ??
                                        'Follow system')
                                    : (l10n != null
                                        ? LocaleNotifier.displayNameFor(
                                            localeProv.locale, l10n)
                                        : (currentLocale == 'hi'
                                            ? 'हिंदी'
                                            : 'English')),
                                style: AppTypography.bodyMedium.copyWith(
                                  color: colors.onSurfaceMuted,
                                ),
                              ),
                              const SizedBox(width: 8),
                              Icon(Icons.chevron_right,
                                  color: colors.outline, size: 20),
                            ],
                          ),
                          onTap: () {
                            PostHogService.capture('profile_menu_item_clicked',
                                properties: {'item': 'language'});
                            _showLanguageDialog(context, ref);
                          },
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),

                  FadeUpWidget(
                    delay: 360,
                    child: ProfileEmergencySosTile(
                      onTap: () {
                        PostHogService.capture('profile_menu_item_clicked',
                            properties: {'item': 'emergency_sos'});
                        AppNavigator.push(context, const EmergencySOSScreen());
                      },
                    ),
                  ),
                  const SizedBox(height: 48),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  PreferredSizeWidget _buildAppBar(BuildContext context) {
    final colors = AppColors.of(context);
    final l10n = AppLocalizations.of(context);
    return AppBar(
      backgroundColor: colors.surface,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      automaticallyImplyLeading: false,
      centerTitle: false,
      titleSpacing: 20,
      title: Text(
        l10n?.menu_title ?? 'Menu',
        style: AppTypography.headingMedium
            .copyWith(color: colors.onSurface, letterSpacing: -0.5),
      ),
    );
  }

  void _showLanguageDialog(BuildContext context, WidgetRef ref) {
    showAppLanguageDialog(context, ref);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal widgets
// ─────────────────────────────────────────────────────────────────────────────

class _SectionLabel extends StatelessWidget {
  final String label;
  const _SectionLabel(this.label);

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Text(
      label,
      style: AppTypography.bodySmall.copyWith(
        fontWeight: FontWeight.w800,
        letterSpacing: 1.2,
        color: colors.onSurfaceVariant,
      ),
    );
  }
}

/// Compact header showing avatar, name and KYC badge — no redundant detail.
class _CompactRiderHeader extends StatelessWidget {
  final RiderModel? rider;
  const _CompactRiderHeader({this.rider});

  String? _getAvatarUrl() {
    if (rider?.profilePhoto == null || rider!.profilePhoto!.isEmpty) {
      return null;
    }
    if (rider!.profilePhoto!.startsWith('http')) return rider!.profilePhoto;
    final baseUrl = ApiClient().baseUrl;
    return '$baseUrl/api/files/${rider!.profilePhoto!.replaceFirst(RegExp(r'^/+'), '')}';
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final l10n = AppLocalizations.of(context);
    final avatarUrl = _getAvatarUrl();
    final String initial = (rider?.name.isNotEmpty ?? false)
        ? rider!.name.substring(0, 1).toUpperCase()
        : '?';
    final String kycStatusName =
        rider?.kycStatus.name.toUpperCase() ?? 'PENDING';
    final bool isVerified =
        kycStatusName == 'VERIFIED' || kycStatusName == 'APPROVED';

    return InkWell(
      onTap: () {
        HapticService.light();
        AppNavigator.push(context, const ProfileDetailScreen());
      },
      borderRadius: BorderRadius.circular(AppRadius.radiusModal),
      child: Container(
        decoration: BoxDecoration(
          color: colors.card,
          borderRadius: BorderRadius.circular(AppRadius.radiusModal),
          border:
              Border.all(color: colors.outlineVariant.withValues(alpha: 0.4)),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.02),
              blurRadius: 10,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 18),
        child: Row(
          children: [
            // Avatar
            Container(
              width: 56,
              height: 56,
              decoration: BoxDecoration(
                color: isVerified ? AppColors.success : AppColors.primary,
                shape: BoxShape.circle,
                border: Border.all(color: colors.card, width: 2),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.08),
                    blurRadius: 12,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              alignment: Alignment.center,
              child: avatarUrl != null
                  ? ClipRRect(
                      borderRadius:
                          BorderRadius.circular(AppRadius.radiusModal),
                      child: CachedNetworkImage(
                        imageUrl: avatarUrl,
                        width: 56,
                        height: 56,
                        fit: BoxFit.cover,
                        memCacheWidth: 112,
                        memCacheHeight: 112,
                        placeholder: (_, __) => const SizedBox(
                          width: 56,
                          height: 56,
                          child: Center(
                              child: CircularProgressIndicator(strokeWidth: 2)),
                        ),
                        errorWidget: (_, __, ___) => const Icon(Icons.person,
                            size: 28, color: Colors.white),
                      ),
                    )
                  : Text(
                      initial,
                      style: AppTypography.headingMedium
                          .copyWith(color: Colors.white),
                    ),
            ),
            const SizedBox(width: 16),
            // Name + KYC pill + Edit Icon
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Flexible(
                        child: Text(
                          rider?.name ?? (l10n?.txtguestRider ?? 'Rider'),
                          style: AppTypography.titleMedium.copyWith(
                            fontWeight: FontWeight.bold,
                            color: colors.onSurface,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      const SizedBox(width: 6),
                      Icon(
                        Icons.edit_outlined,
                        size: 16,
                        color: colors.onSurfaceMuted,
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      Icon(
                        Icons.shield_outlined,
                        size: 12,
                        color: isVerified
                            ? AppColors.success
                            : AppColors.warningDark,
                      ),
                      const SizedBox(width: 4),
                      Text(
                        'KYC: ${kycStatusName == 'SUBMITTED' ? (l10n?.txtunderReview ?? 'Under Review') : _capitalize(kycStatusName.toLowerCase())}',
                        style: AppTypography.bodySmall
                            .copyWith(fontWeight: FontWeight.w600)
                            .copyWith(
                                color: isVerified
                                    ? AppColors.success
                                    : AppColors.warningDark),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            // Phone chip
            if (rider?.phone != null)
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(
                  color: colors.iconBackground,
                  borderRadius: BorderRadius.circular(AppRadius.lg),
                ),
                child: Text(
                  rider?.phone ?? '',
                  style: AppTypography.labelSmall.copyWith(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: colors.onSurfaceMuted,
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  String _capitalize(String text) {
    if (text.isEmpty) return text;
    return text.substring(0, 1).toUpperCase() + text.substring(1).toLowerCase();
  }
}

class _MenuGroupCard extends StatelessWidget {
  final List<Widget> children;

  const _MenuGroupCard({required this.children});

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final dividedChildren = <Widget>[];
    for (int i = 0; i < children.length; i++) {
      dividedChildren.add(children[i]);
      if (i < children.length - 1) {
        dividedChildren.add(
          Divider(
            height: 1,
            thickness: 1,
            indent: 68,
            endIndent: 16,
            color: colors.outlineVariant.withValues(alpha: 0.35),
          ),
        );
      }
    }

    return Container(
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: BorderRadius.circular(AppRadius.radiusModal),
        border: Border.all(
          color: colors.outlineVariant.withValues(alpha: 0.5),
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.02),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(AppRadius.radiusModal),
        child: Column(
          children: dividedChildren,
        ),
      ),
    );
  }
}
