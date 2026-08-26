import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/features/guarantor/domain/entity.dart';

void main() {
  group('GuarantorStatus parsing', () {
    test('Parse DRAFT status', () {
      final json = {'guarantorStatus': 'DRAFT'};
      final entity = GuarantorEntity.fromJson(json);
      expect(entity.status, GuarantorStatus.draft);
    });

    test('Parse SUBMITTED status', () {
      final json = {'guarantorStatus': 'SUBMITTED'};
      final entity = GuarantorEntity.fromJson(json);
      expect(entity.status, GuarantorStatus.submitted);
    });

    test('Parse APPROVED status', () {
      final json = {'guarantorStatus': 'APPROVED'};
      final entity = GuarantorEntity.fromJson(json);
      expect(entity.status, GuarantorStatus.approved);
    });

    test('Parse REJECTED status', () {
      final json = {'guarantorStatus': 'REJECTED'};
      final entity = GuarantorEntity.fromJson(json);
      expect(entity.status, GuarantorStatus.rejected);
    });

    test('Parse INFO_REQUIRED', () {
      final json = {'guarantorStatus': 'INFO_REQUIRED'};
      final entity = GuarantorEntity.fromJson(json);
      expect(entity.status, GuarantorStatus.infoRequired);
    });

    test('Parse null/unknown -> draft', () {
      final json = {'guarantorStatus': null};
      final entity = GuarantorEntity.fromJson(json);
      expect(entity.status, GuarantorStatus.draft);

      final unknownJson = {'guarantorStatus': 'WEIRD_STATE'};
      final unknownEntity = GuarantorEntity.fromJson(unknownJson);
      expect(unknownEntity.status, GuarantorStatus.draft);
    });
  });

  group('isSubmitted flag', () {
    test('isSubmitted true for SUBMITTED', () {
      final entity = GuarantorEntity(status: GuarantorStatus.submitted);
      expect(entity.isSubmitted, isTrue);
    });

    test('isSubmitted true for APPROVED', () {
      final entity = GuarantorEntity(status: GuarantorStatus.approved);
      expect(entity.isSubmitted, isTrue);
    });

    test('isSubmitted false for DRAFT', () {
      final entity = GuarantorEntity(status: GuarantorStatus.draft);
      expect(entity.isSubmitted, isFalse);
    });

    test('isSubmitted false for REJECTED', () {
      final entity = GuarantorEntity(status: GuarantorStatus.rejected);
      expect(entity.isSubmitted, isFalse);
    });
  });
}
