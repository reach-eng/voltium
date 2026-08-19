import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/features/guarantor/domain/form_validator.dart';

/// PR-A (§4.2 / audit #7 P0-2): the guarantor phone-verification UI must
/// trust the server's verdict. The server returns `{ verified: bool }`
/// (top-level or under `data`) — a wrong OTP is `{ verified: false, message }`.
/// The extracted parser [verifyPhoneResponseVerified] is the single source of
/// truth used by `GuarantorOnboardingScreen._verifyOtp`.
void main() {
  group('verifyPhoneResponseVerified', () {
    test('accepts a verified response nested under data', () {
      expect(
        verifyPhoneResponseVerified({
          'data': {'verified': true},
        }),
        isTrue,
      );
    });

    test('accepts a verified response at the top level', () {
      expect(
        verifyPhoneResponseVerified({'verified': true}),
        isTrue,
      );
    });

    test('rejects a wrong-OTP response even when it carries a message', () {
      expect(
        verifyPhoneResponseVerified({
          'data': {'verified': false, 'message': 'Invalid OTP'},
        }),
        isFalse,
      );
    });

    test('rejects an empty or malformed response (fail closed)', () {
      expect(verifyPhoneResponseVerified({}), isFalse);
      expect(verifyPhoneResponseVerified({'verified': false}), isFalse);
      expect(verifyPhoneResponseVerified({'data': null}), isFalse);
      expect(
          verifyPhoneResponseVerified({
            'data': {'verified': 'yes'}
          }),
          isFalse);
    });
  });
}
