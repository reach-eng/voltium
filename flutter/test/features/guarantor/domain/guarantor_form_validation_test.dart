import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/features/guarantor/domain/form_validator.dart';

void main() {
  group('GuarantorFormValidator', () {
    test('All fields filled + phone verified + all 6 docs uploaded is valid',
        () {
      final missing = GuarantorFormValidator.validate(
        name: 'John',
        dob: '01/01/2000',
        phone: '1234567890',
        isPhoneVerified: true,
        fatherName: 'Father',
        motherName: 'Mother',
        address: '123 Street',
        aadhaarFrontUploaded: true,
        aadhaarBackUploaded: true,
        panUploaded: true,
        photoUploaded: true,
        videoUploaded: true,
        signatureUploaded: true,
      );
      expect(missing, isEmpty);
    });

    test('Missing guarantor name', () {
      final missing = GuarantorFormValidator.validate(
        name: ' ',
        dob: '01/01/2000',
        phone: '1234567890',
        isPhoneVerified: true,
        fatherName: 'Father',
        motherName: 'Mother',
        address: '123 Street',
        aadhaarFrontUploaded: true,
        aadhaarBackUploaded: true,
        panUploaded: true,
        photoUploaded: true,
        videoUploaded: true,
        signatureUploaded: true,
      );
      expect(missing.contains('Name'), isTrue);
    });

    test('Missing DOB', () {
      final missing = GuarantorFormValidator.validate(
        name: 'John',
        dob: '',
        phone: '1234567890',
        isPhoneVerified: true,
        fatherName: 'Father',
        motherName: 'Mother',
        address: '123 Street',
        aadhaarFrontUploaded: true,
        aadhaarBackUploaded: true,
        panUploaded: true,
        photoUploaded: true,
        videoUploaded: true,
        signatureUploaded: true,
      );
      expect(missing.contains('DOB'), isTrue);
    });

    test('Missing phone', () {
      final missing = GuarantorFormValidator.validate(
        name: 'John',
        dob: '01/01/2000',
        phone: '',
        isPhoneVerified: true,
        fatherName: 'Father',
        motherName: 'Mother',
        address: '123 Street',
        aadhaarFrontUploaded: true,
        aadhaarBackUploaded: true,
        panUploaded: true,
        photoUploaded: true,
        videoUploaded: true,
        signatureUploaded: true,
      );
      expect(missing.contains('Phone'), isTrue);
    });

    test('Phone entered but NOT verified via OTP', () {
      final missing = GuarantorFormValidator.validate(
        name: 'John',
        dob: '01/01/2000',
        phone: '1234567890',
        isPhoneVerified: false,
        fatherName: 'Father',
        motherName: 'Mother',
        address: '123 Street',
        aadhaarFrontUploaded: true,
        aadhaarBackUploaded: true,
        panUploaded: true,
        photoUploaded: true,
        videoUploaded: true,
        signatureUploaded: true,
      );
      expect(missing.contains('Phone Verified'), isTrue);
    });

    test('Missing father name', () {
      final missing = GuarantorFormValidator.validate(
        name: 'John',
        dob: '01/01/2000',
        phone: '1234567890',
        isPhoneVerified: true,
        fatherName: '  ',
        motherName: 'Mother',
        address: '123 Street',
        aadhaarFrontUploaded: true,
        aadhaarBackUploaded: true,
        panUploaded: true,
        photoUploaded: true,
        videoUploaded: true,
        signatureUploaded: true,
      );
      expect(missing.contains("Father's Name"), isTrue);
    });

    test('Missing mother name', () {
      final missing = GuarantorFormValidator.validate(
        name: 'John',
        dob: '01/01/2000',
        phone: '1234567890',
        isPhoneVerified: true,
        fatherName: 'Father',
        motherName: ' ',
        address: '123 Street',
        aadhaarFrontUploaded: true,
        aadhaarBackUploaded: true,
        panUploaded: true,
        photoUploaded: true,
        videoUploaded: true,
        signatureUploaded: true,
      );
      expect(missing.contains("Mother's Name"), isTrue);
    });

    test('Missing address', () {
      final missing = GuarantorFormValidator.validate(
        name: 'John',
        dob: '01/01/2000',
        phone: '1234567890',
        isPhoneVerified: true,
        fatherName: 'Father',
        motherName: 'Mother',
        address: '',
        aadhaarFrontUploaded: true,
        aadhaarBackUploaded: true,
        panUploaded: true,
        photoUploaded: true,
        videoUploaded: true,
        signatureUploaded: true,
      );
      expect(missing.contains('Address'), isTrue);
    });

    test('Missing Aadhaar front upload', () {
      final missing = GuarantorFormValidator.validate(
        name: 'John',
        dob: '01/01/2000',
        phone: '1234567890',
        isPhoneVerified: true,
        fatherName: 'Father',
        motherName: 'Mother',
        address: '123 Street',
        aadhaarFrontUploaded: false,
        aadhaarBackUploaded: true,
        panUploaded: true,
        photoUploaded: true,
        videoUploaded: true,
        signatureUploaded: true,
      );
      expect(missing.contains('Aadhaar Front'), isTrue);
    });

    test('Guarantor phone == rider phone', () {
      final missing = GuarantorFormValidator.validate(
        name: 'John',
        dob: '01/01/2000',
        phone: '1234567890',
        isPhoneVerified: true,
        fatherName: 'Father',
        motherName: 'Mother',
        address: '123 Street',
        aadhaarFrontUploaded: true,
        aadhaarBackUploaded: true,
        panUploaded: true,
        photoUploaded: true,
        videoUploaded: true,
        signatureUploaded: true,
        riderPhone: '1234567890',
      );
      expect(
          missing.contains('Guarantor phone cannot be the same as rider phone'),
          isTrue);
    });

    test('Phone < 10 digits', () {
      final missing = GuarantorFormValidator.validate(
        name: 'John',
        dob: '01/01/2000',
        phone: '123456789',
        isPhoneVerified: true,
        fatherName: 'Father',
        motherName: 'Mother',
        address: '123 Street',
        aadhaarFrontUploaded: true,
        aadhaarBackUploaded: true,
        panUploaded: true,
        photoUploaded: true,
        videoUploaded: true,
        signatureUploaded: true,
      );
      expect(missing.contains('Phone'), isTrue);
    });
  });
}
