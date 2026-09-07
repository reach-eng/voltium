// R4.3c-6 — Riverpod v3 `RiderProvider` (Notifier + state).
//
// The previous `RiderProvider extends ChangeNotifier with
// WidgetsBindingObserver` was the central state holder for the
// rider model, polling manager lifecycle, FCM token registration,
// and device-data sync. All of that is preserved — the notifier
// holds the same `PollingManager` instances, the same `Timer` for
// the location sync, and the same `WidgetsBindingObserver` mixin
// for lifecycle handling. State mutations now go through an
// immutable `RiderState` value object instead of `notifyListeners()`.
//
// Same external surface:
//   - state accessors: `rider`, `riderId`, `phone`, `dataState`,
//     `errorMessage`, `isRefreshing`, `isPollingTimedOut`,
//     `hasFetchedOnce`, `isPlanActive`, `isKycDone`,
//     `isActuallyActive`
//   - lifecycle: `init`, `refreshFromApi`, `updateCredentials`,
//     `logout`, `submitVehicleReturn`, `registerFcmToken`
//   - polling: `startOnboardingPoll`, `stopPolling`,
//     `startPostPickupPoll`, `setPollingActive`,
//     `setPollingInactive`
//   - rider updates: `setRiderId`, `setRider`, `updateRider`,
//     `refresh`, `routeAfterLogin`

import 'dart:async';
import 'dart:developer' show log;
import 'dart:io' show File;
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:voltium_rider/features/profile/domain/repository.dart';
import 'package:voltium_rider/features/profile/data/repository_impl.dart';
import 'package:voltium_rider/features/rentals/domain/repository.dart';
import 'package:voltium_rider/features/rentals/data/repository_impl.dart';
import 'package:voltium_rider/core/network/api_client.dart';
import 'package:voltium_rider/core/network/generated/api_client.dart';
import 'package:voltium_rider/core/network/files_repository.dart';
import 'package:voltium_rider/core/network/connectivity_provider.dart';
import 'package:voltium_rider/core/polling/polling_manager.dart';
import 'package:voltium_rider/models/rider_model.dart';
import 'package:voltium_rider/services/cache_service.dart';
import 'package:voltium_rider/services/device_data_service.dart';
import 'package:voltium_rider/services/performance_service.dart';
import 'package:voltium_rider/services/fcm_service.dart';
import 'package:voltium_rider/utils/lifecycle_rank.dart';

import 'package:voltium_rider/core/navigation/app_state.dart';
import 'package:voltium_rider/core/navigation/app_state_notifier.dart';
import 'package:voltium_rider/features/auth/presentation/rider_lifecycle_gate.dart';

// DEEP-AUDIT D-P0-3 (2026-08-08): RiderLogoutOrchestrator owns the
// cross-account leak guards that used to be inlined in logout(). The
// main RiderNotifier delegates to it; the orchestrator handles
// `authRepositoryProvider.logout()` + per-feature reset + cache wipe.
import 'rider_logout_orchestrator.dart';
import 'riverpod_providers.dart';

export 'rider_provider.dart' show DataState;

/// DEEP-AUDIT D-P2-11 (2026-08-08): the literal pickup-draft key was
/// duplicated in router.dart, rider_provider.dart, and
/// RiderLogoutOrchestrator. Centralize the constant so a rename touches
/// one place.
const String kPickupDraftCacheKey = 'voltium_pickup_draft_v1';

enum DataState {
  initial,
  loading,
  fromCache,
  fresh,
  error,
}

/// Immutable rider state.
@immutable
class RiderState {
  final RiderModel? rider;
  final String? riderId;
  final String? phone;
  final DataState dataState;
  final String? errorMessage;
  final bool isRefreshing;
  final bool isPollingTimedOut;
  final bool hasFetchedOnce;

  /// ONBOARDING-AUDIT 2026-08-14 P0-4: epoch-ms timestamp of the most
  /// recent 401 returned by the server during a profile refresh. The
  /// router watches this field; a non-null value triggers a forced
  /// logout + a "session expired" snackbar. Cleared on logout / init
  /// so a fresh login doesn't re-fire the signal.
  final int? lastSessionExpiredAt;

  /// P0-3 follow-up (2026-09-07): server-driven location-sync cadence in
  /// minutes (public setting `gpsFetchIntervalMins`, registry 1–1440).
  /// null until the settings load lands; consumers fall back to the
  /// historical 60s cadence.
  final int? gpsFetchIntervalMins;

