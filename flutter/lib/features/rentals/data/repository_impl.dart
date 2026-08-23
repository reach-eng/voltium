import 'package:voltium_rider/core/network/api_client.dart';
import 'package:voltium_rider/core/network/generated/api_client.dart';
import 'package:voltium_rider/features/rentals/domain/repository.dart';

/// Implementation of [RentalRepository] using the Voltium API.
class RentalRepositoryImpl implements RentalRepository {
  final ApiClient _client;
  final VoltiumApiClient _apiClient;

  RentalRepositoryImpl(this._client, this._apiClient);

  @override
  Future<Map<String, dynamic>> fetchHubs() async {
    return _apiClient.getRiderHubs();
  }

  @override
  Future<Map<String, dynamic>> fetchVehicles(String hubId) async {
    final response = await _apiClient.getVehicles(hubId);
    return response.toJson();
  }

  @override
  Future<Map<String, dynamic>> subscribePlan({
    required String hubId,
    required String planId,
    required double securityDeposit,
  }) async {
    return await _apiClient.postRiderPlans({
      'hubId': hubId,
      'planId': planId,
      'securityDeposit': securityDeposit,
    });
  }

  @override
  Future<Map<String, dynamic>> syncPickup({
    required String vehicleId,
    required String hubId,
    required String bookingId,
  }) async {
    return await _apiClient.postRiderSyncPickup({
      'vehicleId': vehicleId,
      'hubId': hubId,
      'bookingId': bookingId,
    });
  }

  @override
  Future<Map<String, dynamic>> submitVehicleReturn({
    required List<String> photos,
    String? idempotencyKey,
    int? odometer,
    String? odometerPhotoUrl,
  }) async {
    // PR-13: was a wrapper call to `VoltiumApiService.submitVehicleReturn`,
    // a 1-line pass-through to the generated `postRiderRentalReturn`.
    //
    // PR-VER-2026-08-06 (RENTAL P0-1 + P0-3): vehicleId/hubId were silently
    // dropped and riderId was fabricated — the server resolves rider + vehicle
    // from the session. The canonical body is now `{ returnPhotos, reason }`.
    //
    // PR-4 (F-011 — 2026-08-22 deep audit): the generated
    // `postRiderRentalReturn` does not accept an Idempotency-Key
    // header. We bypass it and call `_client.post('/api/rental/return',
    // ...)` directly with the key. The end-of-rental endpoint
    // triggers the security-deposit refund path; a double-submit
    // on a 504 retry would double-bill the rider for damages.
    //
    // PR-4 (F-013 — 2026-08-22 deep audit): the odometer is now a
    // top-level typed `int` field, not a substring stuffed into
    // `reason`. The server is expected to recompute
    // `{ odometerEnd - odometerStart } × rate/km` for excess-mileage
    // billing; the previous free-text field let a rider type `0`
    // and walk away owing nothing for 1,800 km.
    final key = idempotencyKey ?? ApiClient.newIdempotencyKey();
    final body = <String, dynamic>{
      'returnPhotos': photos,
      if (odometer != null) 'odometer': odometer,
      if (odometerPhotoUrl != null) 'odometerPhotoUrl': odometerPhotoUrl,
    };
    return _client.post(
      '/api/rental/return',
      body: body,
      idempotencyKey: key,
    );
  }
}
