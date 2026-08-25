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
import 'package:voltium_rider/services/emergency_contacts_service.dart';
import 'package:voltium_rider/services/monitoring_service.dart';
import 'package:voltium_rider/services/offline_storage_service.dart';
// D-P2-11: the pickup-draft cache key constant lives in rider_provider.dart
// (single source of truth for router + orchestrator + main notifier). This
// creates an import cycle (rider_provider imports this orchestrator), which
// Dart tolerates; the `show` limits the surface to the constant only.
import 'package:voltium_rider/core/state/rider_provider.dart'
    show kPickupDraftCacheKey;

import 'package:voltium_rider/features/dashboard/presentation/providers/engagement_provider.dart';
import 'package:voltium_rider/features/support/presentation/providers/support_provider.dart';
import 'package:voltium_rider/features/support/presentation/providers/ticket_provider.dart';
import 'package:voltium_rider/features/kyc/data/kyc_repository.dart';
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
import 'package:voltium_rider/features/wallet/presentation/providers/wallet_provider.dart';
import 'package:voltium_rider/features/device_compliance/presentation/providers/device_policy_provider.dart';
// AUDIT FIX (workflows P0-G): notification + upload state must not
// survive logout.
import 'package:voltium_rider/features/notifications/presentation/providers/notification_provider.dart';
import 'package:voltium_rider/services/photo_upload_service.dart'
    show photoUploadProvider;

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

  /// Rider id captured from the caller's `RiderState` at logout time.
  /// We cannot `_ref.read(riderProvider)` here — the orchestrator is
  /// invoked from inside `RiderNotifier.logout()`, so its `ref` already
  /// owns `riderProvider` and a `read` would trip Riverpod v3's
  /// "A provider cannot depend on itself" assertion. The caller reads
  /// `state.riderId` synchronously before the await and passes it in;
  /// we use it after the await to clear the per-rider KYC form cache.
  final String? _riderId;

  RiderLogoutOrchestrator({
    required Ref ref,
    required String? riderId,
    required void Function() onStopPolling,
    required void Function() onStopDeviceDataSync,
    required void Function() onResetRefreshInFlight,
    required void Function() onResetHasSyncedDeviceDataOnce,
  })  : _ref = ref,
        _riderId = riderId,
        _onStopPolling = onStopPolling,
        _onStopDeviceDataSync = onStopDeviceDataSync,
        _onResetRefreshInFlight = onResetRefreshInFlight,
        _onResetHasSyncedDeviceDataOnce = onResetHasSyncedDeviceDataOnce;

  /// Run the full logout flow. Always returns — never throws. The caller
  /// (main RiderNotifier) is responsible for clearing its own state after
  /// this method returns.
  Future<void> run() async {
    CacheService().isLogoutInProgress = true;
    try {
      // PR-2 (F-002, 2026-08-22 deep audit): capture every per-rider state
      // holder BEFORE the await gap. Riverpod v3's "Ref used after dispose"
      // check throws if `_ref.read(...)` is called after a dispose, so all
      // notifier / state lookups must happen up front.
      final engagement = _ref.read(engagementProvider.notifier);
      final onboarding = _ref.read(userOnboardingNotifierProvider.notifier);
      final support = _ref.read(supportProvider.notifier);
      final tickets = _ref.read(supportTicketsProvider.notifier);
      final guarantor = _ref.read(guarantorOnboardingNotifierProvider.notifier);
      final wallet = _ref.read(walletProvider.notifier);
      final devicePolicy = _ref.read(devicePolicyProvider.notifier);
      final emergencyContacts =
          _ref.read(emergencyContactsServiceProvider.notifier);
      // AUDIT FIX (workflows P0-G): capture notification + upload state
      // so the previous rider's data cannot survive logout.
      final notifications = _ref.read(notificationProvider.notifier);
      final uploads = _ref.read(photoUploadProvider.notifier);
      // The KYC form cache key is keyed by riderId; the caller hands us
      // their `state.riderId` at construction time so we can clear it
      // after the logout HTTP call completes. We intentionally do NOT
      // re-read `riderProvider` here (see `_riderId` field doc above).
      final riderIdForCache = _riderId;

      try {
        await _ref.read(authRepositoryProvider).logout();
      } catch (logoutErr) {
        // Best-effort — local logout below must still happen even if the
        // network call to /api/rider/auth/logout fails.
        try {
          await _ref.read(authRepositoryProvider).forgetRefreshToken();
        } catch (forgetErr) {
          // Fall through to local cleanup.
        }
      }

      engagement.logout();
      onboarding.reset();
      support.logout();
      tickets.reset();
      guarantor.reset();
      wallet.logout();
      devicePolicy.logout();
      // AUDIT FIX (workflows P0-G): clear the previous rider's in-app
      // notifications (PII: titles/messages) and pending/completed upload
      // queue entries (local paths + server URLs).
      notifications.reset();
      uploads.clearAll();

      // PR-2 (F-002): reset the emergency-contacts notifier so the next
      // rider on a shared device does not see the previous rider's
      // emergency contacts.
      try {
        await emergencyContacts.clearAll();
      } catch (e) {
        appDebug('[logout-orchestrator] emergency contacts clear failed: $e');
      }

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

      // PR-2 (F-002): clear the rider cache (name, phone, KYC status,
      // plan, team leader phone, emergency contact) so the next rider
      // on a shared device does not see the previous rider's data on
      // first paint. The 24-hour TTL on the rider cache means a stale
      // entry would otherwise survive until the next cold start.
      try {
        await CacheService().clearRiderCache();
      } catch (e) {
        appDebug('[logout-orchestrator] rider cache clear failed: $e');
      }

      // PR-2 (F-002): clear the SQLite-backed offline storage
      // (`cached_data`, `cached_transactions`, `cached_plans`,
      // `pending_operations`). The ETag 304 store will repopulate on
      // the next successful GET for the new rider, so the cost is one
      // extra round-trip on first launch.
      try {
        await OfflineStorageService().clearAll();
      } catch (e) {
        appDebug('[logout-orchestrator] offline storage clear failed: $e');
      }

      // PR-2 (F-002): clear the KYC form draft (name, email, address,
      // DOB, parents) so the next rider on a shared device does not see
      // the previous rider's partially-filled KYC form on the next
      // sign-in. `saveFormCache` deliberately strips financial PII
      // (bankAccount/IFSC) but keeps identity fields; the full draft
      // is only cleared here on logout.
      if (riderIdForCache != null && riderIdForCache.isNotEmpty) {
        try {
          await KycRepository.clearFormCache(riderId: riderIdForCache);
        } catch (e) {
          appDebug('[logout-orchestrator] KYC cache clear failed: $e');
        }
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

      // PR-2 (F-002): reset the PostHog identity LAST. Until this point
      // we may have been emitting structured events (the authRepository
      // logout can log, the cache clear failures are debugged, etc.);
      // PostHog should keep capturing those with the current rider's
      // identity. After this reset, the next event belongs to the next
      // rider (or to an anonymous session). The reset itself is
      // best-effort — PostHog outages must not block local logout.
      try {
        await MonitoringService.resetUser();
      } catch (e) {
        appDebug('[logout-orchestrator] monitoring reset failed: $e');
      }
    } finally {
      CacheService().isLogoutInProgress = false;
    }
  }
}
