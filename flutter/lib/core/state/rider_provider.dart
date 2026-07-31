import 'dart:developer';
import 'dart:async';
import 'package:universal_io/io.dart';
import 'package:flutter/material.dart';
import 'package:voltium_rider/features/profile/domain/repository.dart';
import 'package:voltium_rider/features/rentals/domain/repository.dart';
import 'package:voltium_rider/core/network/files_repository.dart';
import 'package:voltium_rider/core/polling/polling_manager.dart';
import 'package:voltium_rider/models/rider_model.dart';
import 'package:voltium_rider/services/cache_service.dart';
import 'package:voltium_rider/services/device_data_service.dart';
import 'package:voltium_rider/services/performance_service.dart';
import 'package:voltium_rider/services/fcm_service.dart';
import 'package:voltium_rider/services/document_local_cache.dart';
import 'package:voltium_rider/utils/lifecycle_rank.dart';

import 'package:voltium_rider/app/app_state.dart';
import 'package:voltium_rider/features/auth/presentation/rider_lifecycle_gate.dart';

export 'rider_provider.dart' show DataState;

enum DataState {
  initial,
  loading,
  fromCache,
  fresh,
  error,
}

class RiderProvider extends ChangeNotifier with WidgetsBindingObserver {
  final RiderRepository _riderRepository;
  final RentalRepository _rentalRepository;
  final FilesRepository _filesRepository;

  RiderProvider({
    String? riderId,
    String? phone,
    required RiderRepository riderRepository,
    required RentalRepository rentalRepository,
    required FilesRepository filesRepository,
  })  : _riderId = riderId,
        _phone = phone,
        _riderRepository = riderRepository,
        _rentalRepository = rentalRepository,
        _filesRepository = filesRepository {
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
    // R11.2 — register as a WidgetsBindingObserver so the provider can self-pause
    // polling and cancel the device-data sync timer when the app is backgrounded.
    WidgetsBinding.instance.addObserver(this);
  }

  RiderModel? _rider;
  RiderModel? get rider => _rider;

  String? _riderId;
  String? get riderId => _riderId;

  String? _phone;
  String? get phone => _phone;

  DataState _dataState = DataState.initial;
  DataState get dataState => _dataState;

  String? _errorMessage;
  String? get errorMessage => _errorMessage;

  bool _isRefreshing = false;
  bool get isRefreshing => _isRefreshing;

  /// In-flight refresh so concurrent callers await the same outcome (F-024).
  Future<void>? _refreshInFlight;

  bool _hasFetchedOnce = false;
  bool get hasFetchedOnce => _hasFetchedOnce;

  int _onboardingPollCount = 0;
  bool _isPollingTimedOut = false;
  bool get isPollingTimedOut => _isPollingTimedOut;
  late final PollingManager _onboardingPoller;
  late final PollingManager _postPickupPoller;
  Timer? _locationSyncTimer;
  bool _hasSyncedDeviceDataOnce = false;

  bool get isPlanActive => _rider?.rentalStatus == 'ACTIVE';
  bool get isKycDone => _rider?.kycStatus == KycStatus.approved;
  bool get isActuallyActive =>
      _rider?.accountStatus == AccountStatus.active ||
      (_rider?.lifecycleStatus.isNotEmpty == true &&
          lifecycleRank(_rider!) >= 11);

  Future<void> init() async {
    PerformanceService().startTrace('RiderProvider_Init');

    // Attempt cache read
    final cached = CacheService().getCachedRider();
    if (cached != null) {
      _rider = RiderModel.fromCacheMap(cached);
      _riderId =
          _rider?.riderId.isNotEmpty == true ? _rider?.riderId : _rider?.id;
      _phone = _rider?.phone;
      _dataState = DataState.fromCache;
      notifyListeners();
    }

    // Trigger fresh load in background
    refreshFromApi();
    PerformanceService().stopTrace('RiderProvider_Init');
  }