  const RiderState({
    this.rider,
    this.riderId,
    this.phone,
    this.dataState = DataState.initial,
    this.errorMessage,
    this.isRefreshing = false,
    this.isPollingTimedOut = false,
    this.hasFetchedOnce = false,
    this.lastSessionExpiredAt,
    this.gpsFetchIntervalMins,
  });

  bool get isPlanActive => rider?.rentalStatus == 'ACTIVE';
  bool get isKycDone => rider?.kycStatus == KycStatus.approved;
  bool get isActuallyActive =>
      rider?.accountStatus == AccountStatus.active ||
      (rider?.lifecycleStatus.isNotEmpty == true &&
          lifecycleRank(rider!) >= 11);

  RiderState copyWith({
    RiderModel? rider,
    String? riderId,
    String? phone,
    DataState? dataState,
    String? errorMessage,
    bool? isRefreshing,
    bool? isPollingTimedOut,
    bool? hasFetchedOnce,
    int? lastSessionExpiredAt,
    int? gpsFetchIntervalMins,
    bool clearErrorMessage = false,
    bool clearRider = false,
    bool clearLastSessionExpiredAt = false,
  }) =>
      RiderState(
        rider: clearRider ? null : (rider ?? this.rider),
        riderId: riderId ?? this.riderId,
        phone: phone ?? this.phone,
        dataState: dataState ?? this.dataState,
        errorMessage:
            clearErrorMessage ? null : (errorMessage ?? this.errorMessage),
        isRefreshing: isRefreshing ?? this.isRefreshing,
        isPollingTimedOut: isPollingTimedOut ?? this.isPollingTimedOut,
        hasFetchedOnce: hasFetchedOnce ?? this.hasFetchedOnce,
        lastSessionExpiredAt: clearLastSessionExpiredAt
            ? null
            : (lastSessionExpiredAt ?? this.lastSessionExpiredAt),
        gpsFetchIntervalMins: gpsFetchIntervalMins ?? this.gpsFetchIntervalMins,
      );
}

class RiderNotifier extends Notifier<RiderState> with WidgetsBindingObserver {
  RiderRepository get _riderRepository => ref.read(riderRepositoryProvider);
  RentalRepository get _rentalRepository => ref.read(rentalRepositoryProvider);
  FilesRepository get _filesRepository => ref.read(filesRepositoryProvider);

  // ── Polling + timers (same shape as the old ChangeNotifier) ──
  int _onboardingPollCount = 0;
  late final PollingManager _onboardingPoller;
  late final PollingManager _postPickupPoller;
  Timer? _locationSyncTimer;
  bool _hasSyncedDeviceDataOnce = false;

  // P0-3 follow-up (2026-09-07): public rider settings (currently only
  // gpsFetchIntervalMins feeds this notifier) load once per session —
  // same contract as WalletNotifier.loadSettings / SupportNotifier.
  bool _publicSettingsAttempted = false;
  Future<void>? _publicSettingsInFlight;
  bool _hasSyncedPermissionsOnce = false;

  @override
  RiderState build() {
    final initialOnline = ref.read(connectivityProvider).isOnline;
    _onboardingPoller = PollingManager(
      onTick: _onOnboardingTick,
      strategy: const PollingStrategy(
        active: Duration(seconds: 30),
        inactive: Duration(seconds: 60),
      ),
      connectivity: initialOnline,
    );
    _postPickupPoller = PollingManager(
      onTick: _onPostPickupTick,
      strategy: const PollingStrategy(
        active: Duration(seconds: 60),
        inactive: Duration(seconds: 120),
      ),
      connectivity: initialOnline,
    );

    // R11.2 — register as a WidgetsBindingObserver so the provider
    // can self-pause polling and cancel the device-data sync timer
    // when the app is backgrounded.
    WidgetsBinding.instance.addObserver(this);

    // R4.5 — Scope polling & background timers strictly to active AppState screen lifecycles
    ref.listen<AppState>(appStateProvider, (previous, next) {
      _applyAppStatePollingPolicy(next);
    });

    // F-15: Wire connectivity state changes directly into PollingManager instances
    ref.listen<ConnectivityState>(connectivityProvider, (previous, next) {
      if (previous?.isOnline != next.isOnline) {
        setPollingConnectivity(next.isOnline);
      }
    });

    ref.onDispose(() {
      WidgetsBinding.instance.removeObserver(this);
      _onboardingPoller.stop();
      _postPickupPoller.stop();
      _stopDeviceDataSync();
    });
    return const RiderState();
  }

