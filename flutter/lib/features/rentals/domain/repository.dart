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
  ///
  /// PR-VER-2026-08-06 (RENTAL P0-3): the old signature took `vehicleId` and
  /// `hubId` that were silently discarded (the server resolves the rider and
  /// vehicle from the session) — a footgun that encouraged callers to pass
  /// garbage. Identity now comes from the session only.
  Future<Map<String, dynamic>> submitVehicleReturn({
    required List<String> photos,
  });
}
