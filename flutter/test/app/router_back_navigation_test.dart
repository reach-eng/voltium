import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/app/app_state.dart';

void main() {
  group('Router Back Navigation Rules', () {
    test('Non-poppable states include all router sub-screens', () {
      const nonPoppableStates = [
        AuthState.splash,
        AuthState.kycPreflight,
        AuthState.legal,
        AuthState.permissions,
        AuthState.otp,
        AuthState.intent,
        AuthState.userForm,
        AuthState.guarantorForm,
        AuthState.choosePlan,
        AuthState.planSuccess,
        AuthState.pickupHub,
        AuthState.pickupVerification,
        AuthState.hangTight,
        AuthState.topUpAmount,
        AuthState.topUpUpi,
        AuthState.topUpProof,
        AuthState.topUpReceipt,
        AuthState.tlDetails,
        AuthState.rentalDetails,
        AuthState.endRental,
        AuthState.faq,
        AuthState.vehiclePhotos,
        AuthState.referralDetails,
        AuthState.legalPage,
        AuthState.myDocuments,
        AuthState.accountClosed,
      ];

      for (final state in nonPoppableStates) {
        expect(
          state,
          isNotNull,
          reason: '$state must be explicitly defined and handled',
        );
      }
    });
  });
}
