import 'dart:async';
import 'package:universal_io/io.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:voltium_rider/core/network/api_client.dart' show ApiException;
import 'package:voltium_rider/core/network/generated/api_models.dart';
import 'package:voltium_rider/widgets/fade_up_widget.dart';
import 'package:voltium_rider/widgets/image_source_sheet.dart';
import 'package:voltium_rider/widgets/forms/forms.dart';
import '../widgets/edit_profile_widgets.dart';
import '../../../../theme/app_theme.dart';

import 'package:voltium_rider/core/state/rider_provider.dart'
    show riderProvider, riderRepositoryProvider;
import 'package:voltium_rider/core/state/riverpod_providers.dart' show voltiumApiClientProvider;
import 'package:voltium_rider/features/profile/presentation/providers/guarantor_verification_provider.dart';
import 'package:voltium_rider/models/rider_model.dart' show RiderModel;
import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:voltium_rider/theme/app_typography.dart';
import 'package:voltium_rider/utils/app_constants.dart';
import 'package:voltium_rider/utils/phone_validator.dart';
import 'package:voltium_rider/utils/toast.dart';

class EditProfileScreen extends ConsumerStatefulWidget {
  const EditProfileScreen({super.key});

  @override
  ConsumerState<EditProfileScreen> createState() => _EditProfileScreenState();
}

class _EditProfileScreenState extends ConsumerState<EditProfileScreen> {
  final _formKey = GlobalKey<FormState>();

  late TextEditingController _nameController;
  late TextEditingController _emailController;
  late TextEditingController _phoneController;
  late TextEditingController _fatherNameController;
  late TextEditingController _motherNameController;
  late TextEditingController _dobController;
  late TextEditingController _addressController;
  late TextEditingController _emergencyContactController;

  late TextEditingController _gNameController;
  late TextEditingController _gPhoneController;
  late TextEditingController _gAddressController;
  late TextEditingController _gOtpController;

  // Initial field tracking for dirty check (P0-2 / P1-3)
  String _initialName = '';
  String _initialEmail = '';
  String _initialFatherName = '';
  String _initialMotherName = '';
  String _initialDob = '';
  String _initialAddress = '';
  String _initialEmergencyContact = '';
  String _initialGName = '';
  String _initialGPhone = '';
  String _initialGAddress = '';

  XFile? _profileImage;

  // Guarantor OTP state
  bool _isSendingGOtp = false;
  bool _isVerifyingGOtp = false;
  bool _isGOtpSent = false;
  // EDIT-PROFILE-AUDIT P1-5 (2026-09-08): `_isGPhoneVerified` and
  // `_gPhoneReceipt` are now backed by `guarantorVerificationProvider`
  // (see `flutter/lib/features/profile/presentation/providers/
  // guarantor_verification_provider.dart`). Previously these were
  // widget state, so navigating away and back reset them — a
  // background kill after verify forced a full re-verify. The
  // provider is scoped to the rider session: `RiderLogoutOrchestrator`
  // calls `clear()` on logout, and the rider-ID change listener
  // in `build` clears on a different rider.
  //
  // The "verified" flag is derived, not stored:
  //   - branch 1: a fresh OTP verify has happened this session
  //     and the receipt is for the *current* controller text.
  //   - branch 2: no verify has happened yet AND the controller
  //     still shows the stored phone (the server already has
  //     this number, no receipt needed for an unchanged save).
  // `ref.watch` is used so a successful verify / a rebase that
  // calls `clear()` rebuilds the form and updates the gate.
  bool get _isGPhoneVerified {
    final v = ref.watch(guarantorVerificationProvider);
    final currentText = _gPhoneController.text;
    if (v.isVerified && v.verifiedForPhone == currentText) return true;
    if (v.receipt == null &&
        _initialGPhone.isNotEmpty &&
        currentText == _initialGPhone) {
      return true;
    }
    return false;
  }

  bool _isSaving = false;
  bool _isSaved = false;
  String? _originalGPhone;
  // Signed OTP receipt for a newly-verified guarantor number. The server
  // requires it whenever the submitted phone differs from the stored one.
  // Null when no verify has happened in this session, or when the
  // verified-for phone no longer matches the controller text (caller
  // should fall back to "no receipt" — the save path's receipt-required
  // check at `rider.use-cases.ts:1006` enforces server-side).
  String? get _gPhoneReceipt {
    final v = ref.watch(guarantorVerificationProvider);
    if (v.isVerified && v.verifiedForPhone == _gPhoneController.text) {
      return v.receipt;
    }
    return null;
  }

  // OTP Resend Cooldown (P1-5)
  int _resendCooldown = 0;
  Timer? _cooldownTimer;

  // EDIT-PROFILE-AUDIT P1-3 (2026-09-08): when a server-side
  // rider update lands mid-edit (post-PUT refresh, 30–60s
  // poller, admin correction), the controllers + initial
  // baselines are stale. This set tracks which fields are in
  // conflict with the new server value. The form shows a
  // banner + per-field highlight for any field in the set;
  // the rider can either type over the conflict (removing it
  // from the set on next edit) or accept the server value
  // (we silently rebase the field when the controller's text
  // matches the previous initial — i.e., the user hadn't
  // touched it).
  final Set<String> _conflictingFields = <String>{};
  bool get _hasConflicts => _conflictingFields.isNotEmpty;

  // AUDIT FIX (P2-2): Allowlist user-correctable messages from the server
  // (P0-4 typed RiderValidationError / lifecycle errors); fallback to generic message for internal 500s.
  static const _userCorrectablePrefixesOrMessages = [
    'Rider must be at least 18 years old',
    'Guarantor must be at least 18 years old',
    'Enter a valid date of birth',
    'Emergency contact cannot be your own number',
    'Enter a valid 10-digit Indian mobile number',
    'Guarantor phone cannot be the same as rider phone',
    'Guarantor phone verification is required. Please verify the new number with OTP first.',
    'Guarantor name and phone are required to save guarantor details',
    'Guarantor details cannot be edited once verified',
    'Cannot update another rider\'s profile',
    'Too many profile updates. Please try again later.',
    'Please enter a valid email address',
    'Invalid email',
  ];

  static bool _isUserCorrectableMessage(String msg) {
    if (_userCorrectablePrefixesOrMessages.contains(msg)) return true;
    if (msg.startsWith('Guarantor phone verification receipt is invalid')) return true;
    if (msg.startsWith('Enter a valid date of birth')) return true;
    if (msg.startsWith('DOB must be')) return true;
    if (msg.contains('must be an uploaded file key')) return true;
    if (msg.startsWith('Unrecognized field')) return true;
    return false;
  }

  // EDIT-PROFILE-AUDIT P1-5 (2026-09-08): tracks the rider
  // DB id at last rebase so the build-time `ref.listen` can
  // detect an in-app rider swap and clear the guarantor
  // verification state. Initialized in `initState`; read
  // + updated in the `ref.listen` callback.
  String? _lastRiderId;

