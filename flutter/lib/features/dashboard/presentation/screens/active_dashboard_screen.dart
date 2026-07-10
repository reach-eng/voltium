import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:voltium_rider/theme/app_theme.dart';
import 'package:voltium_rider/utils/app_navigator.dart';
import 'package:voltium_rider/features/notifications/presentation/screens/notifications_screen.dart';
import 'package:voltium_rider/features/rentals/presentation/screens/rental_details_screen.dart';
import 'package:voltium_rider/widgets/skeleton_loader.dart';
import 'package:voltium_rider/widgets/cards.dart';
import 'package:voltium_rider/widgets/dashboard_profile_card.dart';
import 'package:voltium_rider/widgets/dashboard_plan_card.dart';
import 'package:voltium_rider/widgets/dashboard_wallet_card.dart';
import 'package:voltium_rider/widgets/dashboard_referral_card.dart';
import 'package:voltium_rider/widgets/dashboard_tl_card.dart';
import 'package:voltium_rider/widgets/dashboard_scooter_banner.dart';
import 'package:voltium_rider/widgets/dashboard_sheets.dart';
import 'package:voltium_rider/models/rider_model.dart';
import 'package:voltium_rider/features/wallet/presentation/screens/top_up_flow.dart';

import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/core/state/rider_provider.dart' show DataState;

/// Active Dashboard screen for the Voltium Rider App.
///
/// Displays the rider's status, subscription details, assigned vehicle, and referral widget.
class ActiveDashboardScreen extends ConsumerStatefulWidget {
  const ActiveDashboardScreen({super.key});

  @override
  ConsumerState<ActiveDashboardScreen> createState() => _ActiveDashboardScreenState();
}

class _ActiveDashboardScreenState extends ConsumerState<ActiveDashboardScreen> {
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
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
    final rider = ref.watch(appProvider.select((p) => p.rider));
    final dataState = ref.watch(appProvider.select((p) => p.dataState));
    final isRefreshing = ref.watch(appProvider.select((p) => p.isRefreshing));
    final errorMessage = ref.watch(appProvider.select((p) => p.errorMessage));

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
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24.0),
        child: GlassCard(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(
                Icons.error_outline,
                color: Colors.red,
                size: 48,
              ),
              const SizedBox(height: 16),
              Text(
                'Unable to connect to command center: $errorMessage',
                textAlign: TextAlign.center,
                style: const TextStyle(color: Colors.white70),
              ),
              const SizedBox(height: 24),
              FilledButton(
                onPressed: () => ref.read(appProvider).refresh(),
                style: FilledButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _DashboardEmptyWidget extends ConsumerWidget {
  const _DashboardEmptyWidget();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Center(
      child: GlassCard(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text(
              'No data available',
              style: TextStyle(
                color: Colors.white,
                fontSize: 18,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 16),
            FilledButton.icon(
              onPressed: () => ref.read(appProvider).refresh(),
              icon: const Icon(Icons.refresh),
              label: const Text('Initialize System'),
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

  Widget _buildNotificationBell(BuildContext context) {
    return InkWell(
      key: const Key('notificationBell'),
      onTap: () {
        AppNavigator.push(context, const NotificationsScreen());
      },
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.2),
          shape: BoxShape.circle,
          border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
        ),
        child: Stack(
          clipBehavior: Clip.none,
          children: [
            const Icon(
              Icons.notifications_none_rounded,
              size: 20,
              color: Color(0xFF1E293B),
            ),
            Positioned(
              right: -2,
              top: -2,
              child: Container(
                width: 8,
                height: 8,
                decoration: const BoxDecoration(
                  color: AppColors.primary,
                  shape: BoxShape.circle,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCacheIndicator() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: Colors.amber.shade50,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: Colors.amber.shade200),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.cloud_off, size: 14, color: Colors.amber.shade700),
          const SizedBox(width: 6),
          Text(
            'Showing cached data',
            style: TextStyle(
              fontSize: 12,
              color: Colors.amber.shade700,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final walletMinTopup = ref.watch(appProvider.select((p) => p.walletMinTopup));
    final dataState = ref.watch(appProvider.select((p) => p.dataState));
    final isCache = dataState == DataState.fromCache;

    return RefreshIndicator(
      color: AppColors.primary,
      backgroundColor: Colors.white,
      onRefresh: () => ref.read(appProvider).refresh(),
      child: CustomScrollView(
        physics: const BouncingScrollPhysics(),
        slivers: [
          SliverSafeArea(
            bottom: false,
            sliver: SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Row(
                      children: [
                        Icon(
                          Icons.bolt,
                          color: AppColors.primary,
                          size: 32,
                        ),
                        SizedBox(width: 8),
                        Text(
                          'Dashboard',
                          style: TextStyle(
                            fontSize: 24,
                            fontWeight: FontWeight.w900,
                            color: Color(0xFF1E293B),
                            letterSpacing: -0.5,
                          ),
                        ),
                      ],
                    ),
                    _buildNotificationBell(context),
                  ],
                ),
              ),
            ),
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
                  if (isCache) _buildCacheIndicator(),
                  if (rider.returnPending || rider.intent == 'RETURN')
                    ScooterSubmissionBanner(
                      submissionDate: rider.submissionDate?.toIso8601String(),
                      pickupHub: rider.pickupHub,
                    ),
                  DashboardProfileCard(
                    rider: rider,
                    onTap: () => AppNavigator.push(
                      context,
                      const RentalDetailsScreen(),
                    ),
                  ),
                  const SizedBox(height: 12),
                  PlanCard(
                    currentPlan: rider.currentPlan,
                    planEndDate: rider.planEndDate,
                  ),
                  const SizedBox(height: 12),
                  WalletCard(
                    walletBalance: rider.walletBalance,
                    requiredPayment: rider.activeRentalPlanPrice > 0
                        ? rider.activeRentalPlanPrice
                        : walletMinTopup,
                    paymentStreak: rider.paymentStreak,
                    currentPlan: rider.currentPlan,
                    planEndDate: rider.planEndDate,
                    onTopUp: () {
                      AppNavigator.push(context, const TopUpFlow());
                    },
                  ),
                  const SizedBox(height: 12),
                  TeamLeaderCard(
                    teamLeaderName: rider.teamLeader,
                    onViewDetails: () => showTLDetailsSheet(context, rider),
                  ),
                  const SizedBox(height: 12),
                  ReferralCard(
                    referralCode: rider.referralCode ?? 'VOLT123',
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