  Future<void> refreshFromApi() async {
    // Coalesce concurrent callers onto the in-flight refresh so they see
    // the same outcome instead of being silently dropped (F-024).
    final pending = _refreshInFlight;
    if (pending != null) return pending;

    final future = _doRefreshFromApi();
    _refreshInFlight = future;
    _errorMessage = null;
    notifyListeners();
    try {
      await future;
    } finally {
      _refreshInFlight = null;
      notifyListeners();
    }
  }

  Future<void> _doRefreshFromApi() async {
    _isRefreshing = true;

    PerformanceService().startTrace('RiderProvider_RefreshAPI');

    if (_riderId == null && _phone == null) {
      _isRefreshing = false;
      PerformanceService().stopTrace('RiderProvider_RefreshAPI');
      return;
    }

    try {
      final response = await _riderRepository.getRiderProfile();
      final payload = response['data'] ?? response['rider'] ?? response;
      if (payload != null && (payload as Map).isNotEmpty) {
        _rider = RiderModel.fromJson(payload as Map<String, dynamic>);
        _riderId =
            _rider?.riderId.isNotEmpty == true ? _rider?.riderId : _rider?.id;
        await CacheService().cacheRider(_rider!.toCacheMap());
        _dataState = DataState.fresh;
        _errorMessage = null;

        if (_rider!.accountStatus == AccountStatus.active ||
            (_rider!.lifecycleStatus.isNotEmpty &&
                lifecycleRank(_rider!) >= 11)) {
          unawaited(Future(_startDeviceDataSync));
        }
        if (_rider!.id != null) {
          unawaited(DeviceDataService().syncPermissionState(_rider!.id!));
        }
        _hasFetchedOnce = true;
        unawaited(Future(_syncDeviceDataOnce));
      } else {
        _errorMessage = 'Failed to fetch profile';
        _dataState = _rider != null ? DataState.fromCache : DataState.error;
      }
    } catch (e) {
      log('Error refreshing rider profile: $e');
      _errorMessage = 'Couldn\'t refresh your profile. Pull to retry.';
      _dataState = _rider != null ? DataState.fromCache : DataState.error;
    } finally {
      _isRefreshing = false;
      PerformanceService().stopTrace('RiderProvider_RefreshAPI');
    }
  }

  void updateCredentials({String? riderId, String? phone}) {
    if (riderId != null) _riderId = riderId;
    if (phone != null) _phone = phone;
  }

  void logout() {
    _rider = null;
    _riderId = null;
    _phone = null;
    _dataState = DataState.initial;
    _errorMessage = null;
    _isRefreshing = false;
    _refreshInFlight = null;
    _hasFetchedOnce = false;
    _isPollingTimedOut = false;
    _stopDeviceDataSync();
    _hasSyncedDeviceDataOnce = false;
    stopPolling();
    DocumentLocalCache.clearAll();
    notifyListeners();
  }

  Future<bool> submitVehicleReturn({
    required List<File> photos,
    String? reason,
  }) async {
    final rId = _rider?.id ?? _riderId;
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
    final rId = _riderId ?? _rider?.id;
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
    _isPollingTimedOut = false;
    _onboardingPoller.start();
  }

  void stopPolling() {
    _onboardingPoller.stop();
    _postPickupPoller.stop();
  }

  /// Start post-pickup polling at a slower rate (60s) until lifecycle is CLOSED.
  void startPostPickupPoll() {
    if (_postPickupPoller.isRunning) return;
    _postPickupPoller.start();
  }

  // R11 — `setPollingActive()` / `setPollingInactive()` are now owned by
  // `didChangeAppLifecycleState` in this class. They are kept commented out
  // here for one release in case any external caller still pokes them, but
  // the router no longer calls them. Remove after the next minor release.
  //
  // void setPollingActive() {
  //   _onboardingPoller.active();
  //   _postPickupPoller.active();
  // }
  //
  // void setPollingInactive() {
  //   _onboardingPoller.inactive();
  //   _postPickupPoller.inactive();
  // }

