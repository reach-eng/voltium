// PR-KYC-CORRECTION (2026-09-06): tests for the flagged-field taxonomy —
// alias normalization, form-order normalization, and the first-flagged
// step routing that backs the "Correct the details" deep link.

import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/features/kyc/data/kyc_fields.dart';

void main() {
  group('normalizeKycFieldKey', () {
    test('maps legacy server aliases onto canonical keys', () {
      expect(normalizeKycFieldKey('name'), 'fullName');
      expect(normalizeKycFieldKey('address'), 'currentAddress');
      expect(normalizeKycFieldKey('pan'), 'panCard');
      expect(normalizeKycFieldKey('selfie'), 'profilePhoto');
    });

    test('passes canonical keys through unchanged', () {
      expect(normalizeKycFieldKey('aadhaarFront'), 'aadhaarFront');
      expect(normalizeKycFieldKey('signature'), 'signature');
    });

    test('trims whitespace', () {
      expect(normalizeKycFieldKey('  fullName '), 'fullName');
    });
  });

  group('normalizeKycEditableFields', () {
    test('returns empty list for null or empty input', () {
      expect(normalizeKycEditableFields(null), isEmpty);
      expect(normalizeKycEditableFields([]), isEmpty);
    });

    test('drops unknown keys', () {
      expect(
        normalizeKycEditableFields(['aadhaarFront', 'bogusField']),
        ['aadhaarFront'],
      );
    });

    test('resolves aliases and de-duplicates', () {
      expect(
        normalizeKycEditableFields(['name', 'fullName', 'pan', 'panCard']),
        ['fullName', 'panCard'],
      );
    });

    test('re-orders into onboarding form order', () {
      // Admin sends arbitrary order; the rider form walks fields top-down.
      expect(
        normalizeKycEditableFields(['signature', 'dob', 'fullName']),
        ['fullName', 'dob', 'signature'],
      );
    });
  });

  group('firstFlaggedKycStep', () {
    test('defaults to step 1 when nothing is flagged', () {
      expect(firstFlaggedKycStep(null), 1);
      expect(firstFlaggedKycStep([]), 1);
      expect(firstFlaggedKycStep(['bogusField']), 1);
    });

    test('returns 1 for personal-detail fields', () {
      expect(firstFlaggedKycStep(['fullName']), 1);
      expect(firstFlaggedKycStep(['dob']), 1);
      expect(firstFlaggedKycStep(['currentAddress']), 1);
      expect(firstFlaggedKycStep(['name']), 1); // legacy alias
    });

    test('returns 2 for identity/bank fields', () {
      expect(firstFlaggedKycStep(['aadhaarFront']), 2);
      expect(firstFlaggedKycStep(['panCard']), 2);
      expect(firstFlaggedKycStep(['accountNumber']), 2);
    });

    test('returns 3 for selfie/signature fields', () {
      expect(firstFlaggedKycStep(['profilePhoto']), 3);
      expect(firstFlaggedKycStep(['signature']), 3);
    });

    test(
        'first field wins regardless of later steps being flagged',
        () {
      // The button takes the user to the FIRST ticked option — even when
      // later steps are also flagged.
      expect(firstFlaggedKycStep(['signature', 'fullName']), 1);
      expect(firstFlaggedKycStep(['panCard', 'signature']), 2);
    });
  });

  group('kycCorrectionFieldLabel', () {
    test('resolves canonical and legacy keys to labels', () {
      expect(kycCorrectionFieldLabel('fullName'), 'Full name');
      expect(kycCorrectionFieldLabel('name'), 'Full name');
      expect(kycCorrectionFieldLabel('aadhaarFront'), 'Aadhaar card (front)');
    });

    test('falls back to the raw key', () {
      expect(kycCorrectionFieldLabel('mysteryField'), 'mysteryField');
    });
  });
}
