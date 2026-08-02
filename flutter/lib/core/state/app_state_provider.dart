// R4.3b — `appStateViewProvider` — Riverpod v3 view of the high-level app
// state, derived from the new `appStateProvider` state machine.
//
// This file is the modern read-side for app state. It exposes a single
// immutable `AppStateView` value object that widgets can `ref.watch` to
// trigger rebuilds when the app's state (machine state + loaded rider)
// changes.
//
// The legacy `AppProvider extends ChangeNotifier` (in `app_provider.dart`)
// still works for any code that uses `Provider.of<AppProvider>(context)`,
// but new code should prefer:
//
//   - `ref.watch(appStateProvider)` for the raw state machine
//   - `ref.watch(appStateViewProvider)` for the derived view (typed
//     accessors like `isReady`, `isOnboarded`, `lifecycleStatus`)
//   - `ref.read(riderProvider)` (post-R4.3c) for the rider snapshot
//
// R4.3c will replace the `riderProvider` source so this view also picks
// up changes to the loaded rider.
//
// Migration plan:
//   R4.3a — AppStateNotifier (already done, in `app_state_notifier.dart`)
//   R4.3b — this file: AppStateView + accessors
//   R4.3c — RiderProvider migration (currently `ChangeNotifier`)
//   R4.3d — feature provider batch migration
//   R4.4 — auth flow returns the new AppState
//   R4.5 — polling scoping
//   R4.6 — go_router + E2E tests

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:voltium_rider/models/rider_model.dart';
import 'package:voltium_rider/core/navigation/app_state.dart';
import 'package:voltium_rider/core/navigation/app_state_notifier.dart';
import 'package:voltium_rider/utils/lifecycle_rank.dart';

/// Immutable snapshot of the app's high-level state, derived from
/// [AppState]. Held by `appStateViewProvider` and read by widgets that
/// prefer typed accessors over raw state.
@immutable
class AppStateView {
  /// The current machine state (Splash / AuthFlow / Active / ...).
  final AppState state;

  /// The rider snapshot, if one has been loaded. May be null during
  /// the splash / auth flow. Populated in R4.3c once `riderProvider`
  /// is migrated; for now it stays null and the legacy
  /// `AppProvider.rider` is still the source of truth.
  final RiderModel? rider;

  const AppStateView({
    required this.state,
    this.rider,
  });

  /// True once a rider has been loaded into the state machine.
  bool get isReady => rider != null;

  /// True once the rider has completed pickup.
  bool get isOnboarded => rider?.pickupDone ?? false;

  /// Same as [isOnboarded] — kept for compatibility with the legacy
  /// `AppProvider` shim.
  bool get isPickupDone => rider?.isPickupDone ?? false;

  /// True once the rider has completed profile submission.
  bool get isRegistrationDone => rider?.registrationDone ?? false;

  /// The rider's lifecycle status (e.g. "ACTIVE", "PICKUP_SCHEDULED").
  String? get lifecycleStatus => rider?.lifecycleStatus;

  /// Whether the rider is currently considered "actually active" —
  /// mirrors the legacy `AppProvider.isActuallyActive` check.
  bool get isActuallyActive {
    final r = rider;
    if (r == null) return false;
    return r.accountStatus == AccountStatus.active ||
        (r.lifecycleStatus.isNotEmpty && lifecycleRank(r) >= 11);
  }

  AppStateView copyWith({AppState? state, RiderModel? rider}) {
    return AppStateView(
      state: state ?? this.state,
      rider: rider ?? this.rider,
    );
  }

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    return other is AppStateView &&
        other.state == state &&
        other.rider == rider;
  }

  @override
  int get hashCode => Object.hash(state, rider);
}

/// `Provider` that exposes the immutable [AppStateView] derived from
/// [appStateProvider]. R4.3c will extend this to also watch the new
/// `riderProvider` so the view picks up rider changes.
final appStateViewProvider = Provider<AppStateView>((ref) {
  final state = ref.watch(appStateProvider);
  return AppStateView(state: state);
});
