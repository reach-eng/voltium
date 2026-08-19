/// RiderLifecycleGate — Pure routing logic for rider lifecycle state.
///
/// This is NOT a widget. It is a routing decision helper used by AppRouter.
/// It determines where the user should go based on their lifecycle status.
///
/// AppRouter calls RiderLifecycleGate.redirect() after authentication to
/// route the user to the correct onboarding or dashboard screen.
library;

import 'package:voltium_rider/core/navigation/app_state.dart';
import 'package:voltium_rider/models/rider_model.dart';
import 'package:voltium_rider/utils/lifecycle_rank.dart';

/// The target route for the rider based on their lifecycle state.
///
/// PR-ONBOARDING-FLOW-2026-08-12: the new active onboarding path runs
/// guarantor → plan → deposit → pickup → hangTight → (admin approval) →
/// dashboard. Each rank in 3-9 now maps to a specific step in this
/// linear flow instead of falling through to the older
/// [preDashboard] catch-all. The pre-dashboard screen is preserved
/// for the suspended/terminated case and is reachable from the admin
/// panel if the older flow needs to be brought back.
enum LifecycleTarget {
  /// Rider needs to complete registration / intent of use.
  intent,

  /// Rider needs to fill Guarantor form.
  guarantorForm,

  /// PR-ONBOARDING-FLOW-2026-08-12: active-path step after guarantor.
  /// The rider selects their rental plan. Reached for rank 3-6
  /// (KYC done, guarantor in-flight or approved).
  choosePlan,

  /// PR-ONBOARDING-FLOW-2026-08-13: active-path deposit entry point.
  /// After the rider selects a plan, they land on the Enter Amount
  /// screen which auto-fills the required amount (security deposit +
  /// advance rental when the rider ticked the advance-rent
  /// checkbox). Reached for rank 9 (PLAN_SELECTED) — the deposit
  /// itself does not bump the rank in the new flow; the next rank
  /// change happens at pickup form submission (rank 10).
  topUpAmount,

  /// PR-ONBOARDING-FLOW-2026-08-12: brief confirmation between deposit
  /// and pickup. The rider has paid the deposit and is being routed
  /// forward to the pickup hub. Reached for rank 7-8 (DEPOSIT_PENDING /
  /// DEPOSIT_APPROVED) from the older flow — the rider has paid the
  /// deposit in the old order and the new flow continues to pickup.
  planSuccess,

  /// PR-ONBOARDING-FLOW-2026-08-12: active-path pickup form step 1.
  /// The rider picks a hub + vehicle + team leader + emergency contact
  /// and uploads 5 pickup photos. Reached for the mid-flow case where
  /// a rider needs to re-enter the pickup step (e.g., they were killed
  /// mid-hub-form and the draft is no longer valid).
  pickupHub,

  /// PR-ONBOARDING-FLOW-2026-08-12: active-path pickup form step 2.
  /// The rider reviews the submission and confirms. The server flips
  /// the rider to PICKUP_SCHEDULED (rank 10) on submit.
  pickupVerification,

  /// Older flow entry point — kept for the suspended / archived case
  /// (admin can route a rider here if the older flow needs to be
  /// brought back). NOT used by the active path; the redirect() below
  /// never returns this for a normal rider.
  preDashboard,

  /// PR-ONBOARDING-FLOW-2026-08-11: async wait state in the new active
  /// onboarding path. Returned when a rider is in PICKUP_SCHEDULED (rank
  /// 10) but not yet ACTIVE (rank 11) — they have submitted the pickup
  /// form and are waiting for admin to assign a vehicle and approve.
  /// Replaces the synchronous pre-dashboard wait at the tail of the new
  /// flow.
  hangTight,

  /// Rider is fully onboarded and has picked up vehicle.
  dashboard,

  /// Rider account is suspended.
  suspended,

  /// Rider account is terminated.
  terminated,

