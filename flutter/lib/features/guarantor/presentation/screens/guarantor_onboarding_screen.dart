import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:universal_io/io.dart';
import 'package:voltium_rider/utils/app_constants.dart';
import 'package:voltium_rider/services/voltium_api_service.dart';
import 'package:voltium_rider/core/network/api_client.dart';
import 'package:voltium_rider/core/network/generated/api_client.dart';
import 'package:voltium_rider/core/network/generated/api_models.dart';
import 'package:voltium_rider/core/network/files_repository.dart';
import 'package:voltium_rider/widgets/image_source_sheet.dart';
import 'package:voltium_rider/services/image_compression_service.dart';
import 'package:voltium_rider/services/document_local_cache.dart';
import 'package:voltium_rider/services/cache_service.dart';
import 'package:voltium_rider/features/kyc/presentation/screens/signature_pad_screen.dart';
import 'package:voltium_rider/features/guarantor/presentation/widgets/guarantor_onboarding_widgets.dart';
import 'package:voltium_rider/theme/app_theme.dart';
import 'package:voltium_rider/widgets/pickup_hub_widgets.dart';
import 'package:voltium_rider/features/guarantor/domain/form_validator.dart';
import 'package:voltium_rider/features/guarantor/data/guarantor_cache.dart';

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
  void nextStep() => state = state.copyWith(currentStep: state.currentStep + 1);
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
  void setPhoneVerified(bool verified, [String phone = '']) {
    state = state.copyWith(
      isVerifyingOtp: false,
      isPhoneVerified: verified,
      verifiedGuarantorPhone: phone,
    );
  }

  void resetPhoneVerification() {
    if (state.isPhoneVerified) {
      state = state.copyWith(isPhoneVerified: false, isOtpSent: false);
    }
  }

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

    state = state.copyWith(
      isPhoneVerified: cacheData['isPhoneVerified'] ?? false,
      verifiedGuarantorPhone: cacheData['verifiedPhone'] ?? '',
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
      'aadhaarFrontPath': state.aadhaarFrontPath,
      'aadhaarBackPath': state.aadhaarBackPath,
      'panPath': state.panPath,
      'videoPath': state.videoPath,
      'signaturePath': state.signaturePath,
      'photoPath': state.photoPath,
    };
    GuarantorCache.saveFormCache(riderId, cacheData);
  }

  void _loadCache() {
    final riderId = ref.read(riderProvider).riderId;
    if (riderId == null) return;

    final cacheData = GuarantorCache.loadFormCache(riderId);
    if (cacheData != null) {
      try {
        _nameController.text = cacheData['name'] ?? '';
        _dobController.text = cacheData['dob'] ?? '';
        _phoneController.text = cacheData['phone'] ?? '';
        _fatherNameController.text = cacheData['fatherName'] ?? '';
        _motherNameController.text = cacheData['motherName'] ?? '';
        _addressController.text = cacheData['address'] ?? '';

        ref
            .read(guarantorOnboardingNotifierProvider.notifier)
            .populateFromCache(cacheData);
      } catch (e) {
        appDebug('Error loading guarantor onboarding cache: $e');
      }
    }
  }

  @override
  void initState() {
    super.initState();
    _loadCache();

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (AppConstants.isTestMode) {
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

    _nameController.addListener(_saveCache);
    _dobController.addListener(_saveCache);
    _fatherNameController.addListener(_saveCache);
    _motherNameController.addListener(_saveCache);
    _addressController.addListener(_saveCache);

    _phoneController.addListener(() {
      final inputPhone = _phoneController.text.replaceAll(RegExp(r'\D'), '');
      final state = ref.read(guarantorOnboardingNotifierProvider);
      final cleanVerified =
          state.verifiedGuarantorPhone.replaceAll(RegExp(r'\D'), '');

      if (state.isPhoneVerified && inputPhone != cleanVerified) {
        ref
            .read(guarantorOnboardingNotifierProvider.notifier)
            .resetPhoneVerification();
      }
      _saveCache();
    });
  }

  @override
  void dispose() {
    _nameController.removeListener(_saveCache);
    _dobController.removeListener(_saveCache);
    _fatherNameController.removeListener(_saveCache);
    _motherNameController.removeListener(_saveCache);
    _addressController.removeListener(_saveCache);

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

  Future<void> _sendOtp() async {
    final phone = _phoneController.text.replaceAll(RegExp(r'\D'), '');
    if (phone.length < 10) {
      _showError('Please enter a valid 10-digit phone number');
      return;
    }

    // Prevent guarantor phone from being the same as rider phone
    if (phone == ref.watch(riderProvider).rider?.phone) {
      _showError('Guarantor phone cannot be the same as your phone');
      return;
    }

    ref.read(guarantorOnboardingNotifierProvider.notifier).setSendingOtp(true);
    try {
      final client = ApiClient();
      final response = await VoltiumApiClient(client)
          .postAuthSendOtp(SendOtpRequest(phone: phone));
      final result = response.toJson();
      if (mounted) {
        ref.read(guarantorOnboardingNotifierProvider.notifier).setOtpSent(true);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('OTP sent to guarantor phone'),
            backgroundColor: AppColors.success,
          ),
        );
        // In dev mode, auto-fill OTP if returned by the API
        final devOtp = result['data']?['otp']?.toString();
        if (devOtp != null && devOtp.length == 6) {
          for (int i = 0; i < 6; i++) {
            _otpControllers[i].text = devOtp[i];
          }
        }
      }
    } catch (e) {
      if (mounted) {
        ref
            .read(guarantorOnboardingNotifierProvider.notifier)
            .setSendingOtp(false);
        _showError(
          e.toString().contains('ApiException')
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

    final phone = _phoneController.text.replaceAll(RegExp(r'\D'), '');
    ref
        .read(guarantorOnboardingNotifierProvider.notifier)
        .setVerifyingOtp(true);
    try {
      await VoltiumApiService().verifyPhone(phone: phone, otp: otp);
      if (mounted) {
        ref
            .read(guarantorOnboardingNotifierProvider.notifier)
            .setPhoneVerified(true, phone);
        _saveCache();
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Phone verified successfully'),
            backgroundColor: AppColors.success,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ref
            .read(guarantorOnboardingNotifierProvider.notifier)
            .setVerifyingOtp(false);
        _showError('Invalid OTP. Please try again.');
      }
    }
  }

  void _showError(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(msg), backgroundColor: AppColors.error),
    );
  }

  Future<void> _handleSubmit() async {
    final state = ref.read(guarantorOnboardingNotifierProvider);
    final isTestMode = AppConstants.isTestMode;
    final provider = ref.read(riderProvider);
    final rider = ref.watch(riderProvider).rider;

    if (!isTestMode) {
      final missing = GuarantorFormValidator.validate(
        name: _nameController.text,
        dob: _dobController.text,
        phone: _phoneController.text,
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
        riderPhone: rider?.phone,
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
        final Map<String, dynamic> tasks = {};
        if (state.aadhaarFrontPath != null)
          tasks['Aadhaar Front'] = () => filesRepo.uploadFile(
              File(state.aadhaarFrontPath!), 'kyc_document');
        if (state.aadhaarBackPath != null)
          tasks['Aadhaar Back'] = () => filesRepo.uploadFile(
              File(state.aadhaarBackPath!), 'kyc_document');
        if (state.panPath != null)
          tasks['PAN'] =
              () => filesRepo.uploadFile(File(state.panPath!), 'kyc_document');
        if (state.videoPath != null)
          tasks['Video'] = () =>
              filesRepo.uploadFile(File(state.videoPath!), 'kyc_document');
        if (state.signaturePath != null)
          tasks['Signature'] = () =>
              filesRepo.uploadFile(File(state.signaturePath!), 'kyc_document');
        if (state.photoPath != null)
          tasks['Photo'] = () =>
              filesRepo.uploadFile(File(state.photoPath!), 'profile_photo');

        int completed = 0;
        final results = <String, String>{};

        for (final entry in tasks.entries) {
          ref.read(guarantorOnboardingNotifierProvider.notifier).setUploading(
                true,
                'Uploading ${completed + 1} of ${tasks.length}...',
              );
          results[entry.key] = await entry.value();
          completed++;
        }

        aadhaarFrontUrl = results['Aadhaar Front'] ?? '';
        aadhaarBackUrl = results['Aadhaar Back'] ?? '';
        panUrl = results['PAN'] ?? '';
        videoUrl = results['Video'] ?? '';
        signatureUrl = results['Signature'] ?? '';
        photoUrl = results['Photo'] ?? '';

        // Cache guarantor documents locally.
        if (state.aadhaarFrontPath != null)
          DocumentLocalCache.save(
              'guarantorAadhaarFront', state.aadhaarFrontPath!);
        if (state.aadhaarBackPath != null)
          DocumentLocalCache.save(
              'guarantorAadhaarBack', state.aadhaarBackPath!);
        if (state.panPath != null)
          DocumentLocalCache.save('guarantorPan', state.panPath!);
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
      await provider.refresh();
      PostHogService.capture('guarantor_form_submitted');
      if (mounted) {
        widget.onNext?.call();
      }
    } catch (e) {
      if (mounted) {
        String userMessage = 'Something went wrong. Please try again.';
        final msg = e.toString();
        appDebug('Guarantor update error: $msg');

        if (msg.contains('422') || msg.contains('VALIDATION')) {
          userMessage = 'Please check your documents and try uploading again.';
        } else if (msg.contains('401') || msg.contains('unauthorized')) {
          userMessage = 'Session expired. Please log in again.';
        } else if (msg.contains('network') || msg.contains('timeout')) {
          userMessage = 'No internet connection. Please check and retry.';
        }
        _showError(userMessage);
      }
    } finally {
      ref
          .read(guarantorOnboardingNotifierProvider.notifier)
          .setUploading(false);
    }
  }

  /// User tapped "Skip" on the guarantor form. Show a confirmation
  /// dialog that explains the consequence (higher deposit tier) and
  /// then proceed to the pre-dashboard.
  ///
  /// The higher-deposit-tier behaviour is opt-in per user: we set a
  /// `requiresHigherDeposit: true` flag in the cache and let the
  /// pre-dashboard read it. The backend does not yet enforce a
  /// different deposit amount for users without a guarantor, so this
  /// is currently a UI-only signal.
  Future<void> _handleSkip() async {
    final confirmed = await showDialog<bool>(
      context: context,
      barrierDismissible: true,
      builder: (ctx) => Dialog(
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.radiusModal),
        ),
        backgroundColor: Theme.of(ctx).colorScheme.surface,
        child: Padding(
          padding: Spacing.paddingLg,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Skip Guarantor?',
                style: AppTypography.titleLarge
                    .copyWith(color: AppColors.slate900, letterSpacing: -0.5),
              ),
              SizedBox(height: 12),
              Text(
                'Without a guarantor, you will be required to pay a higher '
                'security deposit (₹5,000 instead of ₹2,000) when you select '
                'a plan.\n\n'
                'You can add a guarantor later from Profile → Settings.',
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 14,
                  height: 1.5,
                  color: AppColors.onSurfaceVariant,
                ),
              ),
              SizedBox(height: 24),
              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  TextButton(
                    key: const Key('skipGuarantorCancelButton'),
                    onPressed: () => Navigator.of(ctx).pop(false),
                    style: TextButton.styleFrom(
                      foregroundColor: AppColors.onSurfaceDisabled,
                      textStyle: GoogleFonts.plusJakartaSans(
                          fontWeight: FontWeight.w600),
                    ),
                    child: const Text('Cancel'),
                  ),
                  SizedBox(width: 8),
                  ElevatedButton(
                    key: const Key('skipGuarantorConfirmButton'),
                    onPressed: () => Navigator.of(ctx).pop(true),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.error,
                      foregroundColor: Colors.white,
                      elevation: 0,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(AppRadius.md),
                      ),
                    ),
                    child: Text(
                      'Skip',
                      style: GoogleFonts.plusJakartaSans(
                          fontWeight: FontWeight.w600),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );

    if (confirmed != true || !mounted) return;

    // Persist the higher-deposit flag in cache so the pre-dashboard
    // can read it. The backend does not have a `requiresHigherDeposit`
    // field yet, so this is a local signal only.
    final riderId = ref.read(riderProvider).riderId;
    if (riderId != null) {
      await CacheService()
          .setString('voltium_requires_higher_deposit:$riderId', 'true');
    }

    // Clear the form cache so a returning user doesn't see a half-
    // filled guarantor form if they change their mind.
    await CacheService().remove('guarantor_onboarding_form_cache');

    if (mounted) widget.onNext?.call();
  }

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
          _buildLine(),
          _buildDot(2, currentStep),
          _buildLine(),
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
        color: isActive ? AppColors.primary : AppColors.surfaceSubtle,
        border: isActive ? null : Border.all(color: AppColors.borderSubtle),
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

  Widget _buildLine() {
    return Container(
      width: 40,
      height: 2,
      color: AppColors.borderSubtle,
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
    final date = await showDatePicker(
      context: context,
      initialDate: DateTime(1990),
      firstDate: DateTime(1940),
      lastDate: DateTime.now().subtract(const Duration(days: 365 * 18)),
    );
    if (date != null && mounted) {
      _dobController.text =
          '${date.day.toString().padLeft(2, '0')}-${date.month.toString().padLeft(2, '0')}-${date.year}';
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
              onSkip: state.currentStep == 1 ? _handleSkip : null,
            ),
          ],
        ),
      ),
    );
  }
}

