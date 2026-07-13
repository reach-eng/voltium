import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:voltium_rider/models/rider_model.dart';
import 'package:voltium_rider/app/app_state.dart';
import 'package:voltium_rider/utils/app_navigator.dart';
import 'package:voltium_rider/main.dart';
import 'package:voltium_rider/widgets/dialogs.dart';
import 'package:voltium_rider/utils/lifecycle_rank.dart';
import 'package:voltium_rider/widgets/approval_matrix_widget.dart';
import 'package:voltium_rider/widgets/fade_up_widget.dart';
import 'package:voltium_rider/widgets/skeleton_loader.dart';
import 'package:voltium_rider/widgets/dashboard_wallet_card.dart';
import 'package:voltium_rider/widgets/dashboard_referral_card.dart';
import 'package:voltium_rider/widgets/dashboard_plan_card.dart';
import 'package:voltium_rider/widgets/pre_dashboard_widgets.dart';
import 'package:voltium_rider/widgets/top_up_request_sent_card.dart';
import 'package:voltium_rider/features/notifications/presentation/screens/notifications_screen.dart';
import 'package:voltium_rider/features/support/presentation/screens/support_center_screen.dart';
import '../../../../theme/app_theme.dart';

import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/core/state/app_provider.dart';
import 'package:voltium_rider/theme/app_typography.dart';

class PreDashboardScreen extends ConsumerStatefulWidget {
  final Function(AuthState) onStepNavigation;

  const PreDashboardScreen({super.key, required this.onStepNavigation});

  @override
  ConsumerState<PreDashboardScreen> createState() => _PreDashboardScreenState();
}

class _PreDashboardScreenState extends ConsumerState<PreDashboardScreen> {
  bool _redirected = false;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final walletMinTopup =
        ref.watch(appProvider.select((p) => p.walletMinTopup));
    final rider = ref.watch(riderProvider.select((p) => p.rider));
    debugPrint('PreDashboardScreen: currentPlan = ${rider?.currentPlan}');

    if (rider == null) {
      return const PreDashboardSkeleton();
    }

    final registrationDone = rider.registrationDone ||
        (rider.lifecycleStatus.isNotEmpty && lifecycleRank(rider) >= 3);
    final planDone = rider.planDone ||
        (rider.currentPlan?.isNotEmpty ?? false) ||
        (rider.lifecycleStatus.isNotEmpty && lifecycleRank(rider) >= 4);
    final depositDone = rider.depositDone ||
        (rider.lifecycleStatus.isNotEmpty && lifecycleRank(rider) >= 6);
    final kycApproved = rider.kycDone ||
        (rider.lifecycleStatus.isNotEmpty && lifecycleRank(rider) >= 8);
    final pickupDone = rider.pickupDone ||
        (rider.assignedVehicle?.isNotEmpty ?? false) ||
        (rider.lifecycleStatus.isNotEmpty && lifecycleRank(rider) >= 9);

    final kycRejected = rider.kycStatus == KycStatus.rejected;
    final kycSubmitted = rider.kycStatus == KycStatus.submitted;