  /// Rider data not available — should not happen after auth.
  unknown,
}

/// Pure routing logic — no Flutter dependencies except RiderModel.
class RiderLifecycleGate {
  /// Determine the correct route based on rider lifecycle flags.
  ///
  /// This mirrors the logic in RiderProvider.routeAfterLogin() but is
  /// a pure function that can be tested without Provider/BuildContext.
  static LifecycleTarget redirect(RiderModel rider) {
    // Account status overrides everything. CLOSED (rank 14) is terminal too —
    // a closed rider must never land on the dashboard, even with pickupDone.
    //
    // PR-ONBOARDING-FLOW-2026-08-13: 'TERMINATED' is no longer in the
    // Prisma `RiderLifecycleStatus` enum (it was never returned by the
    // server) and has been removed from the rank table. The
    // `accountStatus == AccountStatus.terminated` check stays as the
    // authoritative terminal-state signal; the lifecycle-status string
    // check is dropped because it was unreachable.
    if (rider.accountStatus == AccountStatus.terminated ||
        rider.lifecycleStatus == 'CLOSED' ||
        (rider.lifecycleStatus.isNotEmpty && lifecycleRank(rider) >= 14)) {
      return LifecycleTarget.terminated;
    }
    if (rider.accountStatus == AccountStatus.suspended ||
        rider.lifecycleStatus == 'SUSPENDED') {
      return LifecycleTarget.suspended;
    }

    final rank = lifecycleRank(rider);

    // Fully onboarded — go to dashboard
    if (rider.pickupDone || (rider.lifecycleStatus.isNotEmpty && rank >= 11)) {
      return LifecycleTarget.dashboard;
    }

    // PR-ONBOARDING-FLOW-2026-08-11: post-pickup, pre-activation wait.
    // Rank 10 (PICKUP_SCHEDULED) with !pickupDone means the rider has
    // submitted the pickup form (active path: pickupVerification onNext
    // → hangTight) and is waiting for admin to assign a vehicle and
    // flip them to ACTIVE. The new flow's tail state.
    if (rider.lifecycleStatus.isNotEmpty && rank >= 10) {
      return LifecycleTarget.hangTight;
    }

    // If rider hasn't submitted profile (rank < 2), they need intent/rider form
    if (rank < 2) {
      return LifecycleTarget.intent;
    }

    // PR-ONBOARDING-FLOW-2026-08-12: rank 2 (PROFILE_SUBMITTED) means the
    // rider finished the user form. Next step in the active path is
    // the guarantor form.
    if (rank == 2) {
      return LifecycleTarget.guarantorForm;
    }

    // PR-ONBOARDING-FLOW-2026-08-12: rank 3-4 (KYC_SUBMITTED /
    // KYC_APPROVED) — KYC is in review or approved. The active path
    // runs KYC review in parallel with the guarantor form, so the
    // rider proceeds to the guarantor form next.
    if (rank <= 4) {
      return LifecycleTarget.guarantorForm;
    }

    // PR-ONBOARDING-FLOW-2026-08-12: rank 5-6 (GUARANTOR_SUBMITTED /
    // GUARANTOR_APPROVED) — guarantor is in-flight or approved. The
    // active path advances to plan selection; the guarantor approval
    // and plan selection are not strictly serialized (the rider can
    // pick a plan while the guarantor is being reviewed).
    if (rank <= 6) {
      return LifecycleTarget.choosePlan;
    }

    // PR-ONBOARDING-FLOW-2026-08-12: rank 7-8 (DEPOSIT_PENDING /
    // DEPOSIT_APPROVED) — from the OLDER flow where deposit preceded
    // plan. The rider has already paid the deposit. The new flow
    // continues with the plan-success confirmation and the pickup
    // hub; the deposit does not need to be re-paid.
    if (rank <= 8) {
      return LifecycleTarget.planSuccess;
    }

    // PR-ONBOARDING-FLOW-2026-08-13: rank 9 (PLAN_SELECTED) — the
    // rider has selected a plan but the deposit has not been recorded
    // yet. In the new flow the deposit entry point is the Enter
    // Amount screen (topUpAmount), which auto-fills the required
    // amount from the plan + advance-rent flag. The deposit itself
    // does not bump the rank; the next rank change happens at pickup
    // form submission (rank 10).
    //
    // PR-AUDIT 2026-08-12 (H3): check `rider.isDepositDone` first.
    // If the rider already paid the deposit but the server hasn't yet
    // bumped the rank to DEPOSIT_PENDING (e.g., the API response was
    // in-flight, the rank bump was queued, the rider killed the app
    // mid-flight), routing to `topUpAmount` lets them re-submit a
    // duplicate SECURITY_DEPOSIT transaction. Skip to `pickupHub` in
    // that case — the deposit record exists, the rider should move on
    // to the next step.
    if (rank == 9) {
      if (rider.isDepositDone) {
        return LifecycleTarget.pickupHub;
      }
      return LifecycleTarget.topUpAmount;
    }

    // PR-ONBOARDING-FLOW-2026-08-12: every rank in 3-9 now has an
    // explicit active-path mapping above. If we reach this point the
    // rank is somehow outside 0-9 (which the lifecycle_rank enum does
    // not allow), or the rank helper is returning a stale value.
    // Default to guarantorForm as the safest mid-flow fallback — it
    // re-enters the active path without bouncing the rider to the
    // older pre-dashboard surface.
    return LifecycleTarget.guarantorForm;
  }