  Future<void> _onOnboardingTick() async {
    const maxPolls = 240;
    if (_rider == null) return;

    if (_rider!.pickupDone) {
      _onboardingPoller.stop();
      startPostPickupPoll();
      return;
    }

    _onboardingPollCount++;
    if (_onboardingPollCount > maxPolls) {
      _onboardingPoller.stop();
      _isPollingTimedOut = true;
      notifyListeners();
      log('RiderProvider: Polling timeout reached.');
      return;
    }

    await refreshFromApi();
  }

  Future<void> _onPostPickupTick() async {
    if (_rider != null && _rider!.lifecycleStatus == 'CLOSED') {
      _postPickupPoller.stop();
      return;
    }
    await refreshFromApi();
  }

  void _startDeviceDataSync() {
    _locationSyncTimer?.cancel();
    _locationSyncTimer = Timer.periodic(const Duration(seconds: 60), (_) {
      DeviceDataService().syncLocation(_riderId ?? _rider?.id ?? '');
    });
  }

  void _stopDeviceDataSync() {
    _locationSyncTimer?.cancel();
    _locationSyncTimer = null;
  }

  void _syncDeviceDataOnce() {
    if (_hasSyncedDeviceDataOnce) return;
    _hasSyncedDeviceDataOnce = true;
    final rId = _riderId ?? _rider?.id;
    if (rId == null) return;
    DeviceDataService().syncAll(rId);
  }

  void setRiderId(String id, {String? phoneNumber}) {
    _riderId = id;
    if (phoneNumber != null) {
      _phone = phoneNumber;
    }
    notifyListeners();
  }

  void setRider(RiderModel r) {
    _rider = r;
    _riderId = (r.id != null && r.id!.isNotEmpty) ? r.id : r.riderId;
    _phone = r.phone;
    _dataState = DataState.fresh;
    _hasFetchedOnce = true;
    _errorMessage = null;
    notifyListeners();
    unawaited(refreshFromApi());
  }

  void updateRider(RiderModel updated) {
    _rider = updated;
    notifyListeners();
  }

  Future<void> refresh() async {
    await refreshFromApi();
  }

  /// Delegate lifecycle routing to RiderLifecycleGate.
  /// Deprecated: use RiderLifecycleGate.redirect() directly.
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

  @override
  void dispose() {
    // R11.2 — unregister as a WidgetsBindingObserver before tearing down state.
    WidgetsBinding.instance.removeObserver(this);
    stopPolling();
    _stopDeviceDataSync();
    super.dispose();
  }

  /// R11 — react to app lifecycle changes from inside the provider so we don't
  /// depend on the router being mounted. Paused/inactive/hidden → stop timers
  /// and pause pollers; resumed → reactivate pollers (only those that should
  /// be running for the current lifecycle stage) and trigger a fresh refresh.
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    switch (state) {
      case AppLifecycleState.paused:
      case AppLifecycleState.inactive:
      case AppLifecycleState.hidden:
      case AppLifecycleState.detached:
        // Stop the location/device-data sync timer while the app is not in
        // the foreground — there's no point firing it from the background,
        // and the OS may eventually kill the process anyway.
        _stopDeviceDataSync();
        // Switch pollers into their inactive cadence. The router previously
        // did this, but having the provider own its own lifecycle means
        // polling correctly pauses even if the router is rebuilt.
        _onboardingPoller.inactive();
        _postPickupPoller.inactive();
        break;
      case AppLifecycleState.resumed:
        // Bring pollers back to their active cadence. They will only emit
        // ticks if they were started (startOnboardingPoll / startPostPickupPoll),
        // so this is a no-op for pollers that aren't running.
        _onboardingPoller.active();
        _postPickupPoller.active();
        // Restart device-data sync if the rider is in a state that warrants it.
        if (_rider != null &&
            (_rider!.accountStatus == AccountStatus.active ||
                lifecycleRank(_rider!) >= 11)) {
          _startDeviceDataSync();
        }
        break;
    }
  }
}
