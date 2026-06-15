/// Abstract repository for vehicle rentals and bookings.
abstract class RentalRepository {
  /// Fetches the hubs.
  Future<Map<String, dynamic>> fetchHubs();

  /// Fetches vehicles in a hub.
  Future<Map<String, dynamic>> fetchVehicles(String hubId);

  /// Subscribes to a rental plan.
  Future<Map<String, dynamic>> subscribePlan({
    required String hubId,
    required String planId,
    required double securityDeposit,
  });

  /// Syncs pickup.
  Future<Map<String, dynamic>> syncPickup({
    required String vehicleId,
    required String hubId,
    required String bookingId,
  });

  /// Submits return photos.
  Future<Map<String, dynamic>> submitVehicleReturn({
    required String vehicleId,
    required String hubId,
    required List<String> photos,
  });
}
