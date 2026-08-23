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
  ///
  /// PR-4 (F-011 — 2026-08-22 deep audit): pass [idempotencyKey] to
  /// dedupe retried submits. End-of-rental triggers the security-
  /// deposit refund path; a double-submit on a 504 retry would
  /// double-bill the rider for damages.
  ///
  /// PR-4 (F-013): the odometer is now a typed `int` field, not a
  /// substring stuffed into `reason`. The server is expected to
  /// recompute `{ odometerEnd - odometerStart } × rate/km` for
  /// excess-mileage billing; a free-text field was unauditable and
  /// let a rider type `0` to walk away owing nothing for 1,800 km.
  Future<Map<String, dynamic>> submitVehicleReturn({
    required List<String> photos,
    String? idempotencyKey,
    int? odometer,
    String? odometerPhotoUrl,
  });
}