  /// Return explicit modern sealed [AppState] derived from rider lifecycle.
  static AppState redirectAppState(RiderModel rider) {
    final target = redirect(rider);
    switch (target) {
      case LifecycleTarget.terminated:
        return const AccountClosed();
      case LifecycleTarget.suspended:
      case LifecycleTarget.preDashboard:
        // PR-ONBOARDING-FLOW-2026-08-12: the active path no longer
        // routes to preDashboard. The mapping is preserved for the
        // suspended/legacy case so the older flow remains reachable
        // from admin tooling.
        return const PreDashboard();
      case LifecycleTarget.hangTight:
        return const HangTight();
      case LifecycleTarget.dashboard:
        return const ActiveDashboard();
      case LifecycleTarget.guarantorForm:
        return const Onboarding(OnboardingStep.guarantor);
      // PR-ONBOARDING-FLOW-2026-08-12: new active-path steps map to
      // the closest OnboardingStep in the modern sealed-class state.
      // The router reads these to drive the AppState polling policy.
      case LifecycleTarget.choosePlan:
      case LifecycleTarget.topUpAmount:
        return const Onboarding(OnboardingStep.planSelect);
      case LifecycleTarget.planSuccess:
      case LifecycleTarget.pickupHub:
      case LifecycleTarget.pickupVerification:
        return const Onboarding(OnboardingStep.deposit);
      case LifecycleTarget.intent:
        return const Onboarding(OnboardingStep.kycSubmit);
      case LifecycleTarget.unknown:
        return const AuthFlow(AuthStep.phoneEntry);
    }
  }

  /// Check if the rider can access the main dashboard.
  static bool canAccessDashboard(RiderModel rider) {
    return redirect(rider) == LifecycleTarget.dashboard;
  }

  /// Check if the rider is still in onboarding flow.
  static bool isOnboarding(RiderModel rider) {
    final target = redirect(rider);
    return target == LifecycleTarget.intent ||
        target == LifecycleTarget.guarantorForm ||
        target == LifecycleTarget.choosePlan ||
        target == LifecycleTarget.topUpAmount ||
        target == LifecycleTarget.planSuccess ||
        target == LifecycleTarget.pickupHub ||
        target == LifecycleTarget.pickupVerification ||
        target == LifecycleTarget.preDashboard ||
        target == LifecycleTarget.hangTight;
  }
}
