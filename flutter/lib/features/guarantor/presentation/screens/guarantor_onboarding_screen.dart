import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:universal_io/io.dart';
import 'package:voltium_rider/utils/app_constants.dart';
import 'package:voltium_rider/core/network/api_client.dart';
import 'package:voltium_rider/core/network/generated/api_client.dart';
import 'package:voltium_rider/core/network/generated/api_models.dart';
import 'package:voltium_rider/core/network/files_repository.dart';
import 'package:voltium_rider/widgets/image_source_sheet.dart';
import 'package:voltium_rider/services/image_compression_service.dart';
import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:voltium_rider/services/document_local_cache.dart';
import 'package:voltium_rider/features/kyc/presentation/screens/signature_pad_screen.dart';
import 'package:voltium_rider/features/guarantor/presentation/widgets/guarantor_onboarding_widgets.dart';
import 'package:voltium_rider/theme/app_theme.dart';
import 'package:voltium_rider/features/pickup/widgets/pickup_hub_widgets.dart';
import 'package:voltium_rider/features/guarantor/domain/form_validator.dart';
import 'package:voltium_rider/features/guarantor/data/guarantor_cache.dart';
import 'package:voltium_rider/utils/toast.dart';
import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/theme/app_typography.dart';
import 'package:voltium_rider/core/observability/posthog_service.dart';
import '../../../../utils/app_logger.dart';

/// State for GuarantorOnboardingScreen managed via Riverpod Notifier.
class GuarantorOnboardingState {
  final int currentStep;
  final bool isUploading;
  final String uploadProgressText;

  final bool isSendingOtp;
  final bool isVerifyingOtp;
  final bool isOtpSent;
  final bool isPhoneVerified;
  final String verifiedGuarantorPhone;
  final String? guarantorPhoneReceipt;

  /// PR-GUARANTOR-OTP: epoch-ms of when the guarantor phone was OTP-
  /// verified. Persisted with the form cache so a rider killed mid-form
  /// resumes without re-verifying — but only while the receipt is still
  /// inside [AppConstants.emergencyContactVerificationWindow] (the same
  /// short-lived rule as the pickup emergency-contact flow).
  final int? verifiedGuarantorPhoneAt;

  final bool aadhaarFrontUploaded;
  final String? aadhaarFrontPath;
  final bool aadhaarBackUploaded;
  final String? aadhaarBackPath;
  final bool panUploaded;
  final String? panPath;
  final bool videoUploaded;
  final String? videoPath;
  final bool signatureUploaded;
  final String? signaturePath;
  final bool photoUploaded;
  final String? photoPath;

  const GuarantorOnboardingState({
    this.currentStep = 1,
    this.isUploading = false,
    this.uploadProgressText = '',
    this.isSendingOtp = false,
    this.isVerifyingOtp = false,
    this.isOtpSent = false,
    this.isPhoneVerified = false,
    this.verifiedGuarantorPhone = '',
    this.guarantorPhoneReceipt,
    this.verifiedGuarantorPhoneAt,
    this.aadhaarFrontUploaded = false,
    this.aadhaarFrontPath,
    this.aadhaarBackUploaded = false,
    this.aadhaarBackPath,
    this.panUploaded = false,
    this.panPath,
    this.videoUploaded = false,
    this.videoPath,
    this.signatureUploaded = false,
    this.signaturePath,
    this.photoUploaded = false,
    this.photoPath,
  });

  GuarantorOnboardingState copyWith({
    int? currentStep,
    bool? isUploading,
    String? uploadProgressText,
    bool? isSendingOtp,
    bool? isVerifyingOtp,
    bool? isOtpSent,
    bool? isPhoneVerified,
    String? verifiedGuarantorPhone,
    String? guarantorPhoneReceipt,
    int? verifiedGuarantorPhoneAt,
    bool? aadhaarFrontUploaded,
    String? aadhaarFrontPath,
    bool? aadhaarBackUploaded,
    String? aadhaarBackPath,
    bool? panUploaded,
    String? panPath,
    bool? videoUploaded,
    String? videoPath,
    bool? signatureUploaded,
    String? signaturePath,
    bool? photoUploaded,
    String? photoPath,
  }) {
    return GuarantorOnboardingState(
      currentStep: currentStep ?? this.currentStep,
      isUploading: isUploading ?? this.isUploading,
      uploadProgressText: uploadProgressText ?? this.uploadProgressText,
      isSendingOtp: isSendingOtp ?? this.isSendingOtp,
      isVerifyingOtp: isVerifyingOtp ?? this.isVerifyingOtp,
      isOtpSent: isOtpSent ?? this.isOtpSent,
      isPhoneVerified: isPhoneVerified ?? this.isPhoneVerified,
      verifiedGuarantorPhone:
          verifiedGuarantorPhone ?? this.verifiedGuarantorPhone,
      guarantorPhoneReceipt:
          guarantorPhoneReceipt ?? this.guarantorPhoneReceipt,
      verifiedGuarantorPhoneAt:
          verifiedGuarantorPhoneAt ?? this.verifiedGuarantorPhoneAt,
      aadhaarFrontUploaded: aadhaarFrontUploaded ?? this.aadhaarFrontUploaded,
      aadhaarFrontPath: aadhaarFrontPath ?? this.aadhaarFrontPath,
      aadhaarBackUploaded: aadhaarBackUploaded ?? this.aadhaarBackUploaded,
      aadhaarBackPath: aadhaarBackPath ?? this.aadhaarBackPath,
      panUploaded: panUploaded ?? this.panUploaded,
      panPath: panPath ?? this.panPath,
      videoUploaded: videoUploaded ?? this.videoUploaded,
      videoPath: videoPath ?? this.videoPath,
      signatureUploaded: signatureUploaded ?? this.signatureUploaded,
      signaturePath: signaturePath ?? this.signaturePath,
      photoUploaded: photoUploaded ?? this.photoUploaded,
      photoPath: photoPath ?? this.photoPath,
    );
  }
}

