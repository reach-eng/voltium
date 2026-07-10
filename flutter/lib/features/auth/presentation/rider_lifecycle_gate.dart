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

import 'package:voltium_rider/core/state/riverpod_providers.dart';
/// The target route for the rider based on their lifecycle state.
enum LifecycleTarget {
  /// Rider needs to complete registration / intent of use.
  intent,

  /// Rider needs to fill Guarantor form.
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
        (rider.lifecycleStatus.isNotEmpty && lifecycleRank(rider) >= 13)) {
      return LifecycleTarget.terminated;
    }
    if (rider.accountStatus == AccountStatus.suspended ||
        rider.lifecycleStatus == 'SUSPENDED') {
      return LifecycleTarget.suspended;
    }

    final rank = lifecycleRank(rider);

    // If rider only submitted profile (rank 2), they need guarantor form
    if (rank == 2) {
      return LifecycleTarget.guarantorForm;
    }

    // Fully onboarded — go to dashboard
    if (rider.pickupDone || (rider.lifecycleStatus.isNotEmpty && rank >= 10)) {
      return LifecycleTarget.dashboard;
    }

    // If rider hasn't submitted profile (rank < 2), they need intent/rider form
    if (rank < 2) {
      return LifecycleTarget.intent;
    }

    // Everyone else goes to pre-dashboard (entry point)
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
        target == LifecycleTarget.guarantorForm ||
        target == LifecycleTarget.preDashboard;
  }
}