  // ── Public API (mirrors the old `RiderProvider` class) ──

  RiderModel? get rider => state.rider;
  String? get riderId => state.riderId;
  String? get phone => state.phone;
  DataState get dataState => state.dataState;
  String? get errorMessage => state.errorMessage;
  bool get isRefreshing => state.isRefreshing;
  bool get isPollingTimedOut => state.isPollingTimedOut;
  bool get hasFetchedOnce => state.hasFetchedOnce;
  bool get isPlanActive => state.isPlanActive;
  bool get isKycDone => state.isKycDone;
  bool get isActuallyActive => state.isActuallyActive;

  Future<void> init() async {
    PerformanceService().startTrace('RiderNotifier_Init');

    // DEEP-AUDIT D-P2-10 (2026-08-08): cancel any in-flight
    // _locationSyncTimer before init runs. Without this, a hot-reload or
    // any code path that calls init() twice leaks a Timer that will keep
    // the event loop alive AND keep the previous rider's id in the
    // timer callback. dispose() cleans up but is only called on provider
    // disposal; init() can be called multiple times within the same
    // provider lifetime.
    _locationSyncTimer?.cancel();
    _locationSyncTimer = null;
    _hasSyncedDeviceDataOnce = false;
    _hasSyncedPermissionsOnce = false;

    // ONBOARDING-AUDIT 2026-08-14 P0-4: clear the sticky sessionExpired
    // flag so a fresh login / app restart doesn't re-fire the router's
    // "session expired" handler.
    if (state.lastSessionExpiredAt != null) {
      state = state.copyWith(clearLastSessionExpiredAt: true);
    }

    // Attempt cache read (validating TTL & version).
    final cacheService = CacheService();
    if (!cacheService.isRiderCacheValid()) {
      await cacheService.clearRiderCache();
    }
    final cached = cacheService.getCachedRider();
    if (cached != null) {
      final rider = RiderModel.fromCacheMap(cached);
      state = state.copyWith(
        rider: rider,
        riderId: rider.riderId.isNotEmpty ? rider.riderId : rider.id,
        phone: rider.phone,
        dataState: DataState.fromCache,
      );
    }

    // Trigger fresh load in background.
    await refreshFromApi();
    PerformanceService().stopTrace('RiderNotifier_Init');
  }

  Future<void>? _refreshInFlight;

  Future<void> refreshFromApi() async {
    final pending = _refreshInFlight;
    if (pending != null) return pending;
    state = state.copyWith(clearErrorMessage: true);

    final future = _doRefreshFromApi();
    _refreshInFlight = future;
    try {
      await future;
    } finally {
      _refreshInFlight = null;
    }
  }

