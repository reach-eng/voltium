// DEEP-AUDIT D-P0-3 (2026-08-08): the original RiderNotifier owned logout as
// just one of its 6+ responsibilities (state, polling, lifecycle, FCM, device
// sync, logout). Cross-account leak guards in logout already required it to
// read 5+ other notifiers, so logout was a coordinator in disguise. This file
// extracts that coordinator to its own notifier so:
//   1. The cross-account leak guards are testable in isolation.
//   2. Future changes to the logout flow (e.g. queueing refresh-token
//      invalidation for retry, D-P1-6) don't have to touch the main
//      RiderNotifier.
//   3. The next split (polling / device-sync into their own notifiers) can
//      proceed without re-litigating the logout edge cases.

import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:voltium_rider/services/cache_service.dart';
import 'package:voltium_rider/utils/app_logger.dart';
import 'package:voltium_rider/services/document_local_cache.dart';
// D-P2-11: the pickup-draft cache key constant lives in rider_provider.dart
// (single source of truth for router + orchestrator + main notifier). This
// creates an import cycle (rider_provider imports this orchestrator), which
// Dart tolerates; the `show` limits the surface to the constant only.
import 'package:voltium_rider/core/state/rider_provider.dart'
    show kPickupDraftCacheKey;

import 'package:voltium_rider/features/dashboard/presentation/providers/engagement_provider.dart';
import 'package:voltium_rider/features/support/presentation/providers/support_provider.dart';
import 'package:voltium_rider/features/support/presentation/providers/ticket_provider.dart';
import 'package:voltium_rider/features/kyc/presentation/screens/user_onboarding_screen.dart'
    show userOnboardingNotifierProvider;
import 'package:voltium_rider/features/guarantor/presentation/screens/guarantor_onboarding_screen.dart'
    show guarantorOnboardingNotifierProvider;
// AUDIT FIX (HIGH SECURITY): the guarantor draft now lives in encrypted
// storage (GuarantorCache); logout must clear it alongside the notifier
// reset or the next rider on a shared device can resume the previous
// rider's guarantor PII.
import 'package:voltium_rider/features/guarantor/data/guarantor_cache.dart';

import 'package:voltium_rider/core/state/riverpod_providers.dart'
    show authRepositoryProvider;

/// Riverpod notifier that orchestrates the rider logout flow.
///
/// Cross-account leak guards are critical on shared devices: a rider who
/// walks away from the app without logging out must not leave their tickets,
/// guarantor form state, or device sync timers running for the next rider.
/// Each guard runs in a deterministic order:
///
///   1. Capture the feature notifiers BEFORE the async gap (ref.read after
///      an await can throw "Ref used after dispose" — Riverpod v3).
///   2. Hit the real logout endpoint (server-side refresh-token
///      invalidation + audit row). Best-effort — local cleanup must still
///      happen if the network call fails.
///   3. Reset every per-rider state holder (engagement, onboarding,
///      support, tickets, guarantor).
///   4. Wipe the in-progress pickup draft so a fresh login on a shared
///      device doesn't resume the previous rider's half-completed pickup.
///   5. Clear the persisted guarantor draft (encrypted storage) — AUDIT
///      FIX: previously only the in-memory notifier was reset, leaving
///      the rider's guarantor PII draft on disk for the next user.
///   6. Clear document cache and stop all background sync.
///
/// This notifier has no state of its own — it is a coordinator. The actual
/// state reset is delegated to the per-feature notifiers via their
/// `logout()` / `reset()` methods.
class RiderLogoutOrchestrator {
  /// Capture the feature notifiers BEFORE the await so a Riverpod dispose
  /// mid-logout can't abort the reset partway through (cross-account leak
  /// vector).
  final Ref _ref;

