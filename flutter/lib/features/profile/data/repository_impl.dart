import 'dart:io';
import 'package:voltium_rider/core/network/files_repository.dart';
import 'package:voltium_rider/core/network/generated/api_client.dart';
import 'package:voltium_rider/features/profile/domain/repository.dart';
import '../../../utils/app_logger.dart';

/// Implementation of [RiderRepository] using the Voltium API.
///
/// EDIT-PROFILE-AUDIT P1-1 (2026-09-08): now wraps the edit-profile
/// save path (`updateProfile` + `uploadProfilePhoto`) so the
/// screen has a real seam to fake. The previous (ApiClient,
/// VoltiumApiClient) two-arg constructor carried a dead
/// `ApiClient` parameter — it was only used by the long-removed
/// `getDeviceDetails` method. Mirrors the wallet-repository
/// simplification (PR-VER-2026-08-06 / wallet fix commit
/// 305aa707).
class RiderRepositoryImpl implements RiderRepository {
  final VoltiumApiClient _apiClient;
  final FilesRepository? _filesRepository;

  RiderRepositoryImpl(this._apiClient, [this._filesRepository]);

  @override
  Future<Map<String, dynamic>> getRiderProfile() async {
    try {
      final response = await _apiClient.getRiderProfile();
      return {
        'success': true,
        'data': response.toJson(),
        'rider': response.toJson(),
      };
    } catch (e) {
      appDebug('GET_RIDER_PROFILE_ERROR: $e');
      rethrow;
    }
  }

  @override
  Future<void> registerFCMToken(String fcmToken) async {
    // Body must match `registerTokenSchema` in web/src/lib/validators.ts
    // (BLOCKER 1.2): the server derives the riderId from the verified
    // session, not from this body, so we send only fcmToken.
    await _apiClient.postRidersRegisterToken({'fcmToken': fcmToken});
  }

  @override
  Future<void> updateProfile({
    required String riderId,
    required dynamic request,
  }) async {
    // The generated client exposes a typed `putRiderProfile`
    // method. We pass through the request the screen built
    // (it knows the field semantics). The riderId is also
    // in the request body for legacy clients; the server
    // validates it against the session.
    await _apiClient.putRiderProfile(request);
  }

  @override
  Future<String> uploadProfilePhoto(
    dynamic file, {
    required String category,
  }) async {
    // Thin pass-through to the existing `FilesRepository`. The
    // screen no longer constructs `FilesRepository` inline
    // with two fresh `ApiClient()` instances per save; the
    // provider-managed instance is reused.
    if (_filesRepository == null) {
      throw StateError('FilesRepository not provided');
    }
    return _filesRepository.uploadFile(file as File, category);
  }

  @override
  Future<void> deleteUploadedFile(String url) async {
    await _filesRepository?.deleteFile(url);
  }
}