  Future<void> _doRefreshFromApi() async {
    state = state.copyWith(isRefreshing: true);
    PerformanceService().startTrace('RiderNotifier_RefreshAPI');

    if (state.riderId == null && state.phone == null) {
      state = state.copyWith(isRefreshing: false);
      PerformanceService().stopTrace('RiderNotifier_RefreshAPI');
      return;
    }

    try {
      final response = await _riderRepository.getRiderProfile();
      if (!ref.mounted) return;
      final payload = response['data'] ?? response['rider'] ?? response;
      if (payload != null && (payload as Map).isNotEmpty) {
        final rider = RiderModel.fromJson(payload as Map<String, dynamic>);
        await CacheService().cacheRider(rider.toCacheMap());
        state = state.copyWith(
          rider: rider,
          riderId: rider.riderId.isNotEmpty ? rider.riderId : rider.id,
          dataState: DataState.fresh,
          clearErrorMessage: true,
        );
        // LANGUAGE-AUDIT (2026-08-16) #6: apply the server's
        // preferred locale (if the rider hasn't already made an
        // explicit local choice). Best-effort, silent on failure.
        unawaited(
          ref
              .read(localeProvider.notifier)
              .maybeApplyFromServer(rider.preferredLocale),
        );

        if (rider.accountStatus == AccountStatus.active ||
            (rider.lifecycleStatus.isNotEmpty && lifecycleRank(rider) >= 11)) {
          unawaited(Future(_startDeviceDataSync));
        }
        if (rider.id != null && !_hasSyncedPermissionsOnce) {
          _hasSyncedPermissionsOnce = true;
          unawaited(DeviceDataService().syncPermissionState(rider.id!));
        }
        state = state.copyWith(hasFetchedOnce: true);
        unawaited(Future(_syncDeviceDataOnce));
      } else {
        state = state.copyWith(
          errorMessage: 'Failed to fetch profile',
          dataState:
              state.rider != null ? DataState.fromCache : DataState.error,
        );
      }
    } on ApiException catch (e) {
      // ONBOARDING-AUDIT 2026-08-14 P0-4: 401 means the refresh token is
      // gone (revoked or expired) — every screen in the app used to show
      // "Pull to retry" and silently swallow this, so a rider whose
      // session died was stuck on stale data forever. We now stamp a
      // sessionExpired timestamp that the router watches; the rider is
      // sent to the login screen and shown a friendly explanation. The
      // api_client already attempted a one-shot token refresh (see
      // `api_client.dart:_refreshToken`) and gave up — this is the
      // terminal 401.
      if (e.statusCode == 401) {
        log('Rider profile refresh: session expired (401)');
        state = state.copyWith(
          lastSessionExpiredAt: DateTime.now().millisecondsSinceEpoch,
          dataState:
              state.rider != null ? DataState.fromCache : DataState.error,
        );
      } else {
        log('Error refreshing rider profile: $e');
        state = state.copyWith(
          errorMessage: 'Couldn\'t refresh your profile. Pull to retry.',
          dataState:
              state.rider != null ? DataState.fromCache : DataState.error,
        );
      }
    } catch (e) {
      log('Error refreshing rider profile: $e');
      state = state.copyWith(
        errorMessage: 'Couldn\'t refresh your profile. Pull to retry.',
        dataState: state.rider != null ? DataState.fromCache : DataState.error,
      );
    } finally {
      state = state.copyWith(isRefreshing: false);
      PerformanceService().stopTrace('RiderNotifier_RefreshAPI');
    }
  }

  void updateCredentials({String? riderId, String? phone}) {
    if (riderId != null) state = state.copyWith(riderId: riderId);
    if (phone != null) state = state.copyWith(phone: phone);
  }

  Future<void> logout() async {
    // DEEP-AUDIT D-P0-3 (2026-08-08): the cross-account leak guards +
    // network call have moved to RiderLogoutOrchestrator. The main
    // RiderNotifier still owns its own state reset, polling stop, and
    // device sync stop because those touch the notifier's private
    // instance fields.
    final orchestrator = RiderLogoutOrchestrator(
      ref: ref,
      onStopPolling: stopPolling,
      onStopDeviceDataSync: _stopDeviceDataSync,
      onResetRefreshInFlight: () => _refreshInFlight = null,
      onResetHasSyncedDeviceDataOnce: () => _hasSyncedDeviceDataOnce = false,
    );
    await orchestrator.run();
    _publicSettingsAttempted = false;
    _publicSettingsInFlight = null;
    state = const RiderState();
  }

  Future<bool> submitVehicleReturn({
    required List<File> photos,
    String? reason,
  }) async {
    final rId = state.rider?.id ?? state.riderId;
    if (rId == null) return false;
    try {
      final List<String> photoUrls = [];
      for (final photo in photos) {
        final url = await _filesRepository.uploadFile(photo, 'vehicle_return');
        photoUrls.add(url);
      }
      // PR-VER-2026-08-06 (RENTAL P0-3): vehicleId/hubId were fabricated
      // (`''` or stale rider fields) and silently discarded by the
      // repository — the server resolves identity from the session.
      await _rentalRepository.submitVehicleReturn(
        photos: photoUrls,
      );
      await refreshFromApi();
      return true;
    } catch (e) {
      return false;
    }
  }

  Future<void> registerFcmToken() async {
    final rId = state.riderId ?? state.rider?.id;
    if (rId == null) return;
    final token = await FCMService.getToken();
    if (token == null) return;
    try {
      await _riderRepository.registerFCMToken(token);
    } catch (e) {
      log('Failed to register FCM token: $e');
    }
  }

