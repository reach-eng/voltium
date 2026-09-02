/// Abstract repository for rider profile operations.
///
/// Only the two methods actually called from production (`getRiderProfile`
/// and `registerFCMToken`) are exposed. Other surfaces — earnings, settings,
/// device details, profile update, device-data sync — are reached directly
/// through `VoltiumApiClient` (see e.g. `KycRepository`,
/// `earnings_screen.dart`, `edit_profile_screen.dart`, `device_data_service.dart`).
/// Adding wrappers back here is fine; just make sure they're wired through
/// a provider first.
abstract class RiderRepository {
  /// Fetches the current rider profile data.
  Future<Map<String, dynamic>> getRiderProfile();

  /// Registers a push notification token.
  Future<void> registerFCMToken(String token);
}
