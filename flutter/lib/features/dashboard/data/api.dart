import 'package:voltium_rider/core/network/api_client.dart';

/// API data source for dashboard operations.
class DashboardApi {
  final ApiClient _client;

  DashboardApi(this._client);

  Future<Map<String, dynamic>> getDashboard(String riderDbId) {
    return _client.get('/api/rider/dashboard', queryParams: {'riderId': riderDbId});
  }
}