  bool get _isDirty {
    if (_profileImage != null) return true;
    if (_nameController.text != _initialName) return true;
    if (_emailController.text != _initialEmail) return true;
    if (_fatherNameController.text != _initialFatherName) return true;
    if (_motherNameController.text != _initialMotherName) return true;
    if (_dobController.text != _initialDob) return true;
    if (_addressController.text != _initialAddress) return true;
    if (_emergencyContactController.text != _initialEmergencyContact)
      return true;
    if (_gNameController.text != _initialGName) return true;
    if (_gPhoneController.text != _initialGPhone) return true;
    if (_gAddressController.text != _initialGAddress) return true;
    return false;
  }

  Future<void> _pickImage() async {
    try {
      final source = await ImageSourceBottomSheet.show(context: context);
      if (source == null) return;
      final picker = ImagePicker();
      final image = await picker.pickImage(
        source: source,
        maxWidth: 1600,
        maxHeight: 1600,
        imageQuality: 85,
        requestFullMetadata: false,
      );
      if (image != null && mounted) {
        setState(() => _profileImage = image);
      }
    } catch (e) {
      if (mounted) {
        Toast.error(
          context,
          AppLocalizations.of(context)!.txtfailedToCapturePhoto,
        );
      }
    }
  }

  void _onFieldChanged() {
    if (mounted) {
      setState(() {});
    }
  }

  // EDIT-PROFILE-AUDIT P1-3 (2026-09-08): rebase on server-side
  // changes. Called by the `ref.listen` on the rider model.
  // For each text field, compare the new server value against
  // the controller text + the previous initial:
  //   - controller text == previous initial: user hasn't
  //     touched the field → silent rebase (update both
  //     controller text + previous initial to the new value,
  //     clear any conflict marker).
  //   - controller text != previous initial: user has
  //     touched the field → if the new server value differs
  //     from the controller text, mark as conflict (the
  //     banner + per-field highlight reads `_conflictingFields`).
  //     Otherwise (user happens to match the new server),
  //     clear the conflict marker and update the initial.
  void _rebaseFromServer(RiderModel server) {
    if (!mounted) return;

    // Helper: rebase one field. The `apply` callback is the
    // rebase action; `matchesController` checks whether the
    // controller text still equals the new server value (after
    // we rebase) so the rebase doesn't fire on an already-touched
    // field. The `controllerText` getter reads the current
    // controller text (we can't capture it at the call site
    // because the user might be typing).
    void rebase({
      required String field,
      required String newValue,
      required String Function() getCurrentControllerText,
      required String Function() getPreviousInitial,
      required void Function(String newInitial) setPreviousInitial,
    }) {
      final current = getCurrentControllerText();
      final previous = getPreviousInitial();
      if (current == previous) {
        // User hasn't touched → silent rebase.
        if (current != newValue) {
          // The controller's text must reflect the new server
          // value too, otherwise _isDirty would re-fire on the
          // next keystroke. We update the controller in a
          // way that doesn't disturb the user's caret.
          final controller = _controllerForField(field);
          if (controller != null && controller.text != newValue) {
            controller.text = newValue;
          }
        }
        setPreviousInitial(newValue);
        _conflictingFields.remove(field);
      } else if (current != newValue) {
        // User has touched AND the new server value differs from
        // the user's text → flag the conflict.
        _conflictingFields.add(field);
      } else {
        // User happens to match the new server value → no
        // conflict; update the initial so subsequent diffs
        // are against the server value, not the snapshot.
        setPreviousInitial(newValue);
        _conflictingFields.remove(field);
      }
    }

    rebase(
      field: 'fullName',
      newValue: server.name,
      getCurrentControllerText: () => _nameController.text,
      getPreviousInitial: () => _initialName,
      setPreviousInitial: (v) => _initialName = v,
    );
    rebase(
      field: 'email',
      newValue: server.email ?? '',
      getCurrentControllerText: () => _emailController.text,
      getPreviousInitial: () => _initialEmail,
      setPreviousInitial: (v) => _initialEmail = v,
    );
    rebase(
      field: 'fatherName',
      newValue: server.fatherName ?? '',
      getCurrentControllerText: () => _fatherNameController.text,
      getPreviousInitial: () => _initialFatherName,
      setPreviousInitial: (v) => _initialFatherName = v,
    );
    rebase(
      field: 'motherName',
      newValue: server.motherName ?? '',
      getCurrentControllerText: () => _motherNameController.text,
      getPreviousInitial: () => _initialMotherName,
      setPreviousInitial: (v) => _initialMotherName = v,
    );
    rebase(
      field: 'currentAddress',
      newValue: server.currentAddress ?? '',
      getCurrentControllerText: () => _addressController.text,
      getPreviousInitial: () => _initialAddress,
      setPreviousInitial: (v) => _initialAddress = v,
    );
    rebase(
      field: 'emergencyContact',
      newValue: server.emergencyContact ?? '',
      getCurrentControllerText: () => _emergencyContactController.text,
      getPreviousInitial: () => _initialEmergencyContact,
      setPreviousInitial: (v) => _initialEmergencyContact = v,
    );
    rebase(
      field: 'guarantorName',
      newValue: server.guarantorName ?? '',
      getCurrentControllerText: () => _gNameController.text,
      getPreviousInitial: () => _initialGName,
      setPreviousInitial: (v) => _initialGName = v,
    );
    rebase(
      field: 'guarantorPhone',
      newValue: server.guarantorPhone ?? '',
      getCurrentControllerText: () => _gPhoneController.text,
      getPreviousInitial: () => _initialGPhone,
      setPreviousInitial: (v) {
        _initialGPhone = v;
        // P1-3 + P1-5: if the controller text is now
        // different from the server's new phone, the
        // verified receipt (if any) is no longer
        // authoritative for what's currently displayed —
        // clear the verification state.
        if (_gPhoneController.text != server.guarantorPhone) {
          ref.read(guarantorVerificationProvider.notifier).clear();
        }
      },
    );
    rebase(
      field: 'guarantorAddress',
      newValue: server.guarantorAddress ?? '',
      getCurrentControllerText: () => _gAddressController.text,
      getPreviousInitial: () => _initialGAddress,
      setPreviousInitial: (v) => _initialGAddress = v,
    );
    // DOB: yyyy-MM-dd format. The rider's DOB is a DateTime?;
    // format it the same way initState does so the string
    // comparison in `_isDirty` is consistent.
    final serverDob = server.dob;
    final newDobStr = serverDob == null ? '' : _formatDob(serverDob);
    rebase(
      field: 'dob',
      newValue: newDobStr,
      getCurrentControllerText: () => _dobController.text,
      getPreviousInitial: () => _initialDob,
      setPreviousInitial: (v) => _initialDob = v,
    );
    if (mounted) {
      setState(() {});
    }
  }

