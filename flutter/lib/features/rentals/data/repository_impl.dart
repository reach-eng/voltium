import 'package:voltium_rider/core/network/generated/api_client.dart';
import 'package:voltium_rider/core/network/generated/api_models.dart';
import '../domain/repository.dart';

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
    return _apiClient.postRiderPlans({
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
    return _apiClient.postRiderSyncPickup({
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
    // Return sync
    return {};
  }
}
