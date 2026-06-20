import 'package:voltium_rider/core/network/generated/api_client.dart';
import 'package:voltium_rider/features/rentals/domain/repository.dart';
import 'package:voltium_rider/services/voltium_api_service.dart';

/// Implementation of [RentalRepository] using the Voltium API.
class RentalRepositoryImpl implements RentalRepository {
  final VoltiumApiClient _apiClient;

  RentalRepositoryImpl(this._apiClient);

  @override
  Future<Map<String, dynamic>> fetchHubs() async {
    final response = await _apiClient.getAdminHubs();
    return response.toJson();
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
    required String vehicleId,
    required String hubId,
    required List<String> photos,
  }) async {
    // Delegate to the singleton service which routes to POST /api/rider/vehicle-return.
    return VoltiumApiService().submitVehicleReturn(
      riderId: vehicleId,
      photoUrls: photos,
    );
  }
}