  /// Optional callback to stop polling + device sync. Wired by the main
  /// RiderNotifier on construction; the orchestrator doesn't own these
  /// timers but it MUST trigger their cleanup during logout.
  final void Function() _onStopPolling;
  final void Function() _onStopDeviceDataSync;
  final void Function() _onResetRefreshInFlight;
  final void Function() _onResetHasSyncedDeviceDataOnce;

  RiderLogoutOrchestrator({
    required Ref ref,
    required void Function() onStopPolling,
    required void Function() onStopDeviceDataSync,
    required void Function() onResetRefreshInFlight,
    required void Function() onResetHasSyncedDeviceDataOnce,
  })  : _ref = ref,
        _onStopPolling = onStopPolling,
        _onStopDeviceDataSync = onStopDeviceDataSync,
        _onResetRefreshInFlight = onResetRefreshInFlight,
        _onResetHasSyncedDeviceDataOnce = onResetHasSyncedDeviceDataOnce;

  /// Run the full logout flow. Always returns — never throws. The caller
  /// (main RiderNotifier) is responsible for clearing its own state after
  /// this method returns.
  Future<void> run() async {
    final engagement = _ref.read(engagementProvider.notifier);
    final onboarding = _ref.read(userOnboardingNotifierProvider.notifier);
    final support = _ref.read(supportProvider.notifier);
    final tickets = _ref.read(supportTicketsProvider.notifier);
    final guarantor = _ref.read(guarantorOnboardingNotifierProvider.notifier);

    try {
      await _ref.read(authRepositoryProvider).logout();
    } catch (logoutErr) {
      // Best-effort — local logout below must still happen even if the
      // network call to /api/rider/auth/logout fails.
      //
      // DEEP-AUDIT D-P1-6 (2026-08-08): the residual risk when the
      // network call fails is that a stolen refresh token remains
      // valid server-side until the JWT TTL (30d). To bound the
      // damage we encrypt-and-delete the local refresh token now — a
      // stolen device that copied the secure-storage value before
      // logout can no longer exchange it for a new access token.
      // (The pre-logout in-memory token is gone with the app process
      // exit, so the only way to refresh was the persisted copy.)
      try {
        await _ref.read(authRepositoryProvider).forgetRefreshToken();
      } catch (forgetErr) {
        // If we can't even wipe the local refresh token, fall through
        // to the cross-account guards below — at least the rider's
        // local session is destroyed.
      }
    }

    engagement.logout();
    onboarding.reset();
    support.logout();
    tickets.reset();
    guarantor.reset();

    // PR-7 (PICKUP P0-2): clear any in-progress pickup draft so a fresh
    // login on a shared device doesn't resume the previous rider's
    // half-completed pickup. DEEP-AUDIT D-P2-11: key centralized in
    // rider_provider.dart as kPickupDraftCacheKey so router.dart +
    // orchestrator + main notifier all reference the same constant.
    try {
      await CacheService().remove(kPickupDraftCacheKey);
    } catch (e) {
      // ONBOARDING-AUDIT 2026-08-14 P3-2: orchestrator's reason to
      // exist is cross-account leak guards. A failure here is
      // concerning — log it so silent partial-logout drift is
      // visible.
      appDebug('[logout-orchestrator] pickup draft clear failed: $e');
    }

    // AUDIT FIX (HIGH SECURITY): wipe the persisted guarantor draft
    // (encrypted storage) so the next rider on a shared device cannot
    // resume the previous rider's guarantor PII. GuarantorCache tracks the
    // draft owner itself, so this needs no rider state.
    try {
      await GuarantorCache.clearCurrentDraft();
    } catch (e) {
      appDebug('[logout-orchestrator] guarantor cache clear failed: $e');
    }

    _onResetRefreshInFlight();
    _onStopDeviceDataSync();
    _onResetHasSyncedDeviceDataOnce();
    _onStopPolling();

    try {
      DocumentLocalCache.clearAll();
    } catch (e) {
      appDebug('[logout-orchestrator] document cache clear failed: $e');
    }
  }
}
