/// Standard mock JSON data for E2E testing
class MockData {
  static const riderProfile = {
    'id': 'test-rider-id',
    'phone': '9876543210',
    'fullName': 'Test Rider',
    'email': 'test@example.com',
    'status': 'ACTIVE',
    'kycStatus': 'APPROVED',
    'createdAt': '2025-01-01T00:00:00Z',
    'documents': [],
  };

  static const riderEarnings = {
    'totalEarnings': 1500,
    'tripsCompleted': 25,
    'distanceCovered': 120.5,
  };

  static const riderSettings = {
    'notificationsEnabled': true,
    'biometricsEnabled': false,
    'themeMode': 'SYSTEM',
  };

  static const walletBalance = {
    'balance': 1400.0,
    'currency': 'INR',
    'lastUpdated': '2025-01-01T00:00:00Z',
  };

  static const walletTransactions = [
    {
      'id': 'txn-1',
      'amount': -150.0,
      'type': 'DEBIT',
      'description': 'Rental Payment',
      'date': '2025-01-01T10:00:00Z',
      'status': 'COMPLETED',
    },
    {
      'id': 'txn-2',
      'amount': 500.0,
      'type': 'CREDIT',
      'description': 'Top Up',
      'date': '2025-01-01T09:00:00Z',
      'status': 'COMPLETED',
    },
  ];

  static const activeRental = {
    'id': 'rental-1',
    'vehicleId': 'veh-1',
    'hubId': 'hub-1',
    'status': 'ACTIVE',
    'startTime': '2025-01-01T08:00:00Z',
    'plan': {
      'name': 'Daily Commute',
      'type': 'DAILY',
    },
  };

  static const hubsList = [
    {
      'id': 'hub-1',
      'name': 'Central Hub',
      'address': '123 Main St',
      'location': {'lat': 12.9716, 'lng': 77.5946},
      'availableVehicles': 5,
    },
  ];
}
