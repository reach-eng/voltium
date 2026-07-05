import 'dart:developer';
import 'dart:async';
import 'package:universal_io/io.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import '../features/profile/domain/repository.dart';
import '../features/rentals/domain/repository.dart';
import '../core/network/files_repository.dart';
import '../core/polling/polling_manager.dart';
import '../models/rider_model.dart';
import '../services/cache_service.dart';
import '../services/device_data_service.dart';
import '../services/performance_service.dart';
import '../services/fcm_service.dart';
import '../utils/lifecycle_rank.dart';

import '../app/app_state.dart';
import '../features/auth/presentation/rider_lifecycle_gate.dart';

export 'rider_provider.dart' show DataState;

enum DataState {
  initial,
  loading,
  fromCache,
  fresh,
  error,
}

class RiderProvider extends ChangeNotifier {
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

  bool _hasFetchedOnce = false;
  bool get hasFetchedOnce => _hasFetchedOnce;

  int _onboardingPollCount = 0;
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
      _riderId = _rider?.id;
      _phone = _rider?.phone;
      _dataState = DataState.fromCache;
      notifyListeners();
    }

    // Trigger fresh load in background
    refreshFromApi();
    PerformanceService().stopTrace('RiderProvider_Init');
  }

  Future<void> refreshFromApi() async {
    if (_isRefreshing) return;
    _isRefreshing = true;
    _errorMessage = null;
    notifyListeners();

    PerformanceService().startTrace('RiderProvider_RefreshAPI');

    if (_riderId == null && _phone == null) {
      _isRefreshing = false;
      notifyListeners();
      return;
    }

    try {
      final response = await _riderRepository.getRiderProfile();
      final payload = response['data'] ?? response['rider'] ?? response;
      if (payload != null && (payload as Map).isNotEmpty) {
        _rider = RiderModel.fromJson(payload as Map<String, dynamic>);
        await CacheService().cacheRider(_rider!.toCacheMap());
        _dataState = DataState.fresh;
        _errorMessage = null;

        if (_rider!.accountStatus == AccountStatus.active ||
            (_rider!.lifecycleStatus.isNotEmpty &&
                lifecycleRank(_rider!) >= 11)) {
          _startDeviceDataSync();
        }
        if (_rider!.id != null) {
          DeviceDataService().syncPermissionState(_rider!.id!);
        }
        _hasFetchedOnce = true;
        _syncDeviceDataOnce();
      } else {
        _errorMessage = 'Failed to fetch profile';
        _dataState = _rider != null ? DataState.fromCache : DataState.error;
      }
    } catch (e) {
      log('Error refreshing rider profile: $e');
      _errorMessage = e.toString();
      _dataState = _rider != null ? DataState.fromCache : DataState.error;
    } finally {
      _isRefreshing = false;
      PerformanceService().stopTrace('RiderProvider_RefreshAPI');
      notifyListeners();
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
    _hasFetchedOnce = false;
    _stopDeviceDataSync();
    _hasSyncedDeviceDataOnce = false;
    stopPolling();
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

  /// Lifecycle: app resumed / foreground.
  void setPollingActive() {
    _onboardingPoller.active();
    _postPickupPoller.active();
  }

  /// Lifecycle: app inactive / background.
  void setPollingInactive() {
    _onboardingPoller.inactive();
    _postPickupPoller.inactive();
  }

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
    _riderId = r.id;
    _phone = r.phone;
    notifyListeners();
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
      case LifecycleTarget.kycForm:
        return AuthState.userForm;
      case LifecycleTarget.guarantorForm:
        return AuthState.guarantorForm;
      case LifecycleTarget.preDashboard:
        return AuthState.preDashboard;
      case LifecycleTarget.dashboard:
        return AuthState.dashboard;
      case LifecycleTarget.suspended:
      case LifecycleTarget.terminated:
        return AuthState.preDashboard;
      case LifecycleTarget.unknown:
        return AuthState.login;
    }
  }

  @override
  void dispose() {
    stopPolling();
    _stopDeviceDataSync();
    super.dispose();
  }
}
