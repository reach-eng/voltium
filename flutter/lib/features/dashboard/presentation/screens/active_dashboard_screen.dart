import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:voltium_rider/theme/app_theme.dart';
import 'package:voltium_rider/utils/app_navigator.dart';
import 'package:voltium_rider/utils/toast.dart';
import 'package:voltium_rider/features/notifications/presentation/screens/notifications_screen.dart';
import 'package:voltium_rider/widgets/notification_bell.dart';
import 'package:voltium_rider/features/rentals/presentation/screens/rental_details_screen.dart';
import 'package:voltium_rider/widgets/skeleton_loader.dart';
import 'package:voltium_rider/widgets/cards.dart';
import 'package:voltium_rider/features/dashboard/widgets/dashboard_profile_card.dart';
import 'package:voltium_rider/features/dashboard/widgets/dashboard_plan_card.dart';
import 'package:voltium_rider/features/dashboard/widgets/dashboard_wallet_card.dart';
import 'package:voltium_rider/features/dashboard/widgets/dashboard_referral_card.dart';
import '../../../../widgets/error_state.dart';
import 'package:voltium_rider/features/dashboard/widgets/dashboard_tl_card.dart';
import 'package:voltium_rider/features/dashboard/widgets/dashboard_scooter_banner.dart';
import 'package:voltium_rider/features/dashboard/widgets/dashboard_sheets.dart';
import 'package:voltium_rider/models/rider_model.dart';
import 'package:voltium_rider/features/wallet/presentation/screens/top_up_flow.dart';
import 'package:voltium_rider/widgets/ui_animations.dart';
// PR-127: TiltCard is the canonical parallax-tilt widget.
// CardParallaxTilt was a 29-line wrapper that just delegated to
// TiltCard; deleted in PR-127.
import 'package:voltium_rider/widgets/tilt_card.dart';
import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/theme/app_typography.dart';

import 'package:voltium_rider/core/observability/posthog_service.dart';

/// Active Dashboard screen for the Voltium Rider App.
///
/// Displays the rider's status, subscription details, assigned vehicle, and referral widget.
class ActiveDashboardScreen extends ConsumerStatefulWidget {
  const ActiveDashboardScreen({super.key});

  @override
  ConsumerState<ActiveDashboardScreen> createState() =>
      _ActiveDashboardScreenState();
}

class _ActiveDashboardScreenState extends ConsumerState<ActiveDashboardScreen> {
  @override
  void initState() {
    super.initState();
    PostHogService.capture('active_dashboard_viewed');
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(engagementProvider.notifier).initEngagementData();
    });
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Scaffold(
      backgroundColor: colors.surface,
      body: const Stack(
        children: [
          _DashboardStateWidget(),
        ],
      ),
    );
  }
}

class _DashboardStateWidget extends ConsumerWidget {
  const _DashboardStateWidget();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final rider = ref.watch(riderProvider.select((p) => p.rider));
    final dataState = ref.watch(riderProvider.select((p) => p.dataState));
    final isRefreshing = ref.watch(riderProvider.select((p) => p.isRefreshing));
    final errorMessage = ref.watch(riderProvider.select((p) => p.errorMessage));

    final isCache = dataState == DataState.fromCache;

    if (isCache && isRefreshing && rider == null) {
      return const DashboardSkeleton();
    }

    if (rider == null) {
      if (dataState == DataState.error) {
        return _DashboardErrorWidget(errorMessage: errorMessage);
      }
      if (isRefreshing || dataState == DataState.initial) {
        return const DashboardSkeleton();
      }
      return const _DashboardEmptyWidget();
    }

    return _DashboardContentWidget(rider: rider);
  }
}

class _DashboardErrorWidget extends ConsumerWidget {
  final String? errorMessage;
  const _DashboardErrorWidget({this.errorMessage});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ErrorState.network(
      message: errorMessage != null
          ? 'Unable to connect: $errorMessage'
          : 'Unable to connect to command center.',
      onRetry: () => ref.read(riderProvider.notifier).refresh(),
    );
  }
}

