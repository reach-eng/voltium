/// Abstract repository for rider profile operations.
abstract class RiderRepository {
  /// Fetches the current rider profile data.
  Future<Map<String, dynamic>> getRiderProfile();

  /// Updates the rider profile fields.
  Future<void> updateRiderProfile(Map<String, dynamic> data);

  /// Registers a push notification token.
  Future<void> registerFCMToken(String token);

  /// Synchronizes device data for compliance checking.
  Future<void> syncDeviceData(Map<String, dynamic> data);

  /// Fetches rider earnings.
  Future<Map<String, dynamic>> getEarnings();

  /// Fetches global rider app settings.
  Future<Map<String, dynamic>> getSettings();

  /// Fetches native device policy status.
  Future<Map<String, dynamic>> getDeviceDetails();
}
