import 'dart:async';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import '../features/profile/domain/repository.dart';
import '../features/rentals/domain/repository.dart';
import '../core/network/files_repository.dart';
import '../models/rider_model.dart';
import '../services/cache_service.dart';
import '../services/device_data_service.dart';
import '../services/performance_service.dart';
import '../services/fcm_service.dart';

import '../app/router.dart';

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
        _filesRepository = filesRepository;

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

  bool _isPolling = false;
  Timer? _pollTimer;
  Timer? _locationSyncTimer;
  bool _hasSyncedDeviceDataOnce = false;

  bool get isPlanActive => _rider?.rentalStatus == RentalStatus.ACTIVE;
  bool get isKycDone => _rider?.kycStatus == KycStatus.APPROVED;
  bool get isActuallyActive => _rider?.accountStatus == AccountStatus.ACTIVE;

  Future<void> init() async {
    PerformanceService().startTrace('RiderProvider_Init');
    
    // Attempt cache read
    final cached = await CacheService().getRider();
    if (cached != null) {
      _rider = RiderModel.fromJson(cached);
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
      if (payload != null) {
        _rider = RiderModel.fromJson(payload as Map<String, dynamic>);
        await CacheService().cacheRider(_rider!.toCacheMap());
        _dataState = DataState.fresh;
        _errorMessage = null;

        if (_rider!.accountStatus == AccountStatus.ACTIVE) {
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
      debugPrint('Error refreshing rider profile: $e');
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

  Future<bool> submitVehicleReturn(
      {required List<File> photos, String? reason}) async {
    final rId = _rider?.id ?? _riderId;
    if (rId == null) return false;
    try {
      final List<String> photoUrls = [];
      for (final photo in photos) {
        final url = await _filesRepository.uploadFile(photo, 'vehicle_return');
        photoUrls.add(url);
      }
      final response = await _rentalRepository.submitVehicleReturn(
          vehicleId: '', hubId: '', photos: photoUrls);
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
      debugPrint('Failed to register FCM token: $e');
    }
  }

  void startOnboardingPoll() {
    if (_isPolling) return;
    _isPolling = true;
    _poll();
  }

  void stopPolling() {
    _isPolling = false;
    _pollTimer?.cancel();
    _pollTimer = null;
  }

  Future<void> _poll() async {
    int pollCount = 0;
    const maxPolls = 240;
    while (_isPolling &&
        _rider != null &&
        !_rider!.pickupDone &&
        pollCount < maxPolls) {
      await Future.doWhile(() async {
        final completer = Completer<void>();
        _pollTimer = Timer(const Duration(seconds: 30), completer.complete);
        await completer.future;
        return _isPolling;
      });
      if (!_isPolling) break;
      await refreshFromApi();
      pollCount++;
    }
    _isPolling = false;
    _pollTimer?.cancel();
    _pollTimer = null;
    if (pollCount >= maxPolls && _rider != null && !_rider!.pickupDone) {
      debugPrint('RiderProvider: Polling timeout reached.');
    }
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

  void forceLogin() {
    _rider = const RiderModel(
      id: 'debug-rider-id',
      riderId: 'rider_debug',
      phone: '+919999999999',
      name: 'Debug Rider',
      registrationDone: true,
      depositDone: true,
      kycDone: true,
      planDone: true,
      pickupDone: true,
    );
    _riderId = 'debug-rider-id';
    _phone = '+919999999999';
    _dataState = DataState.fresh;
    notifyListeners();
  }

  Future<void> refresh() async {
    await refreshFromApi();
  }

  AuthState routeAfterLogin(RiderModel r) {
    if (r.pickupDone) {
      return AuthState.dashboard;
    }
    if (r.intent == null || r.intent!.isEmpty || !r.registrationDone) {
      return AuthState.intent;
    }
    if (!r.kycDone) {
      return AuthState.userForm;
    }
    if (r.guarantorStatus == GuarantorStatus.PENDING) {
      return AuthState.guarantorForm;
    }
    return AuthState.preDashboard;
  }
}