class _DashboardEmptyWidget extends ConsumerWidget {
  const _DashboardEmptyWidget();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = AppColors.of(context);
    final l10n = AppLocalizations.of(context);
    return Center(
      child: GlassCard(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              l10n?.txtnoDataAvailable ?? 'No data available',
              style:
                  AppTypography.titleMedium.copyWith(color: colors.onSurface),
            ),
            const SizedBox(height: 16),
            FilledButton.icon(
              onPressed: () => ref.read(riderProvider.notifier).refresh(),
              icon: const Icon(Icons.refresh),
              label: Text(l10n?.txtinitializeSystem ?? 'Initialize System'),
            ),
          ],
        ),
      ),
    );
  }
}

class _DashboardContentWidget extends ConsumerWidget {
  final RiderModel rider;
  const _DashboardContentWidget({required this.rider});

  Widget _buildNotificationBell(BuildContext context, WidgetRef ref) {
    final notifications =
        ref.watch(engagementProvider.select((p) => p.notifications));
    final unreadCount = notifications.where((n) => !n.isRead).length;
    return NotificationBell(
      hasUnread: unreadCount > 0,
      unreadCount: unreadCount,
      onTap: () {
        AppNavigator.push(context, const NotificationsScreen());
      },
    );
  }

  Widget _buildCacheIndicator(BuildContext context) {
    final colors = AppColors.of(context);
    final l10n = AppLocalizations.of(context);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: colors.warningLight,
        borderRadius: BorderRadius.circular(AppRadius.sm),
        border: Border.all(color: AppColors.warningBorder),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.cloud_off, size: 14, color: colors.warningLightForeground),
          const SizedBox(width: 6),
          Text(
            l10n?.txtshowingCachedData ?? 'Showing cached data',
            style: AppTypography.bodySmall
                .copyWith(color: colors.warningLightForeground),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = AppColors.of(context);
    final l10n = AppLocalizations.of(context);
    final walletMinTopup =
        ref.watch(walletProvider.select((p) => p.walletMinTopup));
    final dataState = ref.watch(riderProvider.select((p) => p.dataState));
    final isCache = dataState == DataState.fromCache;

    return RefreshIndicator(
      color: AppColors.primary,
      backgroundColor: colors.card,
      onRefresh: () => ref.read(riderProvider.notifier).refresh(),
      child: CustomScrollView(
        physics: const BouncingScrollPhysics(),
        slivers: [
          SliverAppBar(
            backgroundColor: Colors.transparent,
            surfaceTintColor: Colors.transparent,
            pinned: false,
            elevation: 0,
            automaticallyImplyLeading: false,
            centerTitle: false,
            titleSpacing: 20,
            title: Builder(builder: (context) {
              final headerColors = AppColors.of(context);
              // PR-4 (F-009 — 2026-08-22 deep audit): the previous
              // implementation hardcoded `toUtc().add(Duration(hours:
              // 5, minutes: 30))`, which silently returned the WRONG
              // greeting in three cases:
              //   1. A rider with a non-IST device timezone
              //      (e.g. travelling abroad) saw "Good Morning"
              //      even when it was evening locally.
              //   2. A device whose clock was set to UTC (a common
              //      default for fleet tablets) saw the greeting
              //      permanently offset by 5h30m.
              //   3. Any future DST change in a different market
              //      would silently desync the greeting.
              //
              // `DateTime.now()` is the device's local time — what
              // the user sees on their lock screen. For the 99%
              // Indian rider base this is IST; for the remaining 1%
              // it's the correct local hour.
              final hour = DateTime.now().hour;
              final firstName = rider.name.split(' ').first;
              final fallbackRider = l10n?.txtguestRider ?? 'Rider';
              final displayName = firstName.isEmpty ? fallbackRider : firstName;
              final greeting = hour < 12
                  ? (l10n?.txtgreetingMorning ?? 'Good Morning')
                  : (hour < 17
                      ? (l10n?.txtgreetingAfternoon ?? 'Good Afternoon')
                      : (l10n?.txtgreetingEvening ?? 'Good Evening'));

              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '$greeting,',
                    style: AppTypography.bodyMedium
                        .copyWith(fontWeight: FontWeight.w600)
                        .copyWith(
                            color: headerColors.onSurfaceVariant,
                            letterSpacing: 0.5),
                  ),
                  Text(
                    displayName,
                    style: AppTypography.headingMedium.copyWith(
                        color: headerColors.onSurface, letterSpacing: -0.5),
                  ),
                ],
              );
            }),
            actions: [
              Padding(
                padding: const EdgeInsets.only(right: 20),
                child: _buildNotificationBell(context, ref),
              ),
            ],
          ),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.symmetric(
                horizontal: 20,
                vertical: 24,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (isCache) _buildCacheIndicator(context),
                  if (rider.returnPending || rider.intent == 'RETURN')
                    FadeSlideEntrance(
                      index: 0,
                      child: RepaintBoundary(
                        child: ScooterSubmissionBanner(
                          submissionDate:
                              rider.submissionDate?.toIso8601String(),
                          pickupHub: rider.pickupHub,
                        ),
                      ),
                    ),
                  FadeSlideEntrance(
                    index: 1,
                    child: RepaintBoundary(
                      child: DashboardProfileCard(
                        rider: rider,
                        onTap: () => AppNavigator.push(
                          context,
                          const RentalDetailsScreen(),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  FadeSlideEntrance(
                    index: 2,
                    child: RepaintBoundary(
                      child: PlanCard(
                        currentPlan: rider.currentPlan,
                        currentPlanPrice: rider.currentPlanPrice,
                        securityDeposit:
                            rider.currentPlanSecurityDepositInRupees ??
                                rider.securityDeposit,
                        advanceRentPaid: rider.advanceRentPaid,
                        planStartDate: rider.planStartDate,
                        planEndDate: rider.planEndDate,
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  FadeSlideEntrance(
                    index: 3,
                    child: RepaintBoundary(
                      child: TiltCard(
                        child: WalletCard(
                          walletBalance: rider.walletBalance,
                          requiredPayment:
                              (rider.activeRentalPlanPrice ?? 0) > 0
                                  ? rider.activeRentalPlanPrice!
                                  : walletMinTopup,
                          paymentStreak: rider.paymentStreak,
                          currentPlan: rider.currentPlan,
                          planEndDate: rider.planEndDate,
                          onTopUp: () {
                            AppNavigator.push(context, const TopUpFlow());
                          },
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  FadeSlideEntrance(
                    index: 4,
                    child: RepaintBoundary(
                      child: ReferralCard(
                        referralCode: rider.referralCode ?? '',
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  FadeSlideEntrance(
                    index: 5,
                    child: RepaintBoundary(
                      child: TeamLeaderCard(
                        teamLeaderName: rider.teamLeader,
                        onViewDetails: () => showTLDetailsSheet(context, rider),
                        onCall: () async {
                          // PR-AUDIT-FIX 2026-08-17 (AD-P0-1): dial the assigned Team Leader's phone,
                          // not the rider's private emergency contact.
                          final phone = (rider.teamLeaderPhone == null ||
                                  rider.teamLeaderPhone!.isEmpty)
                              ? ''
                              : rider.teamLeaderPhone!;
                          final sanitized =
                              phone.replaceAll(RegExp(r'[^\d+]'), '');
                          if (sanitized.isEmpty) {
                            if (context.mounted) {
                              Toast.warning(
                                context,
                                l10n?.txtnoContactNumberTl ??
                                    'No contact number available for your Team Leader.',
                              );
                            }
                            return;
                          }
                          final uri = Uri.parse('tel:$sanitized');

                          try {
                            if (!await launchUrl(uri)) {
                              throw Exception('Could not launch dialer');
                            }
                          } catch (e) {
                            if (context.mounted) {
                              Toast.error(
                                context,
                                l10n?.txtcouldNotOpenDialer ??
                                    'Could not open the phone dialer. Please try again.',
                              );
                            }
                          }
                        },
                      ),
                    ),
                  ),
                  SizedBox(height: MediaQuery.of(context).padding.bottom + 80),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
