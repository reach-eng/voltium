import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/utils/app_logger.dart';

void main() {
  // app_logger functions gate on kDebugMode which is true in test mode.
  // Since there's no return value and debugPrint has no injectable seam,
  // the best unit-level guarantee is "does not throw".
  group('appLog', () {
    test('does not throw with message only', () {
      expect(() => appLog('Test message'), returnsNormally);
    });

    test('does not throw with tag', () {
      expect(() => appLog('Test message', tag: 'AUTH'), returnsNormally);
    });

    test('does not throw with data', () {
      expect(() => appLog('Test message', data: {'key': 'value'}), returnsNormally);
    });
  });

  group('logApi', () {
    test('does not throw', () {
      expect(() => logApi('GET /api/rider', data: {'status': 200}), returnsNormally);
    });
  });

  group('logAuth', () {
    test('does not throw', () {
      expect(() => logAuth('OTP sent to 9876543210'), returnsNormally);
    });
  });

  group('logState', () {
    test('does not throw', () {
      expect(() => logState('RiderProvider: loaded'), returnsNormally);
    });
  });

  group('logError', () {
    test('does not throw with message only', () {
      expect(() => logError('Something went wrong'), returnsNormally);
    });

    test('does not throw with error and stack trace', () {
      final error = Exception('test error');
      final stackTrace = StackTrace.current;
      expect(() => logError('Error', error: error, stackTrace: stackTrace), returnsNormally);
    });
  });
}
