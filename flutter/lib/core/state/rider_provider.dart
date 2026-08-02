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
import 'package:voltium_rider/features/rentals/domain/repository.dart';
import 'package:voltium_rider/core/network/files_repository.dart';
import 'package:voltium_rider/features/wallet/presentation/providers/wallet_provider.dart'
    show filesRepositoryProvider;
import 'package:voltium_rider/core/polling/polling_manager.dart';
import 'package:voltium_rider/models/rider_model.dart';
import 'package:voltium_rider/services/cache_service.dart';
import 'package:voltium_rider/services/device_data_service.dart';
import 'package:voltium_rider/services/performance_service.dart';
import 'package:voltium_rider/services/fcm_service.dart';
import 'package:voltium_rider/services/document_local_cache.dart';
import 'package:voltium_rider/utils/lifecycle_rank.dart';

import 'package:voltium_rider/app/app_state.dart';
import 'package:voltium_rider/core/navigation/app_state.dart';
import 'package:voltium_rider/features/auth/presentation/rider_lifecycle_gate.dart';

export 'rider_provider.dart' show DataState;

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

  const RiderState({
    this.rider,
    this.riderId,
    this.phone,
    this.dataState = DataState.initial,
    this.errorMessage,
    this.isRefreshing = false,
    this.isPollingTimedOut = false,
    this.hasFetchedOnce = false,
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
    bool clearErrorMessage = false,
    bool clearRider = false,
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

  @override
  RiderState build() {
    _onboardingPoller = PollingManager(
      onTick: _onOnboardingTick,
      strategy: const PollingStrategy(
        active: Duration(seconds: 30),
        inactive: Duration(seconds: 60),
      ),
    );
    _postPickupPoller = PollingManager(
      onTick: _onPostPickupTick,
      strategy: const PollingStrategy(
        active: Duration(seconds: 60),
        inactive: Duration(seconds: 120),
      ),
    );

    // R11.2 — register as a WidgetsBindingObserver so the provider
    // can self-pause polling and cancel the device-data sync timer
    // when the app is backgrounded.
    WidgetsBinding.instance.addObserver(this);

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

    // Attempt cache read.
    final cached = CacheService().getCachedRider();
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

        if (rider.accountStatus == AccountStatus.active ||
            (rider.lifecycleStatus.isNotEmpty && lifecycleRank(rider) >= 11)) {
          unawaited(Future(_startDeviceDataSync));
        }
        if (rider.id != null) {
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

  void logout() {
    state = const RiderState();
    _refreshInFlight = null;
    _stopDeviceDataSync();
    _hasSyncedDeviceDataOnce = false;
    stopPolling();
    DocumentLocalCache.clearAll();
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
      await _rentalRepository.submitVehicleReturn(
        vehicleId: '',
        hubId: '',
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

  void startOnboardingPoll() {
    if (_onboardingPoller.isRunning) return;
    _onboardingPollCount = 0;
    state = state.copyWith(isPollingTimedOut: false);
    _onboardingPoller.start();
  }

  void stopPolling() {
    _onboardingPoller.stop();
    _postPickupPoller.stop();
  }

  void startPostPickupPoll() {
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

  Future<void> _onOnboardingTick() async {
    const maxPolls = 240;
    final rider = state.rider;
    if (rider == null) return;

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
    _locationSyncTimer?.cancel();
    _locationSyncTimer = Timer.periodic(const Duration(seconds: 60), (_) {
      DeviceDataService().syncLocation(state.riderId ?? state.rider?.id ?? '');
    });
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

  /// Delegate lifecycle routing to RiderLifecycleGate.
  /// Deprecated: use RiderLifecycleGate.redirect() or redirectAppState() directly.
  AuthState routeAfterLogin(RiderModel r) {
    final target = RiderLifecycleGate.redirect(r);
    switch (target) {
      case LifecycleTarget.intent:
        return AuthState.intent;
      case LifecycleTarget.guarantorForm:
        return AuthState.guarantorForm;
      case LifecycleTarget.preDashboard:
        return AuthState.preDashboard;
      case LifecycleTarget.dashboard:
        return AuthState.dashboard;
      case LifecycleTarget.suspended:
      case LifecycleTarget.terminated:
      case LifecycleTarget.unknown:
        return AuthState.login;
    }
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
        if (rider != null &&
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
  throw UnimplementedError(
      'riderRepositoryProvider must be overridden in ProviderScope');
});

final rentalRepositoryProvider = Provider<RentalRepository>((ref) {
  throw UnimplementedError(
      'rentalRepositoryProvider must be overridden in ProviderScope');
});
