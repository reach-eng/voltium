/// RiderLifecycleGate — Pure routing logic for rider lifecycle state.
///
/// This is NOT a widget. It is a routing decision helper used by AppRouter.
/// It determines where the user should go based on their lifecycle status.
///
/// AppRouter calls RiderLifecycleGate.redirect() after authentication to
/// route the user to the correct onboarding or dashboard screen.
library;

import 'package:voltium_rider/models/rider_model.dart';
import 'package:voltium_rider/utils/lifecycle_rank.dart';

/// The target route for the rider based on their lifecycle state.
enum LifecycleTarget {
  /// Rider needs to complete registration / intent of use.
  intent,

  /// Rider needs to complete KYC.
  kycForm,

  /// Rider needs to add guarantor.
  guarantorForm,

  /// Rider needs to complete deposit / plan selection.
  preDashboard,

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
    // Account status overrides everything
    if (rider.accountStatus == AccountStatus.terminated ||
        (rider.lifecycleStatus.isNotEmpty && lifecycleRank(rider) >= 14)) {
      return LifecycleTarget.terminated;
    }
    if (rider.accountStatus == AccountStatus.suspended ||
        rider.lifecycleStatus == 'SUSPENDED') {
      return LifecycleTarget.suspended;
    }

    // Fully onboarded — go to dashboard
    if (rider.pickupDone ||
        (rider.lifecycleStatus.isNotEmpty && lifecycleRank(rider) >= 10)) {
      return LifecycleTarget.dashboard;
    }

    // Not registered or no intent — go to intent screen
    if (rider.intent == null ||
        rider.intent!.isEmpty ||
        !(rider.registrationDone ||
            (rider.lifecycleStatus.isNotEmpty && lifecycleRank(rider) >= 2))) {
      return LifecycleTarget.intent;
    }

    // KYC not done — go to KYC form
    if (!(rider.kycDone ||
        (rider.lifecycleStatus.isNotEmpty && lifecycleRank(rider) >= 4))) {
      return LifecycleTarget.kycForm;
    }

    // Guarantor pending — go to guarantor form
    if (rider.guarantorStatus == GuarantorStatus.pending) {
      return LifecycleTarget.guarantorForm;
    }

    // Everything done but no pickup — pre-dashboard
    return LifecycleTarget.preDashboard;
  }

  /// Check if the rider can access the main dashboard.
  static bool canAccessDashboard(RiderModel rider) {
    return redirect(rider) == LifecycleTarget.dashboard;
  }

  /// Check if the rider is still in onboarding flow.
  static bool isOnboarding(RiderModel rider) {
    final target = redirect(rider);
    return target == LifecycleTarget.intent ||
        target == LifecycleTarget.kycForm ||
        target == LifecycleTarget.guarantorForm ||
        target == LifecycleTarget.preDashboard;
  }

}
