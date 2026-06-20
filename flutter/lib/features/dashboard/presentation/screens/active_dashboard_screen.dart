import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'package:voltium_rider/providers/app_provider.dart';
import 'package:voltium_rider/theme/app_theme.dart';
import 'package:voltium_rider/utils/app_navigator.dart';
import 'notification_center_screen.dart';
import 'rental_details_screen.dart';
import 'package:voltium_rider/widgets/skeleton_loader.dart';
import 'package:voltium_rider/widgets/cards.dart';
import 'package:voltium_rider/widgets/dashboard_profile_card.dart';
import 'package:voltium_rider/widgets/dashboard_plan_card.dart';
import 'package:voltium_rider/widgets/dashboard_wallet_card.dart';
import 'package:voltium_rider/widgets/dashboard_referral_card.dart';
import 'package:voltium_rider/widgets/dashboard_tl_card.dart';
import 'package:voltium_rider/widgets/dashboard_scooter_banner.dart';
import 'package:voltium_rider/widgets/dashboard_sheets.dart';

/// Active Dashboard screen for the Voltium Rider App.
///
/// Displays the rider's status, subscription details, assigned vehicle, and referral widget.
class ActiveDashboardScreen extends StatefulWidget {
  const ActiveDashboardScreen({super.key});

  @override
  State<ActiveDashboardScreen> createState() => _ActiveDashboardScreenState();
}

class _ActiveDashboardScreenState extends State<ActiveDashboardScreen> {
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      body: Stack(
        children: [
          Builder(
            builder: (context) {
              final rider = context.select((AppProvider p) => p.rider);
              final dataState = context.select((AppProvider p) => p.dataState);
              final isRefreshing = context.select((AppProvider p) => p.isRefreshing);
              final errorMessage = context.select((AppProvider p) => p.errorMessage);
              final walletMinTopup = context.select((AppProvider p) => p.walletMinTopup);

              final isCache = dataState == DataState.fromCache;

              if (isCache && isRefreshing && rider == null) {
                return const DashboardSkeleton();
              }

              if (rider == null) {
                if (dataState == DataState.error) {
                  return Center(
                    child: Padding(
                      padding: const EdgeInsets.all(24.0),
                      child: GlassCard(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(Icons.error_outline,
                                color: Colors.red, size: 48,),
                            const SizedBox(height: 16),
                            Text(
                              'Unable to connect to command center: $errorMessage',
                              textAlign: TextAlign.center,
                              style: const TextStyle(color: Colors.white70),
                            ),
                            const SizedBox(height: 24),
                            FilledButton(
                              onPressed: () => context.read<AppProvider>().refresh(),
                              style: FilledButton.styleFrom(
                                backgroundColor: AppColors.primary,
                                shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(12),),
                              ),
                              child: Text('Retry'),
                            ),
                          ],
                        ),
                      ),
                    ),
                  );
                }

                if (isRefreshing ||
                    dataState == DataState.initial) {
                  return const DashboardSkeleton();
                }

                return Center(
                  child: GlassCard(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text('No data available',
                            style: const TextStyle(
                                color: Colors.white,
                                fontSize: 18,
                                fontWeight: FontWeight.bold,),),
                        const SizedBox(height: 16),
                        FilledButton.icon(
                          onPressed: () => context.read<AppProvider>().refresh(),
                          icon: const Icon(Icons.refresh),
                          label: const Text('Initialize System'),
                        ),
                      ],
                    ),
                  ),
                );
              }

              return RefreshIndicator(
                color: AppColors.primary,
                backgroundColor: Colors.white,
                onRefresh: () => context.read<AppProvider>().refresh(),
                child: CustomScrollView(
                  physics: const BouncingScrollPhysics(),
                  slivers: [
                    SliverToBoxAdapter(
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(20, 60, 20, 0),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            const Row(
                              children: [
                                Icon(Icons.bolt,
                                    color: AppColors.primary, size: 32,),
                                SizedBox(width: 8),
                                Text('Dashboard',
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
                    SliverToBoxAdapter(
                      child: Padding(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 20, vertical: 24,),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            if (isCache) _buildCacheIndicator(),
                            if (rider.returnPending || rider.intent == 'RETURN')
                              ScooterSubmissionBanner(
                                submissionDate:
                                    rider.submissionDate?.toIso8601String(),
                                pickupHub: rider.pickupHub,
                              ),
                            DashboardProfileCard(
                              rider: rider,
                              onTap: () => AppNavigator.push(
                                  context, const RentalDetailsScreen(),),
                            ),
                            const SizedBox(height: 16),
                            PlanCard(
                              currentPlan: rider.currentPlan,
                              planEndDate: rider.planEndDate,
                            ),
                            const SizedBox(height: 16),
                            WalletCard(
                              walletBalance: rider.walletBalance,
                              requiredPayment: rider.activeRentalPlanPrice > 0
                                  ? rider.activeRentalPlanPrice
                                  : walletMinTopup,
                              paymentStreak: rider.paymentStreak,
                              currentPlan: rider.currentPlan,
                              onTopUp: () {},
                            ),
                            const SizedBox(height: 16),
                            TeamLeaderCard(
                              teamLeaderName: rider.teamLeader,
                              onViewDetails: () =>
                                  showTLDetailsSheet(context, rider),
                            ),
                            const SizedBox(height: 16),
                            ReferralCard(
                              referralCode: rider.referralCode ?? 'VOLT123',
                            ),
                            const SizedBox(height: 120),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              );
            },
          ),
        ],
      ),
    );
  }

  Widget _buildNotificationBell(BuildContext context) {
    return InkWell(
      key: const Key('notificationBell'),
      onTap: () {
        AppNavigator.push(context, const NotificationCenterScreen());
      },
      child: Container(
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.05),
          shape: BoxShape.circle,
          border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
        ),
        child: Stack(
          clipBehavior: Clip.none,
          children: [
            const Icon(Icons.notifications_none_rounded,
                size: 20, color: Colors.white,),
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
}
