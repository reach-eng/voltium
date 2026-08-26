// FocusObserver (Phase 3.2)
//
// Triggers an immediate data refresh on the dashboard / wallet /
// support screens when the user navigates to them. Combined with
// the lifecycle-aware PollingManager (Phase 3.1), this gives the
// rider an effective "always-fresh on focus, slower when idle"
// experience without any WebSocket infra.
//
// The observer is intentionally thin: it just notifies the
// currently-focused screen via a callback. Each screen subscribes
// in initState and unsubscribes in dispose.

import 'package:flutter/widgets.dart';

class FocusObserver extends NavigatorObserver {
  FocusObserver(this._onFocus);

  final void Function(Route<dynamic> route) _onFocus;

  @override
  void didPush(Route<dynamic> route, Route<dynamic>? previousRoute) {
    super.didPush(route, previousRoute);
    _onFocus(route);
  }

  @override
  void didPop(Route<dynamic> route, Route<dynamic>? previousRoute) {
    super.didPop(route, previousRoute);
    if (previousRoute != null) _onFocus(previousRoute);
  }

  @override
  void didReplace({Route<dynamic>? newRoute, Route<dynamic>? oldRoute}) {
    super.didReplace(newRoute: newRoute, oldRoute: oldRoute);
    if (newRoute != null) _onFocus(newRoute);
  }
}