/// Explicit legal-liability banner displayed above the guarantor form.
///
/// Bug 25: previously the screen had no explanation of what a
/// guarantor is or what liability they take on. A user could tap
/// "Complete" without realising the guarantor is taking on real
/// financial liability. This banner is a short, scannable disclosure
/// that names the risk and points to the full terms.
class _GuarantorLiabilityBanner extends ConsumerWidget {
  const _GuarantorLiabilityBanner();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Container(
      key: const Key('guarantorLiabilityBanner'),
      margin: const EdgeInsets.symmetric(horizontal: 16),
      padding: Spacing.paddingMd,
      decoration: BoxDecoration(
        color: AppColors.warningLight,
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(color: AppColors.warning, width: 1),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(
            Icons.warning_amber_rounded,
            color: AppColors.warningDark,
            size: 24,
          ),
          SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Your guarantor takes on real financial liability',
                  style: AppTypography.bodyMedium
                      .copyWith(fontSize: 13, fontWeight: FontWeight.w700)
                      .copyWith(color: AppColors.onSurface),
                ),
                SizedBox(height: 4),
                Text(
                  'By submitting this form, your guarantor becomes jointly '
                  'responsible for all rental charges, damages, and penalties '
                  'for the duration of your subscription. Read the Guarantor '
                  'Agreement in the Legal section for the full terms.',
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 12,
                    color: AppColors.onSurface,
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
