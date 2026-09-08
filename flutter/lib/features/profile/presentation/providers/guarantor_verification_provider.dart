import 'package:flutter_riverpod/flutter_riverpod.dart';

/// EDIT-PROFILE-AUDIT P1-5 (2026-09-08): holds the guarantor
/// phone-OTP verification state — the signed receipt the
/// server requires for changed-number saves, and the phone
/// number the receipt was issued for.
///
/// Previously this lived in `EditProfileScreen` widget state
/// (`_gPhoneReceipt` / `_isGPhoneVerified`), so navigating
/// away and back reset both: a background kill after verify
/// forced a full re-verify, and the only hint that the rider
/// had been verified was the save-time toast (which fires
/// only on save).
///
/// Now the receipt is stored in this provider, scoped to the
/// session. The notifier's `clear()` is invoked by the
/// `RiderLogoutOrchestrator` on logout and by the
/// edit-profile screen on a rider-ID change (a different
/// rider cannot reuse the previous rider's receipt).
///
/// The screen derives the "is the displayed phone currently
/// verified?" flag from `(receipt != null && verifiedForPhone
/// == currentControllerText) || (receipt == null &&
/// currentControllerText == initialStoredPhone &&
/// initialStoredPhone.isNotEmpty)`. The first branch covers
/// "user just OTP-verified this number"; the second covers
/// "no verify needed, the server already has this number."
/// The second branch is consumed only on the first edit —
/// after any successful verify the provider holds the
/// receipt and the first branch takes over.
class GuarantorVerification {
  /// The signed OTP receipt returned by the server on
  /// `verify-phone`. Required by the server when the
  /// guarantor phone changes. Null means no fresh verify
  /// has happened in this session.
  final String? receipt;

  /// The phone number the [receipt] was issued for. Storing
  /// the phone alongside the receipt prevents a stale
  /// receipt from authorizing a different number (e.g.,
  /// user verifies 99999, edits to 88888 without re-OTP).
  final String? verifiedForPhone;

  const GuarantorVerification({
    this.receipt,
    this.verifiedForPhone,
  });

  /// True if [receipt] is set and was issued for
  /// [verifiedForPhone]. The screen compares
  /// [verifiedForPhone] against the controller text to decide
  /// whether the receipt is still authoritative.
  bool get isVerified => receipt != null && verifiedForPhone != null;
}

/// EDIT-PROFILE-AUDIT P1-5 (2026-09-08).
class GuarantorVerificationNotifier extends Notifier<GuarantorVerification> {
  @override
  GuarantorVerification build() => const GuarantorVerification();

  /// Records a successful verify for [phone]. The receipt is
  /// required by the server when the submitted guarantor
  /// phone differs from the stored one. The phone is stored
  /// so a later controller edit to a different number
  /// invalidates the receipt.
  void markVerified({required String phone, required String receipt}) {
    state = GuarantorVerification(receipt: receipt, verifiedForPhone: phone);
  }

  /// Clears the receipt. Called on logout (via
  /// `RiderLogoutOrchestrator`) and on rider-ID change
  /// (a different rider cannot reuse the previous rider's
  /// receipt).
  void clear() {
    state = const GuarantorVerification();
  }
}

final guarantorVerificationProvider =
    NotifierProvider<GuarantorVerificationNotifier, GuarantorVerification>(
  GuarantorVerificationNotifier.new,
);
