import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

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
import 'package:voltium_rider/widgets/ui_animations.dart';
import 'package:google_fonts/google_fonts.dart';

import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/core/state/rider_provider.dart' show DataState;

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
      borderRadius: BorderRadius.circular(22),
      onTap: () {
        AppNavigator.push(context, const NotificationsScreen());
      },
      child: Container(
        width: 44,
        height: 44,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: Colors.black.withValues(alpha: 0.05),
          shape: BoxShape.circle,
          border: Border.all(color: Colors.black.withValues(alpha: 0.1)),
        ),
        child: Stack(
          clipBehavior: Clip.none,
          children: [
            const Icon(
              Icons.notifications_none_rounded,
              size: 20,
              color: AppColors.onSurface,
            ),
            Positioned(
              right: -2,
              top: -2,
              child: Container(
                width: 8,
                height: 8,
                decoration: const BoxDecoration(
                  color: AppColors.error,
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
    final walletMinTopup =
        ref.watch(appProvider.select((p) => p.walletMinTopup));
    final dataState = ref.watch(appProvider.select((p) => p.dataState));
    final isCache = dataState == DataState.fromCache;

    return RefreshIndicator(
      color: AppColors.primary,
      backgroundColor: Colors.white,
      onRefresh: () => ref.read(appProvider).refresh(),
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
              final hour = DateTime.now().hour;
              final firstName = rider.name.split(' ').first;
              final displayName = firstName.isEmpty ? 'Rider' : firstName;
              String greeting = 'Good Evening';
              if (hour < 12)
                greeting = 'Good Morning';
              else if (hour < 17) greeting = 'Good Afternoon';

              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '$greeting,',
                    style: GoogleFonts.plusJakartaSans(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: AppColors.onSurfaceVariant,
                      letterSpacing: 0.5,
                    ),
                  ),
                  Text(
                    displayName,
                    style: GoogleFonts.plusJakartaSans(
                      fontSize: 24,
                      fontWeight: FontWeight.w900,
                      color: AppColors.onSurface,
                      letterSpacing: -0.5,
                    ),
                  ),
                ],
              );
            }),
            actions: [
              Padding(
                padding: const EdgeInsets.only(right: 20),
                child: _buildNotificationBell(context),
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
                  if (isCache) _buildCacheIndicator(),
                  if (rider.returnPending || rider.intent == 'RETURN')
                    FadeSlideEntrance(
                      index: 0,
                      child: ScooterSubmissionBanner(
                        submissionDate: rider.submissionDate?.toIso8601String(),
                        pickupHub: rider.pickupHub,
                      ),
                    ),
                  FadeSlideEntrance(
                    index: 1,
                    child: DashboardProfileCard(
                      rider: rider,
                      onTap: () => AppNavigator.push(
                        context,
                        const RentalDetailsScreen(),
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  FadeSlideEntrance(
                    index: 2,
                    child: PlanCard(
                      currentPlan: rider.currentPlan,
                      planEndDate: rider.planEndDate,
                    ),
                  ),
                  const SizedBox(height: 12),
                  FadeSlideEntrance(
                    index: 3,
                    child: WalletCard(
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
                  ),
                  const SizedBox(height: 12),
                  FadeSlideEntrance(
                    index: 4,
                    child: ReferralCard(
                      referralCode: rider.referralCode ?? 'VOLT123',
                    ),
                  ),
                  const SizedBox(height: 12),
                  FadeSlideEntrance(
                    index: 5,
                    child: TeamLeaderCard(
                      teamLeaderName: rider.teamLeader,
                      onViewDetails: () => showTLDetailsSheet(context, rider),
                      onCall: () async {
                        final phone = (rider.emergencyContact == null ||
                                rider.emergencyContact!.isEmpty)
                            ? '+91 98765 12345'
                            : rider.emergencyContact!;
                        final sanitized =
                            phone.replaceAll(RegExp(r'[^\d+]'), '');
                        final uri = Uri.parse('tel:$sanitized');

                        try {
                          if (!await launchUrl(uri)) {
                            throw Exception('Could not launch dialer');
                          }
                        } catch (e) {
                          if (context.mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(
                                content: Text(
                                    'Could not open the phone dialer. Please try again.'),
                                backgroundColor: Colors.red,
                              ),
                            );
                          }
                        }
                      },
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
