import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:voltium_rider/app/app_state.dart';
import 'package:voltium_rider/main.dart';
import 'package:voltium_rider/models/rider_model.dart';
import 'package:voltium_rider/theme/app_theme.dart';
import 'package:voltium_rider/utils/app_logger.dart';
import 'package:voltium_rider/utils/app_navigator.dart';
import 'package:voltium_rider/widgets/approval_matrix_widget.dart';
import 'package:voltium_rider/widgets/dashboard_plan_card.dart';
import 'package:voltium_rider/widgets/dashboard_referral_card.dart';
import 'package:voltium_rider/widgets/dashboard_wallet_card.dart';
import 'package:voltium_rider/widgets/fade_up_widget.dart';
import 'package:voltium_rider/widgets/pre_dashboard_widgets.dart';
import 'package:voltium_rider/widgets/skeleton_loader.dart';
import 'package:voltium_rider/widgets/top_up_request_sent_card.dart';
import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/features/dashboard/presentation/widgets/pre_dashboard_header.dart';
import 'package:voltium_rider/features/dashboard/presentation/widgets/pre_dashboard_pickup_button.dart';
import 'package:voltium_rider/features/dashboard/presentation/widgets/pre_dashboard_polling_banner.dart';
import 'package:voltium_rider/features/dashboard/presentation/widgets/pre_dashboard_rejection_card.dart';
import 'package:voltium_rider/features/support/presentation/screens/support_center_screen.dart';

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
        ref.watch(walletProvider.select((p) => p.walletMinTopup));
    final rider = ref.watch(riderProvider.select((p) => p.rider));
    final isPollingTimedOut =
        ref.watch(riderProvider.select((p) => p.isPollingTimedOut));
    appDebug('PreDashboardScreen: currentPlan = ${rider?.currentPlan}');

    if (rider == null) {
      return const PreDashboardSkeleton();
    }

    // Redirect to full dashboard (Screen 5) when vehicle is picked up
    if (rider.isPickupDone && !_redirected) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!_redirected) {
          _redirected = true;
          widget.onStepNavigation(AuthState.dashboard);
        }
      });
    } else if (!rider.isPickupDone && _redirected) {
      _redirected = false;
    }

    return Scaffold(
      backgroundColor: colors.surface,
      body: Column(
        children: [
          PreDashboardHeader(onLogoutConfirmed: _onLogoutConfirmed),
          if (isPollingTimedOut)
            PreDashboardPollingBanner(
              onRefresh: () => ref.read(riderProvider).refreshFromApi(),
            ),
          Expanded(
            child: RefreshIndicator(
              onRefresh: () => ref.read(riderProvider).refreshFromApi(),
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
                child: Column(
                  children: [
                    _buildBanner(rider),
                    const SizedBox(height: 16),
                    _buildProfileCard(rider),
                    const SizedBox(height: 16),
                    _buildApprovalMatrix(rider, colors),
                    const SizedBox(height: 16),
                    _buildRejectionCards(rider),
                    _buildPlanCardIfNeeded(rider),
                    _buildStartRegistrationCta(rider),
                    const SizedBox(height: 16),
                    _buildMainContentCard(rider),
                    const SizedBox(height: 16),
                    _buildWalletOrTopupCard(rider, walletMinTopup),
                    const SizedBox(height: 16),
                    _buildReferralCard(rider),
                    const SizedBox(height: 16),
                    _buildSupportCard(),
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

  void _onLogoutConfirmed() {
    ref.read(riderProvider).logout();
    if (mounted) {
      Navigator.pushAndRemoveUntil(
        context,
        MaterialPageRoute(builder: (_) => const AppShell()),
        (route) => false,
      );
    }
  }

  Widget _buildBanner(RiderModel rider) {
    return FadeUpWidget(
      delay: 0,
      child: PreDashboardBanner(
        kycRejected: rider.isKycRejected,
        kycVerified: rider.isKycApproved,
        planDone: rider.isPlanDone,
      ),
    );
  }

  Widget _buildProfileCard(RiderModel rider) {
    return FadeUpWidget(
      delay: 50,
      child: PreDashboardProfileCard(
        rider: rider,
        kycVerified: rider.isKycApproved,
        kycRejected: rider.isKycRejected,
      ),
    );
  }

  Widget _buildApprovalMatrix(RiderModel rider, ThemeColors colors) {
    return FadeUpWidget(
      delay: 100,
      child: Container(
        padding: Spacing.paddingLg,
        decoration: BoxDecoration(
          color: colors.card,
          borderRadius: BorderRadius.circular(AppRadius.radiusModal),
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
    );
  }

  Widget _buildRejectionCards(RiderModel rider) {
    return Column(
      children: [
        if (rider.isKycRejected)
          FadeUpWidget(
            delay: 150,
            child: PreDashboardKycRejectionCard(
              reason: rider.kycRejectionReason,
              onResubmit: () => widget.onStepNavigation(AuthState.userForm),
            ),
          ),
        if (rider.isPlanRejected)
          FadeUpWidget(
            delay: 150,
            child: RejectionCard(
              title: 'Plan Rejected',
              reason: rider.planRejectionReason ??
                  'Your selected plan was rejected.',
              buttonText: 'Reselect Plan',
              onResubmit: () => widget.onStepNavigation(AuthState.choosePlan),
            ),
          ),
        if (rider.isDepositRejected)
          FadeUpWidget(
            delay: 150,
            child: RejectionCard(
              title: 'Deposit Rejected',
              reason: rider.depositRecord?.rejectionReason ??
                  'Your deposit proof was rejected.',
              buttonText: 'Re-upload Proof',
              onResubmit: () => widget.onStepNavigation(AuthState.topUpAmount),
            ),
          ),
      ],
    );
  }

  Widget _buildPlanCardIfNeeded(RiderModel rider) {
    if (!rider.isAwaitingPickup) return const SizedBox.shrink();
    return FadeUpWidget(
      delay: 150,
      child: PlanCard(
        currentPlan: rider.currentPlan,
        planEndDate: rider.planEndDate,
        compact: true,
      ),
    );
  }

  Widget _buildStartRegistrationCta(RiderModel rider) {
    if (!rider.needsRegistrationStart) return const SizedBox.shrink();
    return FadeUpWidget(
      delay: 160,
      child: PreDashboardCtaCard.startRegistration(
        onPressed: () => widget.onStepNavigation(AuthState.intent),
      ),
    );
  }

  Widget _buildMainContentCard(RiderModel rider) {
    if (!rider.isReadyForPickup) return const SizedBox.shrink();
    return FadeUpWidget(
      delay: 150,
      child: PreDashboardPickupButton(
        onPressed: () => widget.onStepNavigation(AuthState.pickupHub),
      ),
    );
  }

  Widget _buildWalletOrTopupCard(RiderModel rider, double walletMinTopup) {
    if (!rider.needsDeposit) return const SizedBox.shrink();
    if (rider.canSubmitDeposit) {
      return FadeUpWidget(
        delay: 250,
        child: WalletCard(
          walletBalance: rider.walletBalance,
          requiredPayment: rider.requiredPaymentAmount(walletMinTopup),
          paymentStreak: rider.paymentStreak,
          currentPlan: rider.currentPlan,
          planEndDate: rider.planEndDate,
          onTopUp: () => widget.onStepNavigation(AuthState.topUpAmount),
          compact: true,
        ),
      );
    }
    if (rider.isDepositPending) {
      return FadeUpWidget(
        delay: 250,
        child: TopUpRequestSentCard(
          rider: rider,
          topUpAmount: rider.requiredPaymentAmount(walletMinTopup).toInt(),
          onResubmit: () => widget.onStepNavigation(AuthState.topUpAmount),
        ),
      );
    }
    return const SizedBox.shrink();
  }

  Widget _buildReferralCard(RiderModel rider) {
    final code = (rider.referralCode?.isNotEmpty ?? false)
        ? rider.referralCode!
        : (rider.riderId.isNotEmpty ? rider.riderId : 'VOLT-RD-88');
    return FadeUpWidget(
      delay: 350,
      child: ReferralCard(referralCode: code),
    );
  }

  Widget _buildSupportCard() {
    return FadeUpWidget(
      delay: 400,
      child: NeedHelpCard(
        onTap: () => AppNavigator.push(
          context,
          const SupportCenterScreen(),
        ),
      ),
    );
  }
}
