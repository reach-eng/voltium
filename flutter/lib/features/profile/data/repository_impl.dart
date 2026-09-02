import 'package:voltium_rider/core/network/generated/api_client.dart';
import 'package:voltium_rider/features/profile/domain/repository.dart';
import '../../../utils/app_logger.dart';

/// Implementation of [RiderRepository] using the Voltium API.
///
/// Only wraps the two methods production actually calls. The previous
/// (ApiClient, VoltiumApiClient) two-arg constructor carried a dead
/// `ApiClient` parameter — it was only used by the long-removed
/// `getDeviceDetails` method. Mirrors the wallet-repository simplification
/// (PR-VER-2026-08-06 / wallet fix commit 305aa707).
class RiderRepositoryImpl implements RiderRepository {
  final VoltiumApiClient _apiClient;

  RiderRepositoryImpl(this._apiClient);

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
}
