import 'dart:io';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test(
      'Static check: PersonalDetailsCard fields are in the required reordered sequence',
      () {
    final file = File(
        'lib/features/kyc/presentation/widgets/personal_details_card.dart');
    expect(file.existsSync(), isTrue,
        reason: 'personal_details_card.dart must exist');

    final content = file.readAsStringSync();

    final fullNameIdx = content.indexOf("Key('fullNameField')");
    final fatherNameIdx = content.indexOf("Key('fatherNameField')");
    final motherNameIdx = content.indexOf("Key('motherNameField')");
    final dobIdx = content.indexOf("Key('dobField')");
    final emailIdx = content.indexOf("Key('emailField')");
    final addressIdx = content.indexOf("Key('addressField')");

    expect(fullNameIdx, isNonNegative, reason: 'fullNameField key must exist');
    expect(fatherNameIdx, isNonNegative,
        reason: 'fatherNameField key must exist');
    expect(motherNameIdx, isNonNegative,
        reason: 'motherNameField key must exist');
    expect(dobIdx, isNonNegative, reason: 'dobField key must exist');
    expect(emailIdx, isNonNegative, reason: 'emailField key must exist');
    expect(addressIdx, isNonNegative, reason: 'addressField key must exist');

    // Expected sequence: Name -> Father -> Mother -> DOB -> Email -> Phone -> Address
    expect(fullNameIdx < fatherNameIdx, isTrue,
        reason: 'fullName must come before fatherName');
    expect(fatherNameIdx < motherNameIdx, isTrue,
        reason: 'fatherName must come before motherName');
    expect(motherNameIdx < dobIdx, isTrue,
        reason: 'motherName must come before dob');
    expect(dobIdx < emailIdx, isTrue, reason: 'dob must come before email');
    expect(emailIdx < addressIdx, isTrue,
        reason: 'email must come before address');
  });
}