  /// R4.5 — Scope polling & background timers strictly to active AppState screen lifecycles.
  void _applyAppStatePollingPolicy(AppState appState) {
    switch (appState) {
      case Onboarding():
      case PreDashboard():
      // PR-ONBOARDING-FLOW-2026-08-11: hangTight is the new active flow's
      // tail state (post-pickup, pre-activation wait). The rider is still
      // !pickupDone, so the onboarding poll must keep running to detect
      // admin activation; the post-pickup poll and device-sync timers are
      // not yet active because the rider is not on the dashboard.
      case HangTight():
        _postPickupPoller.stop();
        _stopDeviceDataSync();
        final r = state.rider;
        // HANG-TIGHT-AUDIT P1-2 (2026-09-08): drop the prior
        // `_onboardingPollCount <= 240` check. After a timeout the
        // count was > 240 and the gate stayed closed, so any
        // app-state round-trip back to HangTight left the poller
        // dead with no UI (compounds the P0-3 polling-timeout
        // banner UX). `startOnboardingPoll` already resets the
        // count to 0, clears `isPollingTimedOut`, and restarts the
        // poller — the poller's own `isRunning` check is the
        // real guard against double-start, so calling on every
        // HangTight entry is safe.
        if (r == null || !r.pickupDone) {
          startOnboardingPoll();
        }
        break;

      case ActiveDashboard():
        _onboardingPoller.stop();
        startPostPickupPoll();
        _startDeviceDataSync();
        break;

      case Splash():
      case LegalGate():
      case PermissionsGate():
      case AuthFlow():
      case AccountClosed():
        _onboardingPoller.stop();
        _postPickupPoller.stop();
        _stopDeviceDataSync();
        break;
    }
  }

  void startOnboardingPoll() {
    if (!ref.mounted) return;
    final appState = ref.read(appStateProvider);
    if (appState is! Onboarding &&
        appState is! PreDashboard &&
        appState is! HangTight) return;
    if (_onboardingPoller.isRunning) return;
    _onboardingPollCount = 0;
    state = state.copyWith(isPollingTimedOut: false);
    _onboardingPoller.start();
  }

  void stopPolling() {
    _onboardingPoller.stop();
    _postPickupPoller.stop();
    _stopDeviceDataSync();
  }

  void startPostPickupPoll() {
    if (!ref.mounted) return;
    final appState = ref.read(appStateProvider);
    if (appState is! ActiveDashboard) return;
    if (_postPickupPoller.isRunning) return;
    _postPickupPoller.start();
  }

  void setPollingActive() {
    _onboardingPoller.active();
    _postPickupPoller.active();
  }

  void setPollingInactive() {
    _onboardingPoller.inactive();
    _postPickupPoller.inactive();
  }

  void setPollingConnectivity(bool isOnline) {
    _onboardingPoller.setConnectivity(isOnline);
    _postPickupPoller.setConnectivity(isOnline);
  }

  @visibleForTesting
  PollingManager get onboardingPoller => _onboardingPoller;

  @visibleForTesting
  PollingManager get postPickupPoller => _postPickupPoller;

  Future<void> _onOnboardingTick() async {
    const maxPolls = 240;
    final rider = state.rider;
    if (rider == null) {
      await refreshFromApi();
      return;
    }

    if (rider.pickupDone) {
      _onboardingPoller.stop();
      startPostPickupPoll();
      return;
    }

    _onboardingPollCount++;
    if (_onboardingPollCount > maxPolls) {
      _onboardingPoller.stop();
      state = state.copyWith(isPollingTimedOut: true);
      log('RiderNotifier: Polling timeout reached.');
      return;
    }

    await refreshFromApi();
  }

  Future<void> _onPostPickupTick() async {
    final rider = state.rider;
    if (rider != null && rider.lifecycleStatus == 'CLOSED') {
      _postPickupPoller.stop();
      return;
    }
    await refreshFromApi();
  }

  void _startDeviceDataSync() {
    if (!ref.mounted) return;
    final appState = ref.read(appStateProvider);
    if (appState is! ActiveDashboard) return;
    // Fire-and-forget: the timer starts immediately on the current
    // cadence and restarts (below) once the server value lands.
    unawaited(loadPublicSettings());
    _locationSyncTimer?.cancel();
    _locationSyncTimer = Timer.periodic(locationSyncPeriod, (_) {
      if (!ref.mounted) return;
      DeviceDataService().syncLocation(state.riderId ?? state.rider?.id ?? '');
    });
  }

  /// Foreground location-sync cadence. Server-driven via the public
  /// `gpsFetchIntervalMins` setting (registry bounds 1–1440 minutes);
  /// null / invalid values fall back to the historical 60s so an
  /// offline or failed settings load keeps the pre-wiring behavior.
  Duration get locationSyncPeriod {
    final mins = state.gpsFetchIntervalMins;
    if (mins == null || mins < 1) return const Duration(seconds: 60);
    return Duration(minutes: mins);
  }