  TextEditingController? _controllerForField(String field) {
    switch (field) {
      case 'fullName':
        return _nameController;
      case 'email':
        return _emailController;
      case 'fatherName':
        return _fatherNameController;
      case 'motherName':
        return _motherNameController;
      case 'dob':
        return _dobController;
      case 'currentAddress':
        return _addressController;
      case 'emergencyContact':
        return _emergencyContactController;
      case 'guarantorName':
        return _gNameController;
      case 'guarantorPhone':
        return _gPhoneController;
      case 'guarantorAddress':
        return _gAddressController;
      default:
        return null;
    }
  }

  @override
  void initState() {
    super.initState();
    final rider = ref.read(riderProvider).rider;

    _initialName = rider?.name ?? '';
    _initialEmail = rider?.email ?? '';
    _initialFatherName = rider?.fatherName ?? '';
    _initialMotherName = rider?.motherName ?? '';
    // AUDIT FIX: the API returns a full ISO timestamp
    // (1990-01-01T00:00:00.000) — display only the yyyy-MM-dd date part so
    // existing riders don't see a machine timestamp in the form, and so
    // `_isDirty` string comparison matches what the picker writes.
    _initialDob = rider?.dob == null ? '' : _formatDob(rider!.dob!);
    _initialAddress = rider?.currentAddress ?? '';
    _initialEmergencyContact = rider?.emergencyContact ?? '';
    _initialGName = rider?.guarantorName ?? '';
    _initialGPhone = rider?.guarantorPhone ?? '';
    _initialGAddress = rider?.guarantorAddress ?? '';

    _nameController = TextEditingController(text: _initialName);
    _emailController = TextEditingController(text: _initialEmail);
    _fatherNameController = TextEditingController(text: _initialFatherName);
    _motherNameController = TextEditingController(text: _initialMotherName);
    _dobController = TextEditingController(
      text: _initialDob,
    );
    _addressController = TextEditingController(text: _initialAddress);
    _emergencyContactController =
        TextEditingController(text: _initialEmergencyContact);
    // AUDIT FIX (P2-4): `_phoneController` is intentionally read-only in the UI
    // (primary phone is verified during auth and cannot be edited directly).
    // Thus it is excluded from dirty tracking (_isDirty) and listener registration,
    // but kept as a controller because `VoltiumTextField` requires one. Disposed in `dispose()`.
    _phoneController = TextEditingController(text: rider?.phone ?? '');
    _gNameController = TextEditingController(text: _initialGName);
    _gPhoneController = TextEditingController(text: _initialGPhone);
    _gAddressController = TextEditingController(text: _initialGAddress);
    _gOtpController = TextEditingController();

    // AUDIT FIX: `_originalGPhone` was never assigned (always null), which
    // made `phoneChanged` true for ANY non-empty value and forced OTP
    // re-verification — blocking save even when the number was untouched.
    _originalGPhone = _initialGPhone;

    // PR-AUDIT-2026-08-16 §4.1: register listener on all controllers so
    // that `_isDirty` recalculates immediately on any keystroke and the
    // top-app-bar Save action button enables / disables dynamically.
    // P3 fix: the OTP box is not persisted form state — listening to it
    // only caused pointless rebuilds (it never fed `_isDirty` anyway).
    // P2-4: `_phoneController` is omitted because it is read-only primary phone.
    final controllers = <TextEditingController>[
      _nameController,
      _emailController,
      _fatherNameController,
      _motherNameController,
      _dobController,
      _addressController,
      _emergencyContactController,
      _gNameController,
      _gPhoneController,
      _gAddressController,
    ];
    for (final c in controllers) {
      c.addListener(_onFieldChanged);
    }

    // EDIT-PROFILE-AUDIT P1-3 (2026-09-08): resubscribe to the
    // rider model on every build. A `refreshFromApi` mid-edit,
    // the 30–60s poller, or an admin correction can update
    // the rider; `ref.listen` (called from `build` per the
    // Riverpod pattern for `ConsumerStatefulWidget`) catches
    // those changes and triggers a rebase. Note: this is in
    // `initState` because the listen needs to be registered
    // before the first frame so we don't miss the first
    // server-rider arrival. The callback itself only
    // delegates to `_rebaseFromServer`, which compares the
    // new server value to the previous initial + the
    // controller text and either silently rebases (untouched
    // field) or flags a conflict (touched field).
    //
    // EDIT-PROFILE-AUDIT P1-5 (2026-09-08): the verified
    // guarantor receipt is rider-scoped. A different rider
    // (e.g., a logout + fresh login on a shared device, or
    // an admin-triggered rider swap) cannot reuse the
    // previous rider's receipt. Clear the provider state
    // when the rider's DB id changes. Logout already clears
    // via `RiderLogoutOrchestrator`; this listener covers
    // the in-app rider-id-change case.
    _lastRiderId = ref.read(riderProvider).rider?.id;
  }

  String _twoDigits(int n) => n.toString().padLeft(2, '0');
  String _formatDob(DateTime d) =>
      '${d.year.toString().padLeft(4, '0')}-${_twoDigits(d.month)}-${_twoDigits(d.day)}';

