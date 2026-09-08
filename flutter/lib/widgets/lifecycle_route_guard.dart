import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/features/auth/presentation/rider_lifecycle_gate.dart';
import 'package:voltium_rider/models/rider_model.dart';
import 'package:voltium_rider/utils/toast.dart';

/// Returns true when [rider] is suspended or terminated according to
/// [RiderLifecycleGate.redirect].
/// Returns false when [rider] is null (loading/unauthenticated states must not pop).
bool isLifecycleBlocked(RiderModel? rider) {
  if (rider == null) return false;
  final target = RiderLifecycleGate.redirect(rider);
  return target == LifecycleTarget.suspended ||
      target == LifecycleTarget.terminated;
}

/// Mixin for [ConsumerState] classes to automatically pop the current route
/// when a rider account becomes suspended or terminated while the screen is open.
mixin LifecycleRouteGuard<T extends ConsumerStatefulWidget>
    on ConsumerState<T> {
  /// Attaches the lifecycle change listener. Call at the start of [build].
  void registerLifecycleGuard() {
    ref.listen(riderProvider, (prev, next) {
      final r = next.rider;
      if (isLifecycleBlocked(r) && mounted && Navigator.canPop(context)) {
        Navigator.pop(context);
      }
    });
  }
}

/// Helper for hub navigation: shows the toast and returns false when the rider is blocked.
Future<bool> guardHubPush(WidgetRef ref, BuildContext context) async {
  final rider = ref.read(riderProvider).rider;
  if (isLifecycleBlocked(rider)) {
    Toast.error(
      context,
      'Account unavailable. Your account is currently suspended or inactive.',
    );
    return false;
  }
  return true;
}
