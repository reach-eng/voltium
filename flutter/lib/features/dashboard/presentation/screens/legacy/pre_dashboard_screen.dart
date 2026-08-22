// PR-ONBOARDING-FLOW-2026-08-12: archived older flow. The pre-dashboard
// surface was the synchronous wait state in the old active path
// (KYC + deposit + plan approval all happened in one screen with an
// approval matrix). The new active path runs
// guarantor → plan → deposit → pickup → hangTight → (admin approval) →
// dashboard, and the pre-dashboard is no longer reached from the
// active path. This file is preserved in `legacy/` in case the older
// flow needs to be brought back (e.g., for a rider whose server state
// was created under the old lifecycle ordering). The screen is still
// routed to from the `LifecycleTarget.suspended` case and from admin
// tooling, but never from the rider's normal onboarding journey.

import 'package:flutter/foundation.dart' show kDebugMode;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:voltium_rider/app/app_state.dart';
import 'package:voltium_rider/models/rider_model.dart';
import 'package:voltium_rider/theme/app_theme.dart';
import 'package:voltium_rider/utils/app_logger.dart';
import 'package:voltium_rider/utils/app_navigator.dart';
import 'package:voltium_rider/widgets/approval_matrix_widget.dart';
import 'package:voltium_rider/features/dashboard/widgets/dashboard_plan_card.dart';
import 'package:voltium_rider/features/dashboard/widgets/dashboard_referral_card.dart';
import 'package:voltium_rider/features/dashboard/widgets/dashboard_wallet_card.dart';
import 'package:voltium_rider/widgets/fade_up_widget.dart';
import 'package:voltium_rider/features/auth/widgets/pre_dashboard_widgets.dart';
import 'package:voltium_rider/widgets/skeleton_loader.dart';
import 'package:voltium_rider/features/wallet/widgets/top_up_request_sent_card.dart';
import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/features/dashboard/presentation/widgets/legacy/pre_dashboard_header.dart';
import 'package:voltium_rider/features/dashboard/presentation/widgets/legacy/pre_dashboard_pickup_button.dart';
import 'package:voltium_rider/features/dashboard/presentation/widgets/legacy/pre_dashboard_polling_banner.dart';
import 'package:voltium_rider/features/dashboard/presentation/widgets/legacy/pre_dashboard_rejection_card.dart';
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
    // AUDIT FIX: gate behind kDebugMode so the 6-field string
    // interpolation is not eagerly evaluated on every rebuild in
    // release/profile builds.
    if (kDebugMode) {
      appDebug(
          'PreDashboardScreen: currentPlan = ${rider?.currentPlan}, isKycApproved = ${rider?.isKycApproved}, kycStatus = ${rider?.kycStatus}, isPlanDone = ${rider?.isPlanDone}, needsPlanSelection = ${rider?.needsPlanSelection}, isRegistrationDone = ${rider?.isRegistrationDone}');
    }

    if (rider == null) {
      return const PreDashboardSkeleton();
    }

    // PR-AUDIT 2026-08-12 (H2): use the raw `pickupDone` boolean,
    // not the derived `isPickupDone` getter. The getter is true for
    // any rider with `lifecycleRank >= 11` (i.e. ACTIVE) OR an
    // assigned vehicle — which means a suspended rider with a stale
    // `assignedVehicle` string would auto-redirect past the suspension
    // banner. The raw flag is the only authoritative signal that the
    // server has actually flipped the rider to ACTIVE.
    if (rider.pickupDone && !_redirected) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        // AUDIT FIX: mounted check — the widget can be unmounted between
        // the frame scheduling and the callback running.
        if (!mounted || _redirected) return;
        _redirected = true;
        widget.onStepNavigation(AuthState.dashboard);
      });
    } else if (!rider.pickupDone && _redirected) {
      _redirected = false;
    }

    return Scaffold(
      backgroundColor: colors.surface,
      body: Column(
        children: [
          PreDashboardHeader(onLogoutConfirmed: _onLogoutConfirmed),
          if (isPollingTimedOut)
            PreDashboardPollingBanner(
              onRefresh: () =>
                  ref.read(riderProvider.notifier).refreshFromApi(),
            ),
          Expanded(
            child: RefreshIndicator(
              onRefresh: () =>
                  ref.read(riderProvider.notifier).refreshFromApi(),
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
                child: Column(
                  children: [
                    _buildBanner(rider),
                    const SizedBox(height: 16),
                    _buildProfileCard(rider),
                    const SizedBox(height: 16),
                    _buildRejectionCards(rider),
                    _buildPlanCardIfNeeded(rider),
                    const SizedBox(height: 16),
                    _buildApprovalMatrix(rider, colors),
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
    ref.read(riderProvider.notifier).logout();
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
        child: ApprovalMatrixWidget(
          rider: rider,
          onStepTap: (label) {
            switch (label) {
              case 'Registration':
              case 'KYC':
                widget.onStepNavigation(AuthState.userForm);
                break;
              case 'Rental Plan':
                widget.onStepNavigation(AuthState.choosePlan);
                break;
              case 'Deposit':
                widget.onStepNavigation(AuthState.topUpAmount);
                break;
              case 'Pickup':
                widget.onStepNavigation(AuthState.pickupHub);
                break;
            }
          },
        ),
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
    final hasPlan = rider.isPlanDone ||
        (rider.currentPlan != null &&
            rider.currentPlan!.trim().isNotEmpty &&
            rider.currentPlan != 'N/A');

    if (hasPlan) {
      if (rider.currentPlan != null &&
          rider.currentPlan!.trim().isNotEmpty &&
          rider.currentPlan != 'N/A') {
        return PlanCard(
          currentPlan: rider.currentPlan,
          planEndDate: rider.planEndDate,
          compact: true,
        );
      }
      return const SizedBox.shrink();
    }

    return PreDashboardCtaCard.bookVehicle(
      onPressed: () => widget.onStepNavigation(AuthState.choosePlan),
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
    // AUDIT FIX: never fabricate a referral code. The previous
    // hardcoded 'VOLT-RD-88' fallback showed riders a code that the
    // backend does not recognise. When neither a real referral code
    // nor a rider id exists, hide the card entirely.
    final code = (rider.referralCode?.isNotEmpty ?? false)
        ? rider.referralCode!
        : (rider.riderId.isNotEmpty ? rider.riderId : null);
    if (code == null) return const SizedBox.shrink();
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