class GuarantorOnboardingNotifier extends Notifier<GuarantorOnboardingState> {
  @override
  GuarantorOnboardingState build() => const GuarantorOnboardingState();

  void setStep(int step) => state = state.copyWith(currentStep: step);

  // AUDIT FIX (1i): nextStep now carries the same upper clamp as prevStep so
  // a stray tap can never push the step indicator past the last step.
  void nextStep() =>
      state = state.copyWith(currentStep: (state.currentStep + 1).clamp(1, 3));
  void prevStep() =>
      state = state.copyWith(currentStep: (state.currentStep - 1).clamp(1, 3));

  void setUploading(bool isUploading, [String progressText = '']) {
    state = state.copyWith(
        isUploading: isUploading, uploadProgressText: progressText);
  }

  void setSendingOtp(bool isSending) =>
      state = state.copyWith(isSendingOtp: isSending);
  void setOtpSent(bool isSent) =>
      state = state.copyWith(isSendingOtp: false, isOtpSent: isSent);
  void setVerifyingOtp(bool isVerifying) =>
      state = state.copyWith(isVerifyingOtp: isVerifying);
  void setPhoneVerified(bool verified, [String phone = '', String? receipt]) {
    state = state.copyWith(
      isVerifyingOtp: false,
      isPhoneVerified: verified,
      verifiedGuarantorPhone: phone,
      guarantorPhoneReceipt: receipt,
      // PR-GUARANTOR-OTP: stamp the epoch-ms receipt on success; clearing
      // verification also clears the timestamp so a stale receipt can
      // never be re-hydrated later.
      verifiedGuarantorPhoneAt:
          verified ? DateTime.now().millisecondsSinceEpoch : null,
    );
  }

  void resetPhoneVerification() {
    if (state.isPhoneVerified) {
      state = state.copyWith(
        isPhoneVerified: false,
        isOtpSent: false,
        verifiedGuarantorPhoneAt: null,
        guarantorPhoneReceipt: null,
      );
    }
  }

  /// AUDIT FIX (1b): this notifier is app-lifetime. If a previous screen
  /// instance unmounted mid-request, its success-path reset never ran and
  /// the flags stayed true forever, permanently disabling Send/Verify.
  /// Clear any stale in-flight flags when a fresh screen mounts.
  void resetInFlightFlags() {
    if (state.isSendingOtp || state.isVerifyingOtp) {
      state = state.copyWith(isSendingOtp: false, isVerifyingOtp: false);
    }
  }

  /// Full reset on logout — clears every field so the next rider never
  /// sees the previous rider's guarantor data (audit #7 P0-1).
  void reset() => state = const GuarantorOnboardingState();

  void updateDocument(String type, String path) {
    switch (type) {
      case 'aadhaar_front':
        state =
            state.copyWith(aadhaarFrontUploaded: true, aadhaarFrontPath: path);
        break;
      case 'aadhaar_back':
        state =
            state.copyWith(aadhaarBackUploaded: true, aadhaarBackPath: path);
        break;
      case 'pan':
        state = state.copyWith(panUploaded: true, panPath: path);
        break;
      case 'video':
        state = state.copyWith(videoUploaded: true, videoPath: path);
        break;
      case 'signature':
        state = state.copyWith(signatureUploaded: true, signaturePath: path);
        break;
      case 'photo':
        state = state.copyWith(photoUploaded: true, photoPath: path);
        break;
    }
  }

  void populateFromCache(Map<String, dynamic> cacheData) {
    final afPath = cacheData['aadhaarFrontPath'] as String?;
    final abPath = cacheData['aadhaarBackPath'] as String?;
    final panP = cacheData['panPath'] as String?;
    final vidP = cacheData['videoPath'] as String?;
    final sigP = cacheData['signaturePath'] as String?;
    final photoP = cacheData['photoPath'] as String?;

    // PR-GUARANTOR-OTP: the persisted `isPhoneVerified` boolean is NOT
    // trusted on its own — a rider killed mid-form resumes as "verified"
    // only while the verification receipt (verifiedPhone + verifiedAt) is
    // still inside the short validity window AND matches the phone the
    // form currently carries. Expired, mismatched, or missing receipts
    // force re-verification, exactly like a fresh session. The old cache
    // shape (boolean without a timestamp) therefore re-verifies once on
    // upgrade — the safe default.
    final cachedPhone = (cacheData['phone'] as String?) ?? '';
    final cachedVerifiedPhone = cacheData['verifiedPhone'] as String?;
    final cachedVerifiedAt = cacheData['verifiedAt'] as int?;
    final verificationFresh = AppConstants.isEmergencyContactVerificationFresh(
      verifiedPhone: cachedVerifiedPhone,
      contact: cachedPhone,
      verifiedAt: cachedVerifiedAt,
    );

    state = state.copyWith(
      isPhoneVerified: verificationFresh,
      verifiedGuarantorPhone:
          verificationFresh ? (cachedVerifiedPhone ?? '') : '',
      verifiedGuarantorPhoneAt: verificationFresh ? cachedVerifiedAt : null,
      aadhaarFrontPath: afPath,
      aadhaarFrontUploaded: afPath != null && afPath.isNotEmpty,
      aadhaarBackPath: abPath,
      aadhaarBackUploaded: abPath != null && abPath.isNotEmpty,
      panPath: panP,
      panUploaded: panP != null && panP.isNotEmpty,
      videoPath: vidP,
      videoUploaded: vidP != null && vidP.isNotEmpty,
      signaturePath: sigP,
      signatureUploaded: sigP != null && sigP.isNotEmpty,
      photoPath: photoP,
      photoUploaded: photoP != null && photoP.isNotEmpty,
    );
  }
}