    // Redirect to full dashboard (Screen 5) when vehicle is picked up
    if (pickupDone && !_redirected) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!_redirected) {
          _redirected = true;
          widget.onStepNavigation(AuthState.dashboard);
        }
      });
    }

    return Scaffold(
      backgroundColor: colors.surfaceBright,
      body: Column(
        children: [
          // Header
          _buildHeader(rider),
          // Main Content
          Expanded(
            child: RefreshIndicator(
              onRefresh: () => ref.read(appProvider).refreshFromApi(),
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
                child: Column(
                  children: [
                    // State Banner
                    FadeUpWidget(
                      delay: 0,
                      child: PreDashboardBanner(
                        kycRejected: kycRejected,
                        kycVerified: kycApproved,
                        planDone: planDone,
                      ),
                    ),
                    const SizedBox(height: 16),

                    // Profile Card
                    FadeUpWidget(
                      delay: 50,
                      child: PreDashboardProfileCard(
                        rider: rider,
                        kycVerified: kycApproved,
                        kycRejected: kycRejected,
                      ),
                    ),
                    const SizedBox(height: 16),

                    // Approval Matrix
                    FadeUpWidget(
                      delay: 100,
                      child: Container(
                        padding: const EdgeInsets.all(24),
                        decoration: BoxDecoration(
                          color: colors.card,
                          borderRadius: BorderRadius.circular(28),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withValues(alpha: 0.03),
                              blurRadius: 20,
                              offset: const Offset(0, 4),
                            ),
                          ],
                        ),
                        child: ApprovalMatrixWidget(rider: rider),
                      ),
                    ),
                    const SizedBox(height: 16),

                    // KYC Rejection Remarks (State 3)
                    if (kycRejected)
                      FadeUpWidget(
                        delay: 150,
                        child: RejectionCard(
                          title: 'KYC Rejected',
                          reason: rider.kycRejectionReason ??
                              'The uploaded document was unreadable.',
                          buttonText: 'Update Documents',
                          onResubmit: () =>
                              widget.onStepNavigation(AuthState.userForm),
                        ),
                      ),

                    if (rider.planStatus == 'REJECTED')
                      FadeUpWidget(
                        delay: 150,
                        child: RejectionCard(
                          title: 'Plan Rejected',
                          reason: rider.planRejectionReason ??
                              'Your selected plan was rejected.',
                          buttonText: 'Reselect Plan',
                          onResubmit: () =>
                              widget.onStepNavigation(AuthState.choosePlan),
                        ),
                      ),

                    if (rider.depositRecord?.status == DepositStatus.rejected)
                      FadeUpWidget(
                        delay: 150,
                        child: RejectionCard(
                          title: 'Deposit Rejected',
                          reason: rider.depositRecord?.rejectionReason ??
                              'Your deposit proof was rejected.',
                          buttonText: 'Re-upload Proof',
                          onResubmit: () =>
                              widget.onStepNavigation(AuthState.topUpAmount),
                        ),
                      ),

                    if (planDone && !pickupDone)
                      FadeUpWidget(
                        delay: 150,
                        child: PlanCard(
                          currentPlan: rider.currentPlan,
                          planEndDate: rider.planEndDate,
                          compact: true,
                        ),
                      ),

                    // CTA Card (State 2 - Registration done, plan pending)
                    if (registrationDone && !planDone)
                      FadeUpWidget(
                        delay: 150,
                        child: PreDashboardCtaCard.bookVehicle(
                          onPressed: () =>
                              widget.onStepNavigation(AuthState.choosePlan),
                        ),
                      ),

                    // Start Registration CTA (State 1 - initial, no registration started)
                    if (!registrationDone && !kycRejected && !kycSubmitted)
                      FadeUpWidget(
                        delay: 160,
                        child: PreDashboardCtaCard.startRegistration(
                          onPressed: () =>
                              widget.onStepNavigation(AuthState.intent),
                        ),
                      ),

                    const SizedBox(height: 16),

                    // Dynamic Main Content Card based on approval step
                    FadeUpWidget(
                      delay: 150,
                      child: _buildMainContentCard(
                        context,
                        rider,
                        depositDone,
                        registrationDone,
                        kycApproved,
                        kycRejected,
                        kycSubmitted,
                        planDone,
                        pickupDone,
                        ref.read(appProvider),
                      ),
                    ),
                    const SizedBox(height: 16),

                    // Wallet / TopUp Status Card (Appears after plan selected until deposit approved)
                    if (planDone && !depositDone)
                      if (rider.depositRecord == null ||
                          rider.depositRecord!.status ==
                              DepositStatus.notSubmitted)
                        FadeUpWidget(
                          delay: 250,
                          child: WalletCard(
                            walletBalance: rider.walletBalance,
                            requiredPayment: (rider.activeRentalPlanPrice > 0
                                    ? rider.activeRentalPlanPrice
                                    : walletMinTopup) +
                                (rider.activeRentalPlanSecurityDeposit),
                            paymentStreak: rider.paymentStreak,
                            currentPlan: rider.currentPlan,
                            planEndDate: rider.planEndDate,
                            onTopUp: () =>
                                widget.onStepNavigation(AuthState.topUpAmount),
                            compact: true,
                          ),
                        )
                      else if (rider.depositRecord!.status ==
                              DepositStatus.pending ||
                          rider.depositRecord!.status ==
                              DepositStatus.pendingVerification ||
                          rider.depositRecord!.status == DepositStatus.rejected)
                        FadeUpWidget(
                          delay: 250,
                          child: TopUpRequestSentCard(
                            rider: rider,
                            topUpAmount: ((rider.activeRentalPlanPrice > 0
                                        ? rider.activeRentalPlanPrice
                                        : walletMinTopup) +
                                    rider.activeRentalPlanSecurityDeposit)
                                .toInt(),
                            onResubmit: () =>
                                widget.onStepNavigation(AuthState.topUpAmount),
                          ),
                        ),
                    const SizedBox(height: 16),

                    // Referral Card
                    FadeUpWidget(
                      delay: 350,
                      child: ReferralCard(
                        referralCode: (rider.referralCode?.isNotEmpty ?? false)
                            ? rider.referralCode!
                            : (rider.riderId.isNotEmpty
                                ? rider.riderId
                                : 'VOLT-RD-88'),
                      ),
                    ),
                    const SizedBox(height: 16),

                    // Need Help? Support Link
                    FadeUpWidget(
                      delay: 400,
                      child: NeedHelpCard(
                        onTap: () => AppNavigator.push(
                          context,
                          const SupportCenterScreen(),
                        ),
                      ),
                    ),
                    const SizedBox(height: 32),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildHeader(RiderModel rider) {
    final colors = AppColors.of(context);
    return SafeArea(
        bottom: false,
        child: Container(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 14),
          decoration: BoxDecoration(
            color: colors.card,
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Container(
                    width: 32,
                    height: 32,
                    decoration: BoxDecoration(
                      color: AppColors.primary,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child:
                        const Icon(Icons.bolt, color: Colors.white, size: 18),
                  ),
                  SizedBox(width: 10),
                  Text(
                    'Dashboard',
                    style: AppTypography.titleLarge
                        .copyWith(color: colors.onSurface),
                  ),
                ],
              ),
              Row(
                children: [
                  IconButton(
                    key: const Key('preDashboardLogoutButton'),
                    icon: const Icon(
                      Icons.logout,
                      color: AppColors.error,
                      size: 22,
                    ),
                    onPressed: () async {
                      if (!mounted) return;
                      final confirmed = await showLogoutConfirmation(context);
                      if (confirmed == true) {
                        await ref.read(appProvider).logout();
                        if (mounted) {
                          Navigator.pushAndRemoveUntil(
                            context,
                            MaterialPageRoute(builder: (_) => const AppShell()),
                            (route) => false,
                          );
                        }
                      }
                    },
                  ),
                  IconButton(
                    icon: Icon(
                      Icons.notifications_outlined,
                      color: colors.onSurfaceVariant,
                      size: 22,
                    ),
                    onPressed: () => AppNavigator.push(
                      context,
                      const NotificationsScreen(),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ));
  }

  Widget _buildRejectionCard(BuildContext context, RiderModel rider) {
    final colors = AppColors.of(context);
    // Custom dashed border painter could be used, but for simplicity we'll use a container
    // wrapped in a CustomPaint or just standard border. To match dashed border exactly,
    // we would need a package like dotted_border. Since we don't have it, we'll use a solid
    // colored border that closely resembles the design, or implement a simple dashed border painter.
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: AppColors.errorRose, // Light pink background
        borderRadius: BorderRadius.circular(28),
        border: Border.all(
          color: AppColors.errorBorder,
          width: 1.5,
        ), // Pink/Red border
      ),
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: AppColors.errorRose,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(
                    Icons.error_outline,
                    color: AppColors.error,
                    size: 24,
                  ),
                ),
                SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Rejection Remarks',
                        style: AppTypography.titleLarge
                            .copyWith(color: colors.onSurface),
                      ),
                      SizedBox(height: 8),
                      Text(
                        rider.kycRejectionReason != null &&
                                rider.kycRejectionReason!.isNotEmpty
                            ? rider.kycRejectionReason!
                            : 'The uploaded PAN card document was blurry and unreadable. Please ensure all details are clearly visible in the new upload.',
                        style: AppTypography.bodyLarge.copyWith(
                            color: colors.onSurfaceVariant, height: 1.4),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () => widget.onStepNavigation(AuthState.userForm),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.error,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16),
                  ),
                  elevation: 0,
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.upload_file, size: 20),
                    SizedBox(width: 8),
                    Text(
                      'Re-upload Documents',
                      style: AppTypography.titleSmall,
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPickupButton(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      child: ElevatedButton(
        onPressed: () => widget.onStepNavigation(AuthState.pickupHub),
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.primary,
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(vertical: 18),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(28),
          ),
          elevation: 8,
          shadowColor: AppColors.primary.withValues(alpha: 0.4),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.local_shipping, size: 22),
            SizedBox(width: 12),
            Text(
              'PICKUP YOUR VEHICLE',
              style: AppTypography.buttonMedium.copyWith(letterSpacing: 1.2),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMainContentCard(
    BuildContext context,
    RiderModel rider,
    bool depositDone,
    bool registrationDone,
    bool kycApproved,
    bool kycRejected,
    bool kycSubmitted,
    bool planDone,
    bool pickupDone,
    AppProvider provider,
  ) {
    // Screen 4: KYC Rejection
    if (kycRejected) {
      return _buildRejectionCard(context, rider);
    }

    // Screen 5: Pickup Vehicle CTA (when deposit & KYC are done)
    if (depositDone && kycApproved && !pickupDone) {
      return _buildPickupButton(context);
    }

    // Screen 1: No special card needed - return empty container
    return const SizedBox.shrink();
  }
}