  void _startCooldown() {
    _resendCooldown = 30;
    _cooldownTimer?.cancel();
    _cooldownTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) {
        timer.cancel();
        return;
      }
      setState(() {
        if (_resendCooldown > 0) {
          _resendCooldown--;
        } else {
          timer.cancel();
        }
      });
    });
  }

  @override
  void dispose() {
    _cooldownTimer?.cancel();
    for (var controller in [
      _nameController,
      _emailController,
      _phoneController,
      _fatherNameController,
      _motherNameController,
      _dobController,
      _addressController,
      _emergencyContactController,
      _gNameController,
      _gPhoneController,
      _gAddressController,
      _gOtpController,
    ]) {
      controller.dispose();
    }
    super.dispose();
  }

  Future<void> _sendGuarantorOtp() async {
    if (_resendCooldown > 0) return;
    // P2 fix: tie the OTP cost to a named person — an unnamed number is
    // either a typo or an arbitrary third-party target for SMS.
    if (_gNameController.text.trim().isEmpty) {
      Toast.error(
        context,
        AppLocalizations.of(context)?.txtenterGuarantorNameBeforeOtp ??
            'Enter the guarantor name before sending an OTP.',
      );
      return;
    }
    final phone = _gPhoneController.text.replaceAll(RegExp(r'\D'), '');
    // EDIT-PROFILE-AUDIT P1-2 (2026-09-08): use the central
    // `isValidIndianMobile` helper. Same rule on the client
    // emergency validator, the OTP gate, the Zod schema
    // (server), and the server's manual check.
    if (!PhoneValidator.isValidIndianMobile(phone)) {
      Toast.error(
        context,
        AppLocalizations.of(context)!.txtenterAValid10DigitNumber,
      );
      return;
    }
    final rider = ref.read(riderProvider).rider;
    final riderPhoneDigits = (rider?.phone ?? '').replaceAll(RegExp(r'\D'), '');
    final cleanRiderPhone = riderPhoneDigits.length >= 10
        ? riderPhoneDigits.substring(riderPhoneDigits.length - 10)
        : riderPhoneDigits;
    if (phone == cleanRiderPhone) {
      Toast.error(
        context,
        AppLocalizations.of(context)!
            .txtguarantorPhoneCannotBeTheSameAsYourPhone,
      );
      return;
    }
    setState(() => _isSendingGOtp = true);
    try {
      // AUDIT FIX (P2-1): Reuse the provider-managed client instead of constructing
      // fresh ApiClient() instances that bypass connection pooling and TLS pinning.
      final res = await ref
          .read(voltiumApiClientProvider)
          .postAuthSendOtp(SendOtpRequest(
            phone: phone,
            type: 'GUARANTOR',
            guarantorName: _gNameController.text.trim(),
          ));
      final result = res.toJson();
      if (mounted) {
        setState(() {
          _isSendingGOtp = false;
          _isGOtpSent = true;
        });
        _startCooldown();
        Toast.success(
          context,
          AppLocalizations.of(context)!.txtotpSentToGuarantorPhone,
        );
        // Dev / test mode only: autofill echoed OTP
        if (!kReleaseMode &&
            const String.fromEnvironment('TEST_MODE') == 'true') {
          final devOtp = result['data']?['otp']?.toString();
          if (devOtp != null && devOtp.length == 6) {
            _gOtpController.text = devOtp;
          }
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isSendingGOtp = false);
        Toast.error(
          context,
          AppLocalizations.of(context)!.txtfailedToSendOtp,
        );
      }
    }
  }

  Future<void> _verifyGuarantorOtp() async {
    if (_gOtpController.text.length != 6) {
      Toast.error(
        context,
        AppLocalizations.of(context)!.txtenterThe6DigitOtp,
      );
      return;
    }
    final phone = _gPhoneController.text.replaceAll(RegExp(r'\D'), '');
    setState(() => _isVerifyingGOtp = true);
    try {
      // PR-13: was a wrapper call to
      // `VoltiumApiService.verifyPhone`, which was a 1-line
      // pass-through to `postAuthVerifyPhone` with a typed
      // request. The generated method returns a typed
      // `VerifyPhoneResponse`; the wrapper did `.toJson()` so
      // callers see a `Map<String, dynamic>`. Preserve that
      // shape here.
      final response =
          (await ref.read(voltiumApiClientProvider).postAuthVerifyPhone(
                    VerifyPhoneRequest(
                      phone: phone,
                      otp: _gOtpController.text,
                    ),
                  ))
              .toJson();
      final verified =
          response['data']?['verified'] == true || response['verified'] == true;
      if (!verified) {
        if (mounted) {
          setState(() => _isVerifyingGOtp = false);
          Toast.error(
            context,
            response['data']?['message']?.toString() ??
                AppLocalizations.of(context)!.txtinvalidOtp,
          );
        }
        return;
      }
      // Capture the server-issued signed receipt — it is the only
      // server-verifiable proof of OTP verification and must ride along
      // with the profile save when the number is new/changed.
      final receiptData = response['data'];
      final receipt = (receiptData is Map ? receiptData['receipt'] : null) ??
          response['receipt'];
      if (mounted) {
        setState(() {
          _isVerifyingGOtp = false;
          _isGOtpSent = false;
        });
        // EDIT-PROFILE-AUDIT P1-5 (2026-09-08): persist the
        // verified receipt in the provider so a background
        // kill or screen rebuild doesn't drop it. The phone
        // is stored alongside the receipt so a later edit to
        // a different number invalidates it.
        if (receipt is String && receipt.isNotEmpty) {
          ref.read(guarantorVerificationProvider.notifier).markVerified(
                phone: _gPhoneController.text,
                receipt: receipt,
              );
        } else {
          ref.read(guarantorVerificationProvider.notifier).clear();
        }
        Toast.success(
          context,
          AppLocalizations.of(context)!.txtguarantorPhoneVerified,
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isVerifyingGOtp = false);
        Toast.error(
          context,
          AppLocalizations.of(context)!.txtinvalidOtp,
        );
      }
    }
  }

  Future<void> _saveProfile() async {
    final provider = ref.read(riderProvider.notifier);
    // AUDIT FIX: `ref.watch` inside an event handler registers a spurious
    // build dependency — use `ref.read` in callbacks.
    final rider = ref.read(riderProvider).rider;
    if (rider == null || rider.riderId.isEmpty) return;

    if (!_formKey.currentState!.validate()) {
      return;
    }

    if (_gPhoneController.text.trim().isNotEmpty && !_isGPhoneVerified) {
      Toast.error(
        context,
        AppLocalizations.of(context)?.txtverifyGuarantorPhoneBeforeSave ??
            'Please verify the new guarantor phone number before saving.',
      );
      return;
    }
    // P1: the server requires the signed OTP receipt for any new/changed
    // guarantor number. A verified flag without a receipt (e.g. verified
    // against an older server that issued none) would 400 on save —
    // catch it here with a clear action instead.
    final cleanGPhone = _gPhoneController.text.replaceAll(RegExp(r'\D'), '');
    final cleanGOrig = _originalGPhone?.replaceAll(RegExp(r'\D'), '') ?? '';
    if (cleanGPhone.isNotEmpty &&
        cleanGPhone != cleanGOrig &&
        _gPhoneReceipt == null) {
      Toast.error(
        context,
        AppLocalizations.of(context)?.txtreverifyGuarantorPhoneBeforeSave ??
            'Please re-verify the guarantor phone number before saving.',
      );
      return;
    }

    setState(() => _isSaving = true);

    // EDIT-PROFILE-AUDIT P0-1 (real) (2026-09-08): declared
    // outside the try so the catch block can see the URL for
    // orphan cleanup. The variable is only assigned inside
    // the try (when upload succeeds) and is read in the
    // catch on PUT failure.
    String? uploadedPhotoUrl;
    try {
      final riderRepo = ref.read(riderRepositoryProvider);
      if (_profileImage != null) {
        // EDIT-PROFILE-AUDIT P1-1 (2026-09-08): routed
        // through `RiderRepository.uploadProfilePhoto`
        // instead of constructing `FilesRepository(ApiClient(),
        // VoltiumApiClient(ApiClient()))` inline. The provider
        // reuses the same `FilesRepository` instance that the
        // other surfaces use, so we no longer create two fresh
        // `ApiClient()` instances per save.
        uploadedPhotoUrl = await riderRepo.uploadProfilePhoto(
          File(_profileImage!.path),
          category: 'profile_photo',
        );
      }

      // AUDIT FIX (P2-5): skip sending guarantor keys when all match _original* / _initial*
      // (same normalization the server uses: digitsOf for phone, textOf for name/address).
      final gNameMatches = _gNameController.text.trim() == _initialGName.trim();
      final gPhoneMatches = cleanGPhone == cleanGOrig;
      final gAddressMatches =
          _gAddressController.text.trim() == _initialGAddress.trim();
      final allGuarantorMatch =
          gNameMatches && gPhoneMatches && gAddressMatches;

      // EDIT-PROFILE-AUDIT P1-1 (2026-09-08): routed through
      // `RiderRepository.updateProfile` instead of calling the
      // generated `VoltiumApiClient.putRiderProfile` directly.
      await riderRepo.updateProfile(
        riderId: rider.riderId,
        request: UpdateProfileRequest(
              riderId: rider.riderId,
              fullName: _nameController.text.trim(),
              email: _emailController.text.trim(),
              fatherName: _fatherNameController.text.trim(),
              motherName: _motherNameController.text.trim(),
              dob: _dobController.text.isNotEmpty ? _dobController.text : null,
              currentAddress: _addressController.text.trim(),
              emergencyContact: _emergencyContactController.text.trim(),
              guarantorName:
                  allGuarantorMatch ? null : _gNameController.text.trim(),
              guarantorPhone:
                  allGuarantorMatch ? null : _gPhoneController.text.trim(),
              guarantorPhoneReceipt:
                  allGuarantorMatch ? null : _gPhoneReceipt,
              guarantorAddress:
                  allGuarantorMatch ? null : _gAddressController.text.trim(),
              // EDIT-PROFILE-AUDIT P1-4 (2026-09-08): `riderPhoto`
              // alias removed. It's a legacy admin-view alias
              // (flatten-rider.ts:178 maps `kycProfile.riderPhoto`
              // for backwards-compat) and the server is the
              // canonical source of truth for it. Carrying it
              // on edit-profile silently overwrites any
              // admin-distinguished value. `profilePhoto` is the
              // single source of truth on the rider-side PUT.
              profilePhoto: uploadedPhotoUrl,
            ),
      );

      await provider.refreshFromApi();

      if (mounted) {
        _isSaved = true;
        setState(() => _isSaving = false);
        Toast.success(
          context,
          AppLocalizations.of(context)!.txtprofileUpdatedSuccessfully,
        );
        Navigator.pop(context);
      }
    } catch (e) {
      // EDIT-PROFILE-AUDIT P0-1 (real) (2026-09-08): if the
      // upload succeeded but the PUT failed, the file is
      // orphaned in storage (PII, billable, no rider row
      // references it). Best-effort delete before the toast.
      // AUDIT FIX (P2-1): routed through `RiderRepository.deleteUploadedFile`
      // instead of constructing a fresh `ApiClient()` instance.
      if (uploadedPhotoUrl != null) {
        try {
          final riderRepo = ref.read(riderRepositoryProvider);
          await riderRepo.deleteUploadedFile(uploadedPhotoUrl);
        } catch (_) {
          // Swallow; the user-visible error is the PUT failure.
        }
      }
      if (mounted) {
        setState(() => _isSaving = false);
        final rawMsg = (e is ApiException)
            ? e.message
            : e
                .toString()
                .replaceAll(
                    RegExp(r'^(ApiException(\([^)]*\))?:\s*|Exception:\s*|Error:\s*)'), '')
                .trim();
        // AUDIT FIX (P2-2 & P3): Map validation / user-correctable messages;
        // handle unrecognized field drift with helpful copy; fallback to generic localized message.
        final String displayMsg;
        if (rawMsg.startsWith('Unrecognized field') ||
            rawMsg.contains('Unrecognized key')) {
          displayMsg =
              'Some profile fields could not be saved. Please ensure your app is up to date.';
        } else if (_isUserCorrectableMessage(rawMsg)) {
          displayMsg = rawMsg;
        } else {
          displayMsg = AppLocalizations.of(context)
                  ?.txtfailedToUpdateProfilePleaseTryAgain ??
              'Failed to update profile. Please try again.';
        }
        Toast.error(context, displayMsg);
      }
    }
  }

  Future<bool> _showDiscardDialog(BuildContext ctx) async {
    final colors = AppColors.of(ctx);
    final discard = await showDialog<bool>(
      context: ctx,
      builder: (dialogCtx) => AlertDialog(
        backgroundColor: colors.card,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.radiusModal),
        ),
        title: Text(
          AppLocalizations.of(ctx)?.txtdiscardChangesTitle ??
              'Discard changes?',
          style: AppTypography.titleMedium.copyWith(color: colors.onSurface),
        ),
        content: Text(
          AppLocalizations.of(ctx)?.txtdiscardChangesBody ??
              'You have unsaved changes. Are you sure you want to discard them and exit?',
          style:
              AppTypography.bodyMedium.copyWith(color: colors.onSurfaceMuted),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogCtx, false),
            child: Text(
              AppLocalizations.of(ctx)?.txtkeepEditing ?? 'Keep Editing',
              style: TextStyle(color: colors.onSurfaceVariant),
            ),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(dialogCtx, true),
            style: FilledButton.styleFrom(backgroundColor: AppColors.error),
            // T-66: hardcoded English button label. Localised
            // via the new `txtdiscard` ARB key.
            child: Text(AppLocalizations.of(context)!.txtdiscard),
          ),
        ],
      ),
    );
    if (discard == true && ctx.mounted) {
      _isSaved = true;
      Navigator.pop(ctx);
      return true;
    }
    return false;
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final l10n = AppLocalizations.of(context)!;
    // EDIT-PROFILE-AUDIT P1-3 (2026-09-08): watch the
    // rider model so the screen rebuilds on server-side
    // updates. The rebase logic (silent for non-dirty
    // fields, banner for conflicts) lives in the
    // `ref.listen` below — `ref.watch` here is what makes
    // build a subscriber for the banner UI. The
    // `guarantorVerificationProvider` is watched
    // transitively via the `_isGPhoneVerified` and
    // `_gPhoneReceipt` getters (both called below in
    // `_buildGuarantorPhoneField` / the save flow).
    ref.watch(riderProvider.select((p) => p.rider));
    // EDIT-PROFILE-AUDIT P1-3 (2026-09-08): rebase on
    // server-side changes. `ref.listen` is the right tool for
    // side effects — `ref.watch` would just rebuild, and the
    // rebase work has to happen before build returns. We
    // compare the new rider's fields against the controller
    // text + the previous initial. Fields the user hasn't
    // touched (controller text == previous initial) get
    // silently rebased. Fields the user has touched
    // (controller text != previous initial) are added to
    // `_conflictingFields` and surfaced via the banner +
    // per-field highlight.
    ref.listen<RiderModel?>(
      riderProvider.select((p) => p.rider),
      (prev, next) {
        if (next == null) return; // no rider; nothing to rebase
        // EDIT-PROFILE-AUDIT P1-5 (2026-09-08): the verified
        // guarantor receipt is rider-scoped. If the rider's
        // DB id changed (a different rider on a shared device
        // or an admin-triggered swap), the previous receipt
        // is no longer authoritative — clear the provider
        // state. Logout already clears via
        // `RiderLogoutOrchestrator`; this listener covers
        // the in-app rider-id-change case.
        if (next.id != _lastRiderId) {
          _lastRiderId = next.id;
          ref.read(guarantorVerificationProvider.notifier).clear();
        }
        _rebaseFromServer(next);
      },
    );

    return PopScope(
      canPop: !_isDirty || _isSaved,
      onPopInvokedWithResult: (didPop, result) async {
        if (didPop) return;
        await _showDiscardDialog(context);
      },
      child: Scaffold(
        backgroundColor: colors.surface,
        appBar: AppBar(
          backgroundColor: colors.surface,
          elevation: 0,
          surfaceTintColor: Colors.transparent,
          leading: IconButton(
            tooltip: 'Back',
            icon: Icon(Icons.arrow_back, color: colors.onSurface),
            onPressed: () async {
              if (!_isDirty || _isSaved) {
                Navigator.maybePop(context);
              } else {
                await _showDiscardDialog(context);
              }
            },
          ),
          title: Text(
            l10n.txteditProfile,
            style: AppTypography.headingSmall.copyWith(color: colors.onSurface),
          ),
        ),
        body: Stack(
          children: [
            _buildMeshBackground(),
            SafeArea(
              child: Form(
                key: _formKey,
                child: Column(
                  children: [
                    Expanded(
                      child: SingleChildScrollView(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 24,
                          vertical: 16,
                        ),
                        child: Column(
                          children: [
                            // EDIT-PROFILE-AUDIT P1-3
                            // (2026-09-08): banner shown when
                            // a server-side rider update
                            // lands mid-edit. Surfaces the
                            // count of conflicting fields; the
                            // per-field highlight lives on the
                            // individual TextFields below (each
                            // checks `_conflictingFields.contains('field')`
                            // in the build path).
                            if (_hasConflicts)
                              _StaleSeedBanner(count: _conflictingFields.length),
                            FadeUpWidget(
                                delay: 0, child: _buildAvatarSection()),
                            const SizedBox(height: 32),
                            FadeUpWidget(
                              delay: 100,
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.stretch,
                                children: [
                                  EditProfileSectionHeader(
                                    title: l10n.txtpersonalDetails.toUpperCase(),
                                  ),
                                  VoltiumTextField(
                                    fieldKey: const Key('editFullNameField'),
                                    label: 'Full Name',
                                    hint: '',
                                    controller: _nameController,
                                    prefixIcon: const Icon(Icons.person_outline,
                                        size: 18),
                                    textCapitalization:
                                        TextCapitalization.words,
                                    validator: (v) {
                                      if (v == null || v.trim().length < 2) {
                                        return 'Enter a valid name (at least 2 characters)';
                                      }
                                      return null;
                                    },
                                  ),
                                  const SizedBox(height: 16),
                                  VoltiumTextField(
                                    fieldKey: const Key('editPhoneField'),
                                    label: 'Phone Number',
                                    hint: '',
                                    controller: _phoneController,
                                    prefixIcon: const Icon(Icons.phone_outlined,
                                        size: 18),
                                    suffixIcon: Icon(
                                      Icons.lock_outline,
                                      size: 16,
                                      color: colors.outlineVariant,
                                    ),
                                    keyboardType: TextInputType.phone,
                                    readOnly: true,
                                    helperText:
                                        'Primary phone is verified and cannot be edited directly.',
                                  ),
                                  const SizedBox(height: 16),
                                  VoltiumTextField(
                                    fieldKey: const Key('editEmailField'),
                                    label: 'Email Address',
                                    hint: '',
                                    controller: _emailController,
                                    prefixIcon: const Icon(Icons.email_outlined,
                                        size: 18),
                                    keyboardType: TextInputType.emailAddress,
                                    textCapitalization: TextCapitalization.none,
                                    validator: (v) {
                                      // Aligned with server z.email() source of truth
                                      if (v != null && v.trim().isNotEmpty) {
                                        final trimmed = v.trim();
                                        if (trimmed.contains('..') ||
                                            !RegExp(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$')
                                                .hasMatch(trimmed)) {
                                          return AppLocalizations.of(context)
                                                  ?.txtenterAValidEmailAddress ??
                                              'Enter a valid email address';
                                        }
                                      }
                                      return null;
                                    },
                                  ),
                                  const SizedBox(height: 16),
                                  VoltiumTextField(
                                    fieldKey: const Key('editFatherNameField'),
                                    label: 'Father\'s Name',
                                    hint: '',
                                    controller: _fatherNameController,
                                    prefixIcon: const Icon(
                                        Icons.family_restroom_outlined,
                                        size: 18),
                                    textCapitalization:
                                        TextCapitalization.words,
                                  ),
                                  const SizedBox(height: 16),
                                  VoltiumTextField(
                                    fieldKey: const Key('editMotherNameField'),
                                    label: 'Mother\'s Name',
                                    hint: '',
                                    controller: _motherNameController,
                                    prefixIcon: const Icon(
                                        Icons.family_restroom_outlined,
                                        size: 18),
                                    textCapitalization:
                                        TextCapitalization.words,
                                  ),
                                  const SizedBox(height: 16),
                                  VoltiumDateField(
                                    fieldKey: const Key('editDobField'),
                                    label: 'Date of Birth',
                                    hint: 'YYYY-MM-DD',
                                    controller: _dobController,
                                    onTap: () async {
                                      final firstDate = DateTime(1940);
                                      final now = DateTime.now();
                                      final lastDate =
                                          DateTime(now.year - 18, now.month, now.day);
                                      final parsed =
                                          (_dobController.text.isNotEmpty
                                                  ? DateTime.tryParse(
                                                      _dobController.text)
                                                  : null) ??
                                              DateTime(2000, 1, 1);
                                      final initialDate =
                                          parsed.isBefore(firstDate)
                                              ? firstDate
                                              : (parsed.isAfter(lastDate)
                                                  ? lastDate
                                                  : parsed);

                                      final picked = await showDatePicker(
                                        context: context,
                                        initialDate: initialDate,
                                        firstDate: firstDate,
                                        lastDate: lastDate,
                                        // BUG FIX (PR-B, 2026-08-28):
                                        // pass the active locale so the
                                        // picker's UI renders in Hindi
                                        // for hi-locale riders.
                                        locale: Localizations.localeOf(context),
                                      );
                                      if (picked != null) {
                                        setState(() {
                                          _dobController.text = _formatDob(picked);
                                        });
                                      }
                                    },
                                  ),
                                  const SizedBox(height: 16),
                                  VoltiumTextField(
                                    fieldKey: const Key('editAddressField'),
                                    label: 'Current Address',
                                    hint: '',
                                    controller: _addressController,
                                    prefixIcon: const Icon(Icons.home_outlined,
                                        size: 18),
                                    textCapitalization:
                                        TextCapitalization.sentences,
                                  ),
                                  const SizedBox(height: 16),
                                  VoltiumTextField(
                                    fieldKey:
                                        const Key('editEmergencyContactField'),
                                    label: 'Emergency Contact Number',
                                    hint: '',
                                    controller: _emergencyContactController,
                                    prefixIcon: const Icon(
                                        Icons.emergency_outlined,
                                        size: 18),
                                    keyboardType: TextInputType.phone,
                                    validator: (v) {
                                      final clean =
                                          v?.replaceAll(RegExp(r'\D'), '') ??
                                              '';
                                      if (clean.isNotEmpty &&
                                          !PhoneValidator.isValidIndianMobile(clean)) {
                                        return 'Enter a valid 10-digit Indian mobile number';
                                      }
                                      final rider =
                                          ref.read(riderProvider).rider;
                                      final riderPhone = rider != null
                                          ? rider.phone
                                              .replaceAll(RegExp(r'\D'), '')
                                          : '';
                                      if (clean.isNotEmpty &&
                                          clean == riderPhone) {
                                        return 'Emergency contact cannot be your own number';
                                      }
                                      return null;
                                    },
                                  ),
                                  Padding(
                                    padding:
                                        const EdgeInsets.only(left: 4, top: 4),
                                    child: Text(
                                      'Used to contact you in case of an emergency.',
                                      style: GoogleFonts.plusJakartaSans(
                                        fontSize: 12,
                                        color: AppColors.of(context)
                                            .onSurfaceVariant,
                                        fontStyle: FontStyle.italic,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(height: 32),
                            FadeUpWidget(
                              delay: 300,
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.stretch,
                                children: [
                                  EditProfileSectionHeader(
                                    title: l10n.txtguarantorDetails.toUpperCase(),
                                  ),
                                  VoltiumTextField(
                                    fieldKey:
                                        const Key('editGuarantorNameField'),
                                    label: 'Guarantor Name',
                                    hint: '',
                                    controller: _gNameController,
                                    prefixIcon: const Icon(
                                        Icons.shield_outlined,
                                        size: 18),
                                    textCapitalization:
                                        TextCapitalization.words,
                                  ),
                                  const SizedBox(height: 16),
                                  _buildGuarantorPhoneField(),
                                  const SizedBox(height: 16),
                                  VoltiumTextField(
                                    fieldKey:
                                        const Key('editGuarantorAddressField'),
                                    label: 'Guarantor Address',
                                    hint: '',
                                    controller: _gAddressController,
                                    prefixIcon: const Icon(Icons.home_outlined,
                                        size: 18),
                                    textCapitalization:
                                        TextCapitalization.sentences,
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(height: 32),
                            const FadeUpWidget(
                              delay: 500,
                              child: EditProfileAdminNote(),
                            ),
                            const SizedBox(height: 32),
                            FadeUpWidget(
                              delay: 600,
                              child: ElevatedButton(
                                key: const Key('submitProfileButton'),
                                onPressed: (_isSaving || !_isDirty)
                                    ? null
                                    : _saveProfile,
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: AppColors.primary,
                                  foregroundColor: Colors.white,
                                  disabledBackgroundColor:
                                      AppColors.primary.withValues(alpha: 0.4),
                                  disabledForegroundColor:
                                      Colors.white.withValues(alpha: 0.6),
                                  minimumSize: const Size(double.infinity, 56),
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(
                                        AppRadius.radiusModal),
                                  ),
                                  elevation: _isDirty ? 8 : 0,
                                  shadowColor:
                                      AppColors.primary.withValues(alpha: 0.4),
                                ),
                                child: _isSaving
                                    ? const SizedBox(
                                        width: 20,
                                        height: 20,
                                        child: CircularProgressIndicator(
                                          color: Colors.white,
                                          strokeWidth: 2,
                                        ),
                                      )
                                    : Text(
                                        'SUBMIT FOR APPROVAL',
                                        style: GoogleFonts.plusJakartaSans(
                                          fontWeight: FontWeight.w800,
                                          letterSpacing: 1.2,
                                        ),
                                      ),
                              ),
                            ),
                            const SizedBox(height: 48),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMeshBackground() {
    return Positioned.fill(
      child: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              AppColors.of(context).iconBackground,
              AppColors.of(context).surfaceBright
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildAvatarSection() {
    final colors = AppColors.of(context);
    final rider = ref.watch(riderProvider).rider;
    String? getAvatarUrl() {
      return AppConstants.resolveFileUrl(
        rider?.profilePhoto,
        isAndroid: Platform.isAndroid,
      );
    }

    final avatarUrl = getAvatarUrl();

    return Center(
      child: Stack(
        children: [
          Container(
            padding: Spacing.paddingXs,
            decoration: BoxDecoration(
              color: colors.card,
              shape: BoxShape.circle,
              border: Border.all(
                color: colors.outlineVariant.withValues(alpha: 0.5),
              ),
              boxShadow: const [
                BoxShadow(
                  color: Colors.black12,
                  blurRadius: 20,
                  offset: Offset(0, 10),
                ),
              ],
            ),
            child: CircleAvatar(
              radius: 54,
              backgroundColor: colors.iconBackground,
              child: _profileImage != null
                  ? ClipOval(
                      child: Image.file(
                        File(_profileImage!.path),
                        width: 108,
                        height: 108,
                        fit: BoxFit.cover,
                        // AUDIT FIX: decode at display resolution — the
                        // picked capture can be 1600×1600 (~10MB RGBA) but
                        // renders into a 108px circle.
                        cacheWidth: 216,
                        // AUDIT FIX (P2-8): errorBuilder fallback if temp file is deleted mid-render.
                        errorBuilder: (_, __, ___) => Container(
                          width: 108,
                          height: 108,
                          color: colors.iconBackground,
                          child: const Icon(
                            Icons.person,
                            size: 54,
                            color: AppColors.slate400,
                          ),
                        ),
                      ),
                    )
                  : avatarUrl != null
                      ? ClipOval(
                          child: CachedNetworkImage(
                            imageUrl: avatarUrl,
                            width: 108,
                            height: 108,
                            fit: BoxFit.cover,
                            placeholder: (_, __) =>
                                const CircularProgressIndicator(),
                            errorWidget: (_, __, ___) => const Icon(
                              Icons.person,
                              size: 54,
                              color: AppColors.slate400,
                            ),
                          ),
                        )
                      : const Icon(
                          Icons.person,
                          size: 54,
                          color: AppColors.slate400,
                        ),
            ),
          ),
          Positioned(
            right: 0,
            bottom: 0,
            child: GestureDetector(
              onTap: _pickImage,
              child: Container(
                padding: Spacing.paddingSm,
                decoration: const BoxDecoration(
                  color: AppColors.primary,
                  shape: BoxShape.circle,
                ),
                child:
                    const Icon(Icons.camera_alt, color: Colors.white, size: 20),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildGuarantorPhoneField() {
    final colors = AppColors.of(context);
    final cleanCurrent = _gPhoneController.text.replaceAll(RegExp(r'\D'), '');
    final cleanOrig = _originalGPhone?.replaceAll(RegExp(r'\D'), '') ?? '';
    final phoneChanged = cleanCurrent != cleanOrig && cleanCurrent.isNotEmpty;
    final needsVerification = phoneChanged && !_isGPhoneVerified;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(left: 4),
          child: Text(
            'Guarantor Phone',
            style: AppTypography.bodySmall
                .copyWith(fontWeight: FontWeight.w800)
                .copyWith(color: colors.onSurfaceMuted),
          ),
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            Expanded(
              child: Container(
                decoration: BoxDecoration(
                  color: colors.card,
                  borderRadius: BorderRadius.circular(AppRadius.lg),
                  border: Border.all(
                    color: colors.outlineVariant.withValues(alpha: 0.5),
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.02),
                      blurRadius: 10,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: TextFormField(
                  key: const Key('editGuarantorPhoneField'),
                  controller: _gPhoneController,
                  keyboardType: TextInputType.phone,
                  onChanged: (_) {
                    final curr =
                        _gPhoneController.text.replaceAll(RegExp(r'\D'), '');
                    final orig =
                        _originalGPhone?.replaceAll(RegExp(r'\D'), '') ?? '';
                    setState(() {
                      _isGOtpSent = false;
                      _gOtpController.clear();
                    });
                    // A new number needs a fresh receipt — drop the old
                    // one so a stale receipt can never authorize a new
                    // number. The `_isGPhoneVerified` getter reads from
                    // the provider; the new state is "unverified" for
                    // any new number (we don't infer verified from local
                    // text comparison — the receipt is the source of
                    // truth).
                    if (curr != orig || orig.isEmpty) {
                      ref.read(guarantorVerificationProvider.notifier)
                          .clear();
                    }
                  },
                  style: AppTypography.bodyLarge
                      .copyWith(fontWeight: FontWeight.w600)
                      .copyWith(color: colors.onSurface),
                  decoration: InputDecoration(
                    prefixIcon: Icon(
                      Icons.phone_android_outlined,
                      color: colors.onSurfaceVariant,
                      size: 18,
                    ),
                    suffixIcon: _isGPhoneVerified
                        ? const Icon(
                            Icons.check_circle,
                            color: AppColors.success,
                            size: 20,
                          )
                        : null,
                    border: InputBorder.none,
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 16,
                    ),
                  ),
                ),
              ),
            ),
            if (needsVerification) ...[
              const SizedBox(width: 8),
              SizedBox(
                height: 52,
                child: ElevatedButton(
                  onPressed: (_isSendingGOtp || _resendCooldown > 0)
                      ? null
                      : _sendGuarantorOtp,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    disabledBackgroundColor: AppColors.primaryLightBlue,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(AppRadius.lg),
                    ),
                    padding: const EdgeInsets.symmetric(horizontal: 14),
                  ),
                  child: _isSendingGOtp
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(
                            color: Colors.white,
                            strokeWidth: 2,
                          ),
                        )
                      : Text(
                          _resendCooldown > 0
                              ? '${_resendCooldown}s'
                              : (_isGOtpSent ? 'Resend' : 'Send OTP'),
                          style: GoogleFonts.plusJakartaSans(
                            fontSize: 13,
                            fontWeight: FontWeight.w800,
                            color: Colors.white,
                          ),
                        ),
                ),
              ),
            ],
          ],
        ),
        // OTP input section
        if (_isGOtpSent && !_isGPhoneVerified) ...[
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: Container(
                  decoration: BoxDecoration(
                    color: colors.card,
                    borderRadius: BorderRadius.circular(AppRadius.lg),
                    border: Border.all(
                      color: colors.outlineVariant.withValues(alpha: 0.5),
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.02),
                        blurRadius: 10,
                        offset: const Offset(0, 4),
                      ),
                    ],
                  ),
                  child: TextFormField(
                    controller: _gOtpController,
                    keyboardType: TextInputType.number,
                    maxLength: 6,
                    style: AppTypography.bodyLarge
                        .copyWith(fontWeight: FontWeight.w600)
                        .copyWith(color: colors.onSurface, letterSpacing: 8),
                    decoration: InputDecoration(
                      prefixIcon: Icon(
                        Icons.lock_outline,
                        color: colors.onSurfaceVariant,
                        size: 18,
                      ),
                      hintText: '••••••',
                      hintStyle: TextStyle(color: colors.onSurfaceMuted),
                      counterText: '',
                      border: InputBorder.none,
                      contentPadding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 16,
                      ),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              SizedBox(
                height: 52,
                child: ElevatedButton(
                  onPressed: _isVerifyingGOtp ? null : _verifyGuarantorOtp,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.success,
                    disabledBackgroundColor: AppColors.of(context).successLight,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(AppRadius.lg),
                    ),
                    padding: const EdgeInsets.symmetric(horizontal: 14),
                  ),
                  child: _isVerifyingGOtp
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(
                            color: Colors.white,
                            strokeWidth: 2,
                          ),
                        )
                      : Text(
                          'Verify',
                          style: GoogleFonts.plusJakartaSans(
                            fontSize: 11,
                            fontWeight: FontWeight.w800,
                            color: Colors.white,
                          ),
                        ),
                ),
              ),
            ],
          ),
        ],
        // Verified badge
        if (_isGPhoneVerified && phoneChanged) ...[
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              color: AppColors.of(context).successLight,
              borderRadius: BorderRadius.circular(AppRadius.sm),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.check_circle,
                    color: AppColors.success, size: 14),
                const SizedBox(width: 6),
                Text(
                  'Phone verified',
                  style: AppTypography.labelSmall
                      .copyWith(color: AppColors.of(context).onSurface),
                ),
              ],
            ),
          ),
        ],
      ],
    );
  }
}

// EDIT-PROFILE-AUDIT P1-3 (2026-09-08): top-of-form banner
// shown when a server-side rider update lands mid-edit and
// the form has fields whose controller text differs from
// the new server value. The banner is informational — the
// rider can either type over to override (the conflict marker
// stays, but the form is dirty with their value) or navigate
// away to discard their edits. A future iteration can add a
// "rebase this field" button per conflicting field; for now,
// the count is enough signal.
class _StaleSeedBanner extends StatelessWidget {
  final int count;
  const _StaleSeedBanner({required this.count});

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: colors.warningSurface,
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(
          color: colors.warningForeground.withValues(alpha: 0.4),
          width: 1,
        ),
      ),
      child: Row(
        children: [
          Icon(
            Icons.refresh_rounded,
            color: colors.warningForeground,
            size: 20,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              'Your profile was updated elsewhere. '
              '$count field${count == 1 ? '' : 's'} ${count == 1 ? 'is' : 'are'} '
              'now different from the server. Review before saving.',
              style: AppTypography.bodySmall.copyWith(
                color: colors.onSurface,
                height: 1.4,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
