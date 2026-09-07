/// RIDER-FORMAT-2026-09-07 (P3-4): unit tests for the shared
/// `formatKycLabel` helper. Verifies the KYC pill wording is
/// consistent across the identity card and any future surface.
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/utils/kyc_label.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('formatKycLabel', () {
    test('SUBMITTED → "Under Review"', () {
      expect(formatKycLabel('SUBMITTED'), 'Under Review');
    });

    test('APPROVED → "Verified"', () {
      expect(formatKycLabel('APPROVED'), 'Verified');
    });

    test('VERIFIED → "Verified"', () {
      expect(formatKycLabel('VERIFIED'), 'Verified');
    });

    test('REJECTED → "Rejected"', () {
      expect(formatKycLabel('REJECTED'), 'Rejected');
    });

    test('PENDING → "Pending"', () {
      expect(formatKycLabel('PENDING'), 'Pending');
    });

    test('empty → "Pending"', () {
      expect(formatKycLabel(''), 'Pending');
    });

    test('lowercase variants are case-insensitive', () {
      expect(formatKycLabel('submitted'), 'Under Review');
      expect(formatKycLabel('approved'), 'Verified');
      expect(formatKycLabel('rejected'), 'Rejected');
    });
  });
}