  /// Loads the public rider settings (once per session, coalesced,
  /// fail-open). Currently consumes `gpsFetchIntervalMins`; more public
  /// keys can be read off the same response without extra requests.
  Future<void> loadPublicSettings() async {
    if (_publicSettingsAttempted) {
      // Coalesce concurrent callers onto the in-flight fetch.
      await _publicSettingsInFlight;
      return;
    }
    _publicSettingsAttempted = true;
    final inFlight = _fetchAndApplyPublicSettings();
    _publicSettingsInFlight = inFlight;
    await inFlight;
  }

  Future<void> _fetchAndApplyPublicSettings() async {
    try {
      final raw = await ref.read(voltiumApiClientProvider).getRiderSettings();
      if (!ref.mounted) return;
      final settingsMap = raw['settings'];
      if (settingsMap is! Map) return;
      final rawInterval = settingsMap['gpsFetchIntervalMins'];
      // Registry bounds: 1..1440 minutes. Out-of-range or garbage values
      // are treated as absent — the fallback cadence keeps working.
      final interval = rawInterval is num ? rawInterval.toInt() : null;
      if (interval == null || interval < 1 || interval > 1440) return;
      if (interval == state.gpsFetchIntervalMins) return;
      state = state.copyWith(gpsFetchIntervalMins: interval);
      log('Loaded server gpsFetchIntervalMins: $interval min');
      // A running timer picks up the new cadence via restart.
      if (_locationSyncTimer != null) {
        _startDeviceDataSync();
      }
    } catch (e) {
      log('Failed to load public settings (keeping 60s location cadence): $e');
    }
  }

  void _stopDeviceDataSync() {
    _locationSyncTimer?.cancel();
    _locationSyncTimer = null;
  }

  void _syncDeviceDataOnce() {
    if (!ref.mounted) return;
    if (_hasSyncedDeviceDataOnce) return;
    _hasSyncedDeviceDataOnce = true;
    final rId = state.riderId ?? state.rider?.id;
    if (rId == null) return;
    DeviceDataService().syncAll(rId);
  }

  void setRiderId(String id, {String? phoneNumber}) {
    state = state.copyWith(
      riderId: id,
      phone: phoneNumber ?? state.phone,
    );
  }

  void setRider(RiderModel r) {
    state = state.copyWith(
      rider: r,
      riderId: (r.id != null && r.id!.isNotEmpty) ? r.id : r.riderId,
      phone: r.phone,
      dataState: DataState.fresh,
      hasFetchedOnce: true,
      clearErrorMessage: true,
    );
    unawaited(refreshFromApi());
  }

  void updateRider(RiderModel updated) {
    state = state.copyWith(rider: updated);
  }

  Future<void> refresh() async {
    await refreshFromApi();
  }

  /// Delegate lifecycle routing to RiderLifecycleGate.
  /// Returns modern sealed [AppState].
  AppState routeAfterLoginAppState(RiderModel r) {
    return RiderLifecycleGate.redirectAppState(r);
  }

  // ── WidgetsBindingObserver ──

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    final rider = this.state.rider;
    switch (state) {
      case AppLifecycleState.paused:
      case AppLifecycleState.inactive:
      case AppLifecycleState.hidden:
      case AppLifecycleState.detached:
        _stopDeviceDataSync();
        _onboardingPoller.inactive();
        _postPickupPoller.inactive();
        break;
      case AppLifecycleState.resumed:
        _onboardingPoller.active();
        _postPickupPoller.active();
        final currentAppState = ref.read(appStateProvider);
        if (currentAppState is ActiveDashboard &&
            rider != null &&
            (rider.accountStatus == AccountStatus.active ||
                lifecycleRank(rider) >= 11)) {
          _startDeviceDataSync();
        }
        break;
    }
  }
}

/// Backwards-compat type alias used by `AppProvider` shim and any
/// test/call site that still references the old class name.
typedef RiderProvider = RiderNotifier;

/// Riverpod v3 provider for the rider feature.
final riderProvider = NotifierProvider<RiderNotifier, RiderState>(
  RiderNotifier.new,
);

// ── Repository providers (overridden in main.dart) ──

final riderRepositoryProvider = Provider<RiderRepository>((ref) {
  final client = ApiClient();
  final vClient = VoltiumApiClient(client);
  return RiderRepositoryImpl(vClient);
});

final rentalRepositoryProvider = Provider<RentalRepository>((ref) {
  final client = ApiClient();
  final vClient = VoltiumApiClient(client);
  return RentalRepositoryImpl(vClient);
});