final guarantorOnboardingNotifierProvider =
    NotifierProvider<GuarantorOnboardingNotifier, GuarantorOnboardingState>(
  GuarantorOnboardingNotifier.new,
);

class GuarantorOnboardingScreen extends ConsumerStatefulWidget {
  final VoidCallback? onNext;
  final VoidCallback? onBack;

  const GuarantorOnboardingScreen({super.key, this.onNext, this.onBack});

  @override
  ConsumerState<GuarantorOnboardingScreen> createState() =>
      _GuarantorOnboardingScreenState();
}

class _GuarantorOnboardingScreenState
    extends ConsumerState<GuarantorOnboardingScreen> {
  final ImageCompressionService _compressionService = ImageCompressionService();
  final _nameController = TextEditingController();
  final _dobController = TextEditingController();
  final _phoneController = TextEditingController();
  final _fatherNameController = TextEditingController();
  final _motherNameController = TextEditingController();
  final _addressController = TextEditingController();

  final List<TextEditingController> _otpControllers =
      List.generate(6, (_) => TextEditingController());
  final List<FocusNode> _otpFocusNodes = List.generate(6, (_) => FocusNode());

  int _resendCooldown = 0;
  Timer? _cooldownTimer;

  /// AUDIT FIX (1d): local file path → uploaded server URL. Persisted in the
  /// form cache so an interrupted submit retries only the documents that are
  /// not already on the server, and a re-picked document (new path) is
  /// correctly re-uploaded.
  final Map<String, String> _uploadedUrls = {};

  void _saveCache() {
    final riderId = ref.read(riderProvider).riderId;
    if (riderId == null) return;
    final state = ref.read(guarantorOnboardingNotifierProvider);
    final cacheData = {
      'name': _nameController.text,
      'dob': _dobController.text,
      'phone': _phoneController.text,
      'fatherName': _fatherNameController.text,
      'motherName': _motherNameController.text,
      'address': _addressController.text,
      'isPhoneVerified': state.isPhoneVerified,
      'verifiedPhone': state.verifiedGuarantorPhone,
      // PR-GUARANTOR-OTP: epoch-ms receipt timestamp persisted alongside
      // the marker so a resumed rider only skips re-verification while the
      // receipt is still fresh (GuarantorCache null-filters it, so an
      // unverified form simply has no entry).
      'verifiedAt': state.verifiedGuarantorPhoneAt,
      'aadhaarFrontPath': state.aadhaarFrontPath,
      'aadhaarBackPath': state.aadhaarBackPath,
      'panPath': state.panPath,
      'videoPath': state.videoPath,
      'signaturePath': state.signaturePath,
      'photoPath': state.photoPath,
      // AUDIT FIX (1d): already-uploaded URLs survive a failed submit.
      ..._uploadedUrls.map((path, url) => MapEntry('uploadedUrl:$path', url)),
    };
    GuarantorCache.saveFormCache(riderId, cacheData);
  }

  Future<void> _loadCache() async {
    final riderId = ref.read(riderProvider).riderId;
    if (riderId == null) return;

    final cacheData = await GuarantorCache.loadFormCache(riderId);
    if (!mounted) return;
    if (cacheData != null) {
      try {
        _nameController.text = cacheData['name'] ?? '';
        _dobController.text = cacheData['dob'] ?? '';
        final rawPhone =
            (cacheData['phone'] as String? ?? '').replaceAll(RegExp(r'\D'), '');
        _phoneController.text = rawPhone.length > 10
            ? rawPhone.substring(rawPhone.length - 10)
            : rawPhone;
        _fatherNameController.text = cacheData['fatherName'] ?? '';
        _motherNameController.text = cacheData['motherName'] ?? '';
        _addressController.text = cacheData['address'] ?? '';

        // AUDIT FIX (1d): hydrate the uploaded-URL ledger.
        _uploadedUrls.clear();
        cacheData.forEach((key, value) {
          if (key.startsWith('uploadedUrl:') && value is String) {
            _uploadedUrls[key.substring('uploadedUrl:'.length)] = value;
          }
        });

        ref
            .read(guarantorOnboardingNotifierProvider.notifier)
            .populateFromCache(cacheData);
      } catch (e) {
        appDebug('Error loading guarantor onboarding cache: $e');
      }
    }
  }

  // ignore: prefer_function_declarations_over_variables
  late final VoidCallback _onFieldChanged = () {
    if (mounted) setState(() {});
    _saveCache();
  };

  // ignore: prefer_function_declarations_over_variables
  late final VoidCallback _onPhoneChanged = () {
    if (mounted) setState(() {});
    final inputPhone = _phoneController.text.replaceAll(RegExp(r'\D'), '');
    final state = ref.read(guarantorOnboardingNotifierProvider);
    final cleanVerified =
        state.verifiedGuarantorPhone.replaceAll(RegExp(r'\D'), '');

    if (state.isPhoneVerified && inputPhone != cleanVerified) {
      ref
          .read(guarantorOnboardingNotifierProvider.notifier)
          .resetPhoneVerification();
      for (final controller in _otpControllers) {
        controller.clear();
      }
    }
    _saveCache();
  };

  @override
  void initState() {
    super.initState();

    WidgetsBinding.instance.addPostFrameCallback((_) async {
      await _loadCache();
      // AUDIT FIX (1b): clear OTP flags a previous (unmounted) screen
      // instance may have left stuck true on this app-lifetime notifier.
      ref
          .read(guarantorOnboardingNotifierProvider.notifier)
          .resetInFlightFlags();
      // CONSOLIDATED-FIX-2026-08-16 §4.11: gate the test-mode auto-fill on
      // kDebugMode so a misconfigured production build (isTestMode=true env
      // leak) can never silently mark a real rider's phone as verified
      // (audit #7 P1-1). The dev-OTP echo at line ~515 is already guarded.
      if (kDebugMode && AppConstants.isTestMode) {
        if (_nameController.text.isEmpty)
          _nameController.text = 'Test Guarantor';
        if (_dobController.text.isEmpty) _dobController.text = '01-01-1980';
        if (_phoneController.text.isEmpty) _phoneController.text = '9999999999';
        if (_fatherNameController.text.isEmpty)
          _fatherNameController.text = 'Guarantor Father';
        if (_motherNameController.text.isEmpty)
          _motherNameController.text = 'Guarantor Mother';
        if (_addressController.text.isEmpty)
          _addressController.text = '456 Guarantor St';
        ref
            .read(guarantorOnboardingNotifierProvider.notifier)
            .setPhoneVerified(true, _phoneController.text);
      }
    });

    _nameController.addListener(_onFieldChanged);
    _dobController.addListener(_onFieldChanged);
    _fatherNameController.addListener(_onFieldChanged);
    _motherNameController.addListener(_onFieldChanged);
    _addressController.addListener(_onFieldChanged);
    _phoneController.addListener(_onPhoneChanged);
  }

  @override
  void dispose() {
    _nameController.removeListener(_onFieldChanged);
    _dobController.removeListener(_onFieldChanged);
    _fatherNameController.removeListener(_onFieldChanged);
    _motherNameController.removeListener(_onFieldChanged);
    _addressController.removeListener(_onFieldChanged);
    _phoneController.removeListener(_onPhoneChanged);

    _cooldownTimer?.cancel();
    _nameController.dispose();
    _dobController.dispose();
    _phoneController.dispose();
    _fatherNameController.dispose();
    _motherNameController.dispose();
    _addressController.dispose();
    for (var c in _otpControllers) {
      c.dispose();
    }
    for (var n in _otpFocusNodes) {
      n.dispose();
    }
    super.dispose();
  }

  Future<void> _showDocumentSourceDialog(String type) async {
    final source = await ImageSourceBottomSheet.show(context: context);
    if (source != null) {
      _pickDocument(type, source == ImageSource.camera);
    }
  }

  Future<void> _pickDocument(String type, bool useCamera) async {
    try {
      final source = useCamera ? ImageSource.camera : ImageSource.gallery;
      final compressedFile = await _compressionService.pickAndCompress(
        source: source,
        maxWidth: 1024,
        maxHeight: 1024,
        quality: 80,
      );
      if (compressedFile != null && mounted) {
        ref
            .read(guarantorOnboardingNotifierProvider.notifier)
            .updateDocument(type, compressedFile.path);
        _saveCache();
      }
    } catch (e) {
      if (mounted) _showError('Failed to capture document. Please try again.');
    }
  }

  Future<void> _pickVideo() async {
    try {
      final XFile? video = await ImagePicker().pickVideo(
        source: ImageSource.camera,
        maxDuration: const Duration(seconds: 30),
      );
      if (video != null && mounted) {
        final file = File(video.path);
        final size = await file.length();
        if (size > 50 * 1024 * 1024) {
          _showError('Video exceeds maximum size limit of 50MB');
          return;
        }
        ref
            .read(guarantorOnboardingNotifierProvider.notifier)
            .updateDocument('video', video.path);
        _saveCache();
      }
    } catch (e) {
      if (mounted) _showError('Failed to capture video. Please try again.');
    }
  }

  Future<void> _openSignaturePad() async {
    final result = await Navigator.of(context).push<String>(
      MaterialPageRoute(builder: (_) => const SignaturePadScreen()),
    );
    if (result != null && mounted) {
      ref
          .read(guarantorOnboardingNotifierProvider.notifier)
          .updateDocument('signature', result);
      _saveCache();
    }
  }

  /// Normalizes a raw phone string to its last 10 digits (AUDIT FIX 1f:
  /// single comparison rule shared by _sendOtp and the submit validator).
  String _last10Digits(String raw) {
    final digits = raw.replaceAll(RegExp(r'\D'), '');
    return digits.length > 10 ? digits.substring(digits.length - 10) : digits;
  }

  Future<void> _sendOtp() async {
    if (_resendCooldown > 0) return;
    // AUDIT FIX (1c): in-flight guard — a double-tap before the first
    // request resolves must not fire a second sendOtp call.
    if (ref.read(guarantorOnboardingNotifierProvider).isSendingOtp) return;

    final phone = _last10Digits(_phoneController.text);
    if (phone.length < 10) {
      _showError('Please enter a valid 10-digit phone number');
      return;
    }

    // Prevent guarantor phone from being the same as rider phone
    final tenDigitRiderPhone = _last10Digits(
        ref.read(riderProvider).rider?.phone ?? '');
    if (phone == tenDigitRiderPhone) {
      _showError('Guarantor phone cannot be the same as your phone');
      return;
    }

    final notifier = ref.read(guarantorOnboardingNotifierProvider.notifier);
    notifier.setSendingOtp(true);
    try {
      final client = ApiClient();
      final response = await VoltiumApiClient(client)
          .postAuthSendOtp(SendOtpRequest(phone: phone));
      final result = response.toJson();
      // AUDIT FIX (1b): state resets are unmounted-safe — only UI work is
      // gated on mounted, so the flags can never stick true after an
      // unmount mid-request.
      notifier.setOtpSent(true);
      if (mounted) {
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

        Toast.success(
          context,
          AppLocalizations.of(context)!.txtotpSentToGuarantorPhone,
        );
        // Dev-mode only: auto-fill the OTP the server echoes. Guarded by
        // kDebugMode so a misconfigured production server can never leak
        // the OTP into the UI (audit #7 P0-5).
        if (kDebugMode) {
          final devOtp = result['data']?['otp']?.toString();
          if (devOtp != null && devOtp.length == 6) {
            for (int i = 0; i < 6; i++) {
              _otpControllers[i].text = devOtp[i];
            }
          }
        }
      }
    } catch (e) {
      appDebug('Guarantor send OTP failed: $e');
      notifier.setSendingOtp(false);
      // AUDIT FIX (1g): typed exception check instead of toString sniffing.
      if (mounted) {
        _showError(
          e is ApiException
              ? 'Failed to send OTP. Please try again.'
              : 'Network error. Check your connection.',
        );
      }
    }
  }

  Future<void> _verifyOtp() async {
    final otp = _otpControllers.map((c) => c.text).join();
    if (otp.length != 6) {
      _showError('Please enter all 6 OTP digits');
      return;
    }
    // AUDIT FIX (1c): in-flight guard — mirrors _handleSubmit's early
    // return so a double-tap cannot fire two verify calls.
    if (ref.read(guarantorOnboardingNotifierProvider).isVerifyingOtp) return;

    final phone = _last10Digits(_phoneController.text);
    final notifier = ref.read(guarantorOnboardingNotifierProvider.notifier);
    notifier.setVerifyingOtp(true);
    try {
      // PR-A: trust the server's verdict — the response carries
      // `{ verified: false, message }` for a wrong OTP and the UI must not
      // mark the phone verified unless the server confirms it (audit #7 P0-2).
      //
      // PR-13: was a wrapper call to
      // `VoltiumApiService.verifyPhone`, which was a 1-line
      // pass-through to `postAuthVerifyPhone` with a typed
      // request. The generated method returns a typed
      // `VerifyPhoneResponse`; the wrapper did `.toJson()` so
      // callers see a `Map<String, dynamic>`. Preserve that
      // shape here.
      final response = (await ref
              .read(voltiumApiClientProvider)
              .postAuthVerifyPhone(
                VerifyPhoneRequest(phone: phone, otp: otp),
              ))
          .toJson();
      final verified = verifyPhoneResponseVerified(response);
      if (!verified) {
        // AUDIT FIX (1b): reset regardless of mounted.
        notifier.setVerifyingOtp(false);
        if (mounted) {
          _showError(response['data']?['message']?.toString() ??
              'Invalid OTP. Please try again.');
        }
        return;
      }
      final receipt = response['data']?['receipt']?.toString() ??
          response['receipt']?.toString();
      // AUDIT FIX (1b): success-path state writes are unmounted-safe.
      _cooldownTimer?.cancel();
      _resendCooldown = 0;
      notifier.setPhoneVerified(true, phone, receipt);
      _saveCache();
      if (mounted) {
        setState(() {});
        Toast.success(
          context,
          AppLocalizations.of(context)!.txtphoneVerifiedSuccessfully,
        );
      }
    } catch (e) {
      appDebug('Guarantor verify OTP failed: $e');
      notifier.setVerifyingOtp(false);
      // AUDIT FIX (1e): differentiate network failures from API failures —
      // not every exception means "Invalid OTP".
      if (mounted) {
        _showError(
          e is ApiException
              ? 'Verification failed. Please check the OTP and try again.'
              : 'Network error. Check your connection.',
        );
      }
    }
  }

  void _showError(String msg) {
    if (!mounted) return;
    Toast.error(context, msg);
  }

  Future<void> _handleSubmit() async {
    final state = ref.read(guarantorOnboardingNotifierProvider);
    if (state.isUploading) return;
    final isTestMode = AppConstants.isTestMode;
    final provider = ref.read(riderProvider.notifier);
    // AUDIT FIX (1h): read once instead of subscribing inside a callback.
    final rider = ref.read(riderProvider).rider;

    if (!isTestMode) {
      // AUDIT FIX (1f): normalize both sides to last-10 digits so the
      // submit-time same-phone check matches _sendOtp's comparison rule
      // (a +91-prefixed rider phone previously slipped past).
      final missing = GuarantorFormValidator.validate(
        name: _nameController.text,
        dob: _dobController.text,
        phone: _last10Digits(_phoneController.text),
        isPhoneVerified: state.isPhoneVerified,
        fatherName: _fatherNameController.text,
        motherName: _motherNameController.text,
        address: _addressController.text,
        aadhaarFrontUploaded: state.aadhaarFrontUploaded,
        aadhaarBackUploaded: state.aadhaarBackUploaded,
        panUploaded: state.panUploaded,
        photoUploaded: state.photoUploaded,
        videoUploaded: state.videoUploaded,
        signatureUploaded: state.signatureUploaded,
        riderPhone: _last10Digits(rider?.phone ?? ''),
      );

      if (missing.isNotEmpty) {
        if (missing.length == 1 &&
            missing.first ==
                'Guarantor phone cannot be the same as rider phone') {
          _showError(missing.first);
        } else {
          _showError('Missing: ${missing.join(', ')}');
        }
        return;
      }
    }
    if (rider == null) {
      _showError('Session lost. Please log in again.');
      return;
    }
    final riderId = rider.id ?? rider.riderId;
    ref.read(guarantorOnboardingNotifierProvider.notifier).setUploading(true);
    try {
      String aadhaarFrontUrl = '',
          aadhaarBackUrl = '',
          panUrl = '',
          videoUrl = '',
          signatureUrl = '',
          photoUrl = '';

      if (isTestMode) {
        aadhaarFrontUrl = 'mock_url_front.png';
        aadhaarBackUrl = 'mock_url_back.png';
        panUrl = 'mock_url_pan.png';
        videoUrl = 'mock_url_video.mp4';
        signatureUrl = 'mock_url_signature.png';
        photoUrl = 'mock_url_photo.png';
      } else {
        final client = ApiClient();
        final filesRepo = FilesRepository(client, VoltiumApiClient(client));

        // AUDIT FIX (1d): only queue uploads for documents whose current
        // local path has no persisted URL — a retry after a partial
        // failure re-uploads only the missing pieces.
        final Map<String, MapEntry<String, Future<String> Function()>>
            tasks = {};
        void queue(String label, String? path, String category) {
          if (path == null || path.isEmpty) return;
          if (_uploadedUrls.containsKey(path)) return;
          tasks[label] =
              MapEntry(path, () => filesRepo.uploadFile(File(path), category));
        }

        queue('Aadhaar Front', state.aadhaarFrontPath, 'kyc_document');
        queue('Aadhaar Back', state.aadhaarBackPath, 'kyc_document');
        queue('PAN', state.panPath, 'kyc_document');
        queue('Photo', state.photoPath, 'profile_photo');
        queue('Video', state.videoPath, 'kyc_document');
        queue('Signature', state.signaturePath, 'kyc_document');

        int completed = 0;
        // AUDIT FIX (1d): per-entry collection instead of all-or-nothing
        // Future.wait — already-uploaded URLs are recorded immediately and
        // survive a failure; the first error is rethrown afterwards so the
        // user still sees a failure.
        Object? firstError;

        await Future.wait(tasks.values.map((task) async {
          try {
            final url = await task.value();
            completed++;
            _uploadedUrls[task.key] = url;
            ref.read(guarantorOnboardingNotifierProvider.notifier).setUploading(
                  true,
                  'Uploaded $completed of ${tasks.length}',
                );
          } catch (e) {
            // AUDIT FIX (1g): raw exception text is logged, never embedded
            // in the thrown/user-facing message.
            appDebug('Guarantor upload failed: ${e.toString()}');
            firstError ??= e;
          }
        }));

        if (firstError != null) {
          throw firstError!;
        }
        _saveCache();

        String urlFor(String? path) =>
            path != null ? (_uploadedUrls[path] ?? '') : '';

        aadhaarFrontUrl = urlFor(state.aadhaarFrontPath);
        aadhaarBackUrl = urlFor(state.aadhaarBackPath);
        panUrl = urlFor(state.panPath);
        photoUrl = urlFor(state.photoPath);
        videoUrl = urlFor(state.videoPath);
        signatureUrl = urlFor(state.signaturePath);

        // Cache guarantor documents locally.
        if (state.aadhaarFrontPath != null)
          DocumentLocalCache.save(
              'guarantorAadhaarFront', state.aadhaarFrontPath!);
        if (state.aadhaarBackPath != null)
          DocumentLocalCache.save(
              'guarantorAadhaarBack', state.aadhaarBackPath!);
        if (state.panPath != null)
          DocumentLocalCache.save('guarantorPan', state.panPath!);
        if (state.photoPath != null)
          DocumentLocalCache.save('guarantorPhoto', state.photoPath!);
        if (state.videoPath != null)
          DocumentLocalCache.save('guarantorVideo', state.videoPath!);
        if (state.signaturePath != null)
          DocumentLocalCache.save('guarantorSignature', state.signaturePath!);
      }

      ref
          .read(guarantorOnboardingNotifierProvider.notifier)
          .setUploading(true, 'Saving profile...');

      await VoltiumApiClient(ApiClient()).putRiderProfile(
        UpdateProfileRequest(
          guarantorName: _nameController.text,
          guarantorDob: _dobController.text,
          guarantorPhone: _phoneController.text,
          guarantorPhoneReceipt: state.guarantorPhoneReceipt,
          guarantorFatherName: _fatherNameController.text,
          guarantorMotherName: _motherNameController.text,
          guarantorAddress: _addressController.text,
          guarantorAadhaarFront: aadhaarFrontUrl,
          guarantorAadhaarBack: aadhaarBackUrl,
          guarantorPan: panUrl,
          guarantorVideo: videoUrl,
          guarantorSignature: signatureUrl,
          guarantorPhoto: photoUrl,
        ),
      );
      await GuarantorCache.clearFormCache(riderId);
      // AUDIT FIX (1d): submit succeeded — drop the uploaded-URL ledger so
      // a future re-submission starts clean.
      _uploadedUrls.clear();
      await provider.refresh();
      PostHogService.capture('guarantor_form_submitted');
      if (mounted) {
        if (widget.onNext != null) {
          widget.onNext!.call();
        } else {
          Navigator.maybePop(context);
        }
      }
    } catch (e) {
      if (mounted) {
        // AUDIT FIX (1g): typed ApiException checks instead of string
        // sniffing; user-facing messages stay static (no raw exception text).
        String userMessage;
        if (e is ApiException) {
          switch (e.statusCode) {
            case 422:
            case 400:
              userMessage =
                  'Please check your documents and try uploading again.';
              break;
            case 401:
            case 403:
              userMessage = 'Session expired. Please log in again.';
              break;
            case 408:
            case 504:
              userMessage = 'No internet connection. Please check and retry.';
              break;
            default:
              userMessage = 'Something went wrong. Please try again.';
          }
        } else {
          final msg = e.toString().toLowerCase();
          appDebug('Guarantor update error: ${e.toString()}');
          if (msg.contains('validation')) {
            userMessage =
                'Please check your documents and try uploading again.';
          } else if (msg.contains('unauthorized')) {
            userMessage = 'Session expired. Please log in again.';
          } else if (msg.contains('network') ||
              msg.contains('timeout') ||
              msg.contains('socket') ||
              msg.contains('connection')) {
            userMessage = 'No internet connection. Please check and retry.';
          } else {
            userMessage = 'Something went wrong. Please try again.';
          }
        }
        _showError(userMessage);
      }
    } finally {
      ref
          .read(guarantorOnboardingNotifierProvider.notifier)
          .setUploading(false);
    }
  }

  /// ONBOARDING-AUDIT 2026-08-14 (fix #5d): the previous "Skip for
  /// now?" path was removed entirely. The button claimed a
  /// higher-deposit tier would be unlocked by skipping, but the
  /// backend never enforced `requiresHigherDeposit` — so the rider
  /// was promised a consequence that did not exist. Worse, skipping
  /// meant the rider had no guarantor on file, which (per the
  /// active-path server contract) blocks the rental flow
  /// outright. The button is gone from the screen below
  /// (`onSkip: null`) and the handler was deleted. If you ever
  /// want to re-introduce skipping, wire the server-side
  /// `requiresHigherDeposit` flag end-to-end FIRST.

  Widget _buildStepIndicator() {
    final currentStep = ref.watch(
      guarantorOnboardingNotifierProvider.select((s) => s.currentStep),
    );
    return Padding(
      padding: const EdgeInsets.only(bottom: 20),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          _buildDot(1, currentStep),
          _buildLine(1, currentStep),
          _buildDot(2, currentStep),
          _buildLine(2, currentStep),
          _buildDot(3, currentStep),
        ],
      ),
    );
  }

  Widget _buildDot(int step, int currentStep) {
    final isActive = currentStep >= step;
    return Container(
      width: 24,
      height: 24,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color:
            isActive ? AppColors.primary : AppColors.of(context).surfaceSubtle,
        border: isActive
            ? null
            : Border.all(color: AppColors.of(context).borderSubtle),
      ),
      alignment: Alignment.center,
      child: Text(
        '$step',
        style: AppTypography.bodySmall
            .copyWith(fontWeight: FontWeight.w600)
            .copyWith(
                color: isActive ? Colors.white : AppColors.onSurfaceVariant),
      ),
    );
  }

  Widget _buildLine(int leftStep, int currentStep) {
    final isCompleted = currentStep > leftStep;
    return Container(
      width: 40,
      height: 2,
      color:
          isCompleted ? AppColors.primary : AppColors.of(context).borderSubtle,
    );
  }

  void _onBottomButtonPressed() {
    final currentStep =
        ref.read(guarantorOnboardingNotifierProvider).currentStep;
    if (currentStep < 3) {
      ref.read(guarantorOnboardingNotifierProvider.notifier).nextStep();
    } else {
      _handleSubmit();
    }
  }

  bool get _canProceedCurrentStep {
    if (AppConstants.isTestMode) return true;
    final state = ref.read(guarantorOnboardingNotifierProvider);
    switch (state.currentStep) {
      case 1:
        return _nameController.text.isNotEmpty &&
            _dobController.text.isNotEmpty &&
            _phoneController.text.isNotEmpty &&
            state.isPhoneVerified &&
            _fatherNameController.text.isNotEmpty &&
            _motherNameController.text.isNotEmpty &&
            _addressController.text.isNotEmpty;
      case 2:
        return state.aadhaarFrontUploaded &&
            state.aadhaarBackUploaded &&
            state.panUploaded &&
            state.photoUploaded;
      case 3:
        return state.videoUploaded && state.signatureUploaded;
      default:
        return false;
    }
  }

  Future<void> _selectDob() async {
    DateTime initial = DateTime(1990);
    if (_dobController.text.isNotEmpty) {
      final parts = _dobController.text.split(RegExp(r'[-/]'));
      if (parts.length == 3) {
        try {
          if (parts[0].length == 4) {
            initial = DateTime(
                int.parse(parts[0]), int.parse(parts[1]), int.parse(parts[2]));
          } else {
            initial = DateTime(
                int.parse(parts[2]), int.parse(parts[1]), int.parse(parts[0]));
          }
        } catch (_) {}
      }
    }
    final firstDate = DateTime(1940);
    final lastDate = DateTime.now().subtract(const Duration(days: 365 * 18));
    if (initial.isBefore(firstDate)) initial = firstDate;
    if (initial.isAfter(lastDate)) initial = lastDate;

    final date = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: firstDate,
      lastDate: lastDate,
    );
    if (date != null && mounted) {
      _dobController.text =
          '${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final state = ref.watch(guarantorOnboardingNotifierProvider);

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, result) {
        if (didPop) return;
        if (state.currentStep > 1) {
          ref.read(guarantorOnboardingNotifierProvider.notifier).prevStep();
        } else {
          widget.onBack?.call();
        }
      },
      child: Scaffold(
        backgroundColor: colors.surface,
        body: Column(
          children: [
            Expanded(
              child: SingleChildScrollView(
                child: Column(
                  children: [
                    buildCurtainHeader(
                      context: context,
                      title: 'Guarantor Details',
                      subtitle: 'Add a guarantor for additional security',
                      onBack: () {
                        if (state.currentStep > 1) {
                          ref
                              .read(
                                  guarantorOnboardingNotifierProvider.notifier)
                              .prevStep();
                        } else {
                          widget.onBack?.call();
                        }
                      },
                    ),
                    Transform.translate(
                      offset: const Offset(0, -32),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                        child: Column(
                          children: [
                            _buildStepIndicator(),
                            if (state.currentStep == 1) ...[
                              _GuarantorLiabilityBanner(),
                              const SizedBox(height: 24),
                              GuarantorDetailsCard(
                                nameController: _nameController,
                                dobController: _dobController,
                                phoneController: _phoneController,
                                fatherNameController: _fatherNameController,
                                motherNameController: _motherNameController,
                                addressController: _addressController,
                                isPhoneVerified: state.isPhoneVerified,
                                isSendingOtp: state.isSendingOtp,
                                isOtpSent: state.isOtpSent,
                                isVerifyingOtp: state.isVerifyingOtp,
                                resendCooldown: _resendCooldown,
                                onSendOtp: _sendOtp,
                                onVerifyOtp: _verifyOtp,
                                onSelectDob: _selectDob,
                                otpBoxes: GuarantorOnboardingOtpBoxes(
                                  otpControllers: _otpControllers,
                                  otpFocusNodes: _otpFocusNodes,
                                  onChanged: (i, v) {
                                    if (v.length == 1 && i < 5) {
                                      FocusScope.of(context)
                                          .requestFocus(_otpFocusNodes[i + 1]);
                                    } else if (v.isEmpty && i > 0) {
                                      FocusScope.of(context)
                                          .requestFocus(_otpFocusNodes[i - 1]);
                                    }
                                  },
                                ),
                              ),
                            ],
                            if (state.currentStep == 2) ...[
                              GuarantorIdentityVerificationCard(
                                aadhaarFrontUploaded:
                                    state.aadhaarFrontUploaded,
                                aadhaarBackUploaded: state.aadhaarBackUploaded,
                                panUploaded: state.panUploaded,
                                photoUploaded: state.photoUploaded,
                                onPickAadhaarFront: () =>
                                    _showDocumentSourceDialog('aadhaar_front'),
                                onPickAadhaarBack: () =>
                                    _showDocumentSourceDialog('aadhaar_back'),
                                onPickPan: () =>
                                    _showDocumentSourceDialog('pan'),
                                onPickPhoto: () =>
                                    _showDocumentSourceDialog('photo'),
                              ),
                            ],
                            if (state.currentStep == 3) ...[
                              GuarantorVideoProofCard(
                                videoUploaded: state.videoUploaded,
                                videoPath: state.videoPath,
                                onTap: _pickVideo,
                              ),
                              const SizedBox(height: 24),
                              GuarantorSignatureCard(
                                signatureUploaded: state.signatureUploaded,
                                onTap: _openSignaturePad,
                              ),
                            ],
                            const SizedBox(height: 120),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            GuarantorOnboardingBottomButton(
              canProceed: _canProceedCurrentStep,
              isUploading: state.isUploading,
              uploadProgressText: state.uploadProgressText,
              buttonText: state.currentStep < 3 ? 'NEXT STEP' : 'FINISH SETUP',
              onSubmit: _onBottomButtonPressed,
              // ONBOARDING-AUDIT 2026-08-14 (fix #5d): the Skip button
              // was removed. It promised a higher-deposit tier that the
              // backend never enforced, and skipping would block the
              // rental flow (a rider without a guarantor on file cannot
              // start a rental per the active-path server contract).
              onSkip: null,
            ),
          ],
        ),
      ),
    );
  }
}

/// Explicit legal-liability banner displayed above the guarantor form.
class _GuarantorLiabilityBanner extends StatelessWidget {
  const _GuarantorLiabilityBanner();

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Container(
      key: const Key('guarantorLiabilityBanner'),
      margin: const EdgeInsets.symmetric(horizontal: 16),
      padding: Spacing.paddingMd,
      decoration: BoxDecoration(
        color: colors.warningLight,
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(
          color: colors.warning.withValues(alpha: 0.3),
          width: 1,
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            Icons.warning_amber_rounded,
            color: colors.warningLightForeground,
            size: 24,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Your guarantor takes on real financial liability',
                  style: AppTypography.bodyMedium
                      .copyWith(fontSize: 13, fontWeight: FontWeight.w700)
                      .copyWith(color: colors.warningLightForeground),
                ),
                const SizedBox(height: 4),
                Text(
                  'By submitting this form, your guarantor becomes jointly '
                  'responsible for all rental charges, damages, and penalties '
                  'for the duration of your subscription. Read the Guarantor '
                  'Agreement in the Legal section for the full terms.',
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 12,
                    color: colors.warningLightForeground.withValues(alpha: 0.9),
                    height: 1.4,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
