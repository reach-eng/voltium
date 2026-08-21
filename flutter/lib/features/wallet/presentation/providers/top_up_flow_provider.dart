// PR-9 (2026-08-21): top-up flow state.
//
// Before this PR, the in-progress top-up amount was a private `int
// _topUpAmount` on `_AppRouterState` (`lib/app/router.dart:114`). If a
// rider backed out, edited, then re-entered, the previous amount was
// lost (the screen re-defaulted to 2000). Backgrounding the app kept
// it, but a kill-then-resume dropped it. The amount is part of the
// in-flight flow; losing it on backout was a real UX bug.
//
// This provider holds the same single field the router used to, but
// behind a Riverpod Notifier. The router reads it via
// `ref.read(topUpFlowProvider)` and writes via
// `ref.read(topUpFlowProvider.notifier).setAmount(...)`. Resuming the
// flow after a backout is now free.

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

@immutable
class TopUpFlowState {
  /// The amount the rider is mid-way through paying. `2000` is the
  /// historical default the router used; preserved here so the
  /// pre-fill on `TopUpAmountScreen` is unchanged.
  final int amount;

  const TopUpFlowState({this.amount = 2000});

  TopUpFlowState copyWith({int? amount}) =>
      TopUpFlowState(amount: amount ?? this.amount);
}

class TopUpFlowProvider extends Notifier<TopUpFlowState> {
  @override
  TopUpFlowState build() => const TopUpFlowState();

  /// Live-edit the amount while the rider is typing on
  /// `TopUpAmountScreen`. The proof + receipt screens read whatever
  /// the rider last left on the form.
  void setAmount(int amount) {
    if (state.amount == amount) return;
    state = state.copyWith(amount: amount);
  }

  /// Drop the in-flight amount. Called when a top-up submits
  /// successfully (or the rider cancels outright) so a re-entry
  /// starts fresh rather than re-using a stale value.
  void reset() {
    state = const TopUpFlowState();
  }
}

/// Riverpod v3 provider for the top-up flow's in-flight state.
final topUpFlowProvider = NotifierProvider<TopUpFlowProvider, TopUpFlowState>(
  TopUpFlowProvider.new,
);
