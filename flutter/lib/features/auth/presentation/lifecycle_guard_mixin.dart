import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/widgets/lifecycle_route_guard.dart';

export 'package:voltium_rider/widgets/lifecycle_route_guard.dart';

/// Legacy alias / mixin for [LifecycleRouteGuard].
mixin LifecycleGuardMixin<T extends ConsumerStatefulWidget>
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
