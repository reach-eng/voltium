import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'package:image_picker/image_picker.dart';
import 'package:universal_io/io.dart';
import 'package:dio/dio.dart';
import 'package:voltium_rider/utils/app_constants.dart';
import 'package:voltium_rider/services/voltium_api_service.dart';
import 'package:voltium_rider/services/image_compression_service.dart';
import 'package:voltium_rider/services/cache_service.dart';
import 'package:voltium_rider/providers/app_provider.dart';
import 'package:voltium_rider/features/kyc/presentation/screens/signature_pad_screen.dart';
import 'package:voltium_rider/features/guarantor/presentation/widgets/guarantor_onboarding_widgets.dart';
import 'package:voltium_rider/theme/app_theme.dart';
import 'package:voltium_rider/features/guarantor/domain/form_validator.dart';
import 'package:voltium_rider/features/guarantor/data/guarantor_cache.dart';

class GuarantorOnboardingScreen extends StatefulWidget {
  final VoidCallback? onNext;
  final VoidCallback? onBack;

  const GuarantorOnboardingScreen({super.key, this.onNext, this.onBack});

  @override
  State<GuarantorOnboardingScreen> createState() =>
      _GuarantorOnboardingScreenState();
}

class _GuarantorOnboardingScreenState extends State<GuarantorOnboardingScreen> {
  final ImageCompressionService _compressionService = ImageCompressionService();
  final _nameController = TextEditingController();
  final _dobController = TextEditingController();
  final _phoneController = TextEditingController();
  final _fatherNameController = TextEditingController();
  final _motherNameController = TextEditingController();
  final _addressController = TextEditingController();

  bool _isUploading = false;
  String _uploadProgressText = '';
  bool _isSendingOtp = false;
  bool _isVerifyingOtp = false;
  bool _isOtpSent = false;
  bool _isPhoneVerified = false;
  String _verifiedGuarantorPhone = '';
  final List<TextEditingController> _otpControllers =
      List.generate(6, (_) => TextEditingController());
  final List<FocusNode> _otpFocusNodes = List.generate(6, (_) => FocusNode());

  bool _aadhaarFrontUploaded = false;
  bool _aadhaarBackUploaded = false;
  bool _panUploaded = false;
  bool _videoUploaded = false;
  bool _signatureUploaded = false;
  bool _photoUploaded = false;

  String? _aadhaarFrontPath;
  String? _aadhaarBackPath;
  String? _panPath;
  String? _videoPath;
  String? _signaturePath;
  String? _photoPath;

  void _saveCache() {
    final riderId = context.read<AppProvider>().rider?.id;
    if (riderId == null) return;
    final cacheData = {
      'name': _nameController.text,
      'dob': _dobController.text,
      'phone': _phoneController.text,
      'fatherName': _fatherNameController.text,
      'motherName': _motherNameController.text,
      'address': _addressController.text,
      'isPhoneVerified': _isPhoneVerified,
      'verifiedPhone': _verifiedGuarantorPhone,
      'aadhaarFrontPath': _aadhaarFrontPath,
      'aadhaarBackPath': _aadhaarBackPath,
      'panPath': _panPath,
      'videoPath': _videoPath,
      'signaturePath': _signaturePath,
      'photoPath': _photoPath,
    };
    GuarantorCache.saveFormCache(riderId, cacheData);
  }

  void _loadCache() {
    final riderId = context.read<AppProvider>().rider?.id;
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
        _isPhoneVerified = cacheData['isPhoneVerified'] ?? false;
        _verifiedGuarantorPhone = cacheData['verifiedPhone'] ?? '';

        _aadhaarFrontPath = cacheData['aadhaarFrontPath'];
        _aadhaarFrontUploaded =
            _aadhaarFrontPath != null && _aadhaarFrontPath!.isNotEmpty;

        _aadhaarBackPath = cacheData['aadhaarBackPath'];
        _aadhaarBackUploaded =
            _aadhaarBackPath != null && _aadhaarBackPath!.isNotEmpty;

        _panPath = cacheData['panPath'];
        _panUploaded = _panPath != null && _panPath!.isNotEmpty;

        _videoPath = cacheData['videoPath'];
        _videoUploaded = _videoPath != null && _videoPath!.isNotEmpty;

        _signaturePath = cacheData['signaturePath'];
        _signatureUploaded =
            _signaturePath != null && _signaturePath!.isNotEmpty;

        _photoPath = cacheData['photoPath'];
        _photoUploaded = _photoPath != null && _photoPath!.isNotEmpty;
      } catch (e) {
        debugPrint('Error loading guarantor onboarding cache: $e');
      }
    }
  }

  @override
  void initState() {
    super.initState();
    _loadCache();

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (AppConstants.isTestMode) {
        setState(() {
          if (_nameController.text.isEmpty)
            _nameController.text = 'Test Guarantor';
          if (_dobController.text.isEmpty) _dobController.text = '01-01-1980';
          if (_phoneController.text.isEmpty)
            _phoneController.text = '9999999999';
          if (_fatherNameController.text.isEmpty)
            _fatherNameController.text = 'Guarantor Father';
          if (_motherNameController.text.isEmpty)
            _motherNameController.text = 'Guarantor Mother';
          if (_addressController.text.isEmpty)
            _addressController.text = '456 Guarantor St';
          _isPhoneVerified = true;
        });
      }
    });

    _nameController.addListener(_saveCache);
    _dobController.addListener(_saveCache);
    _fatherNameController.addListener(_saveCache);
    _motherNameController.addListener(_saveCache);
    _addressController.addListener(_saveCache);

    _phoneController.addListener(() {
      final inputPhone = _phoneController.text.replaceAll(RegExp(r'\D'), '');
      final cleanVerified =
          _verifiedGuarantorPhone.replaceAll(RegExp(r'\D'), '');

      setState(() {
        if (_isPhoneVerified && inputPhone != cleanVerified) {
          _isPhoneVerified = false;
          _isOtpSent = false;
        }
      });
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

  void _showDocumentSourceDialog(String type) {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (context) {
        return SafeArea(
          child: Wrap(
            children: [
              ListTile(
                leading: const Icon(Icons.camera_alt, color: AppColors.primary),
                title: const Text('Take a Photo'),
                onTap: () {
                  Navigator.pop(context);
                  _pickDocument(type, true);
                },
              ),
              ListTile(
                leading:
                    const Icon(Icons.photo_library, color: AppColors.primary),
                title: const Text('Choose from Gallery'),
                onTap: () {
                  Navigator.pop(context);
                  _pickDocument(type, false);
                },
              ),
            ],
          ),
        );
      },
    );
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
        setState(() {
          switch (type) {
            case 'aadhaar_front':
              _aadhaarFrontUploaded = true;
              _aadhaarFrontPath = compressedFile.path;
              break;
            case 'aadhaar_back':
              _aadhaarBackUploaded = true;
              _aadhaarBackPath = compressedFile.path;
              break;
            case 'pan':
              _panUploaded = true;
              _panPath = compressedFile.path;
              break;
            case 'photo':
              _photoUploaded = true;
              _photoPath = compressedFile.path;
              break;
          }
        });
        _saveCache();
      }
    } catch (e) {
      if (mounted) _showError('Failed to capture document. Please try again.');
    }
  }

  Future<void> _pickVideo() async {
    try {
      final XFile? video =
          await ImagePicker().pickVideo(source: ImageSource.camera);
      if (video != null && mounted) {
        setState(() {
          _videoUploaded = true;
          _videoPath = video.path;
        });
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
      setState(() {
        _signatureUploaded = true;
        _signaturePath = result;
      });
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
    final provider = context.read<AppProvider>();
    if (phone == provider.rider?.phone) {
      _showError('Guarantor phone cannot be the same as your phone');
      return;
    }

    setState(() => _isSendingOtp = true);
    try {
      final result = await VoltiumApiService().sendOtp(phone: phone);
      if (mounted) {
        setState(() {
          _isSendingOtp = false;
          _isOtpSent = true;
        });
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
          setState(() {});
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isSendingOtp = false);
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
    setState(() => _isVerifyingOtp = true);
    try {
      await VoltiumApiService().verifyPhone(phone: phone, otp: otp);
      if (mounted) {
        setState(() {
          _isVerifyingOtp = false;
          _isPhoneVerified = true;
          _verifiedGuarantorPhone = phone;
        });
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
        setState(() => _isVerifyingOtp = false);
        _showError('Invalid OTP. Please try again.');
      }
    }
  }

  bool get _isFormComplete {
    final missing = GuarantorFormValidator.validate(
      name: _nameController.text,
      dob: _dobController.text,
      phone: _phoneController.text,
      isPhoneVerified: _isPhoneVerified,
      fatherName: _fatherNameController.text,
      motherName: _motherNameController.text,
      address: _addressController.text,
      aadhaarFrontUploaded: _aadhaarFrontUploaded,
      aadhaarBackUploaded: _aadhaarBackUploaded,
      panUploaded: _panUploaded,
      photoUploaded: _photoUploaded,
      videoUploaded: _videoUploaded,
      signatureUploaded: _signatureUploaded,
      riderPhone: context.read<AppProvider>().rider?.phone,
    );
    return missing.isEmpty;
  }

  void _showError(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(msg), backgroundColor: AppColors.error),
    );
  }

  Future<void> _handleSubmit() async {
    final isTestMode = AppConstants.isTestMode;
    final provider = context.read<AppProvider>();
    final rider = provider.rider;

    if (!isTestMode) {
      final missing = GuarantorFormValidator.validate(
        name: _nameController.text,
        dob: _dobController.text,
        phone: _phoneController.text,
        isPhoneVerified: _isPhoneVerified,
        fatherName: _fatherNameController.text,
        motherName: _motherNameController.text,
        address: _addressController.text,
        aadhaarFrontUploaded: _aadhaarFrontUploaded,
        aadhaarBackUploaded: _aadhaarBackUploaded,
        panUploaded: _panUploaded,
        photoUploaded: _photoUploaded,
        videoUploaded: _videoUploaded,
        signatureUploaded: _signatureUploaded,
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
    setState(() => _isUploading = true);
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
        final Map<String, dynamic> tasks = {};
        if (_aadhaarFrontPath != null)
          tasks['Aadhaar Front'] = () => VoltiumApiService()
              .uploadFile(File(_aadhaarFrontPath!), 'kyc_document');
        if (_aadhaarBackPath != null)
          tasks['Aadhaar Back'] = () => VoltiumApiService()
              .uploadFile(File(_aadhaarBackPath!), 'kyc_document');
        if (_panPath != null)
          tasks['PAN'] = () =>
              VoltiumApiService().uploadFile(File(_panPath!), 'kyc_document');
        if (_videoPath != null)
          tasks['Video'] = () =>
              VoltiumApiService().uploadFile(File(_videoPath!), 'kyc_document');
        if (_signaturePath != null)
          tasks['Signature'] = () => VoltiumApiService()
              .uploadFile(File(_signaturePath!), 'kyc_document');
        if (_photoPath != null)
          tasks['Photo'] = () => VoltiumApiService()
              .uploadFile(File(_photoPath!), 'profile_photo');

        int completed = 0;
        final results = <String, String>{};

        for (final entry in tasks.entries) {
          if (mounted) {
            setState(() {
              _uploadProgressText =
                  'Uploading ${completed + 1} of ${tasks.length}...';
            });
          }
          results[entry.key] = await entry.value();
          completed++;
        }

        aadhaarFrontUrl = results['Aadhaar Front'] ?? '';
        aadhaarBackUrl = results['Aadhaar Back'] ?? '';
        panUrl = results['PAN'] ?? '';
        videoUrl = results['Video'] ?? '';
        signatureUrl = results['Signature'] ?? '';
        photoUrl = results['Photo'] ?? '';
      }

      if (mounted) {
        setState(() => _uploadProgressText = 'Saving profile...');
      }
      await VoltiumApiService().updateProfile(
        riderId: riderId,
        data: {
          'guarantorName': _nameController.text,
          'guarantorDob': _dobController.text,
          'guarantorPhone': _phoneController.text,
          'guarantorFatherName': _fatherNameController.text,
          'guarantorMotherName': _motherNameController.text,
          'guarantorAddress': _addressController.text,
          'guarantorAadhaarFront': aadhaarFrontUrl,
          'guarantorAadhaarBack': aadhaarBackUrl,
          'guarantorPan': panUrl,
          'guarantorVideo': videoUrl,
          'guarantorSignature': signatureUrl,
          'guarantorPhoto': photoUrl,
          'guarantorStatus': 'SUBMITTED',
        },
      );
      await GuarantorCache.clearFormCache(riderId);
      await provider.refresh();
      if (mounted) {
        widget.onNext?.call();
      }
    } catch (e) {
      if (mounted) {
        String userMessage = 'Something went wrong. Please try again.';
        final msg = e.toString();
        debugPrint('Guarantor update error: $msg');

        if (e is DioException && e.response?.data != null) {
          final data = e.response!.data;
          debugPrint('Backend error data: $data');
          if (data is Map && data['message'] != null) {
            userMessage = data['message'];
            if (data['errors'] != null) {
              userMessage += ': ${data['errors']}';
            }
          }
        } else if (msg.contains('422') || msg.contains('VALIDATION')) {
          userMessage = 'Please check your documents and try uploading again.';
        } else if (msg.contains('401') || msg.contains('unauthorized')) {
          userMessage = 'Session expired. Please log in again.';
        } else if (msg.contains('network') || msg.contains('timeout')) {
          userMessage = 'No internet connection. Please check and retry.';
        }
        _showError(userMessage);
      }
    } finally {
      if (mounted) setState(() => _isUploading = false);
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
      builder: (ctx) => AlertDialog(
        title: const Text('Skip Guarantor?'),
        content: const Text(
          'Without a guarantor, you will be required to pay a higher '
          'security deposit (₹5,000 instead of ₹2,000) when you select '
          'a plan.\n\n'
          'You can add a guarantor later from Profile → Settings.\n\n'
          'Do you want to continue without a guarantor?',
        ),
        actions: [
          TextButton(
            key: const Key('skipGuarantorCancelButton'),
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancel'),
          ),
          TextButton(
            key: const Key('skipGuarantorConfirmButton'),
            onPressed: () => Navigator.of(ctx).pop(true),
            style: TextButton.styleFrom(
              foregroundColor: AppColors.error,
            ),
            child: const Text('Skip'),
          ),
        ],
      ),
    );

    if (confirmed != true || !mounted) return;

    // Persist the higher-deposit flag in cache so the pre-dashboard
    // can read it. The backend does not have a `requiresHigherDeposit`
    // field yet, so this is a local signal only.
    final riderId = context.read<AppProvider>().rider?.id;
    if (riderId != null) {
      await CacheService()
          .setString('voltium_requires_higher_deposit:$riderId', 'true');
    }

    // Clear the form cache so a returning user doesn't see a half-
    // filled guarantor form if they change their mind.
    await CacheService().remove('guarantor_onboarding_form_cache');

    if (mounted) widget.onNext?.call();
  }

  Future<void> _selectDob() async {
    final date = await showDatePicker(
      context: context,
      initialDate: DateTime(1990),
      firstDate: DateTime(1940),
      lastDate: DateTime.now().subtract(const Duration(days: 365 * 18)),
    );
    if (date != null && mounted) {
      setState(
        () => _dobController.text =
            '${date.day.toString().padLeft(2, '0')}-${date.month.toString().padLeft(2, '0')}-${date.year}',
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    debugPrint('GuarantorOnboardingScreen: build called');
    return Scaffold(
      backgroundColor: const Color(0xFFF3F4F6),
      body: SafeArea(
        child: Column(
          children: [
            GuarantorOnboardingHeader(
              onBack: () => widget.onBack?.call(),
            ),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.symmetric(vertical: 16),
                children: [
                  Container(
                    margin:
                        const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: AppColors.error.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(8),
                      border:
                          Border.all(color: AppColors.error.withOpacity(0.5)),
                    ),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Icon(Icons.warning_amber_rounded,
                            color: AppColors.error, size: 20),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            'Important: The Guarantor assumes full legal and financial liability for the vehicle during the rental period.',
                            style: GoogleFonts.inter(
                              fontSize: 12,
                              color: AppColors.error,
                              height: 1.4,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const GuarantorOnboardingProgressSection(),
                  const SizedBox(height: 16),
                  // Bug 25: explicit legal-liability disclosure so the user
                  // understands what they are signing up their guarantor
                  // for. Without this, a rider could tap "Complete" without
                  // realising the guarantor is taking on real financial
                  // liability.
                  const _GuarantorLiabilityBanner(),
                  const SizedBox(height: 24),
                  GuarantorDetailsCard(
                    nameController: _nameController,
                    dobController: _dobController,
                    phoneController: _phoneController,
                    fatherNameController: _fatherNameController,
                    motherNameController: _motherNameController,
                    addressController: _addressController,
                    isPhoneVerified: _isPhoneVerified,
                    isSendingOtp: _isSendingOtp,
                    isOtpSent: _isOtpSent,
                    isVerifyingOtp: _isVerifyingOtp,
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
                        setState(() {});
                      },
                    ),
                  ),
                  const SizedBox(height: 16),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: GuarantorIdentityVerificationCard(
                      aadhaarFrontUploaded: _aadhaarFrontUploaded,
                      aadhaarBackUploaded: _aadhaarBackUploaded,
                      panUploaded: _panUploaded,
                      photoUploaded: _photoUploaded,
                      onPickAadhaarFront: () =>
                          _showDocumentSourceDialog('aadhaar_front'),
                      onPickAadhaarBack: () =>
                          _showDocumentSourceDialog('aadhaar_back'),
                      onPickPan: () => _showDocumentSourceDialog('pan'),
                      onPickPhoto: () => _showDocumentSourceDialog('photo'),
                    ),
                  ),
                  const SizedBox(height: 16),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: GuarantorVideoProofCard(
                      videoUploaded: _videoUploaded,
                      videoPath: _videoPath,
                      onTap: _pickVideo,
                    ),
                  ),
                  const SizedBox(height: 16),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: GuarantorSignatureCard(
                      signatureUploaded: _signatureUploaded,
                      onTap: _openSignaturePad,
                    ),
                  ),
                  const SizedBox(height: 24),
                ],
              ),
            ),
            GuarantorOnboardingBottomButton(
              canProceed: AppConstants.isTestMode || _isFormComplete,
              isUploading: _isUploading,
              uploadProgressText: _uploadProgressText,
              onSubmit: _handleSubmit,
              onSkip: _handleSkip,
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
class _GuarantorLiabilityBanner extends StatelessWidget {
  const _GuarantorLiabilityBanner();

  @override
  Widget build(BuildContext context) {
    return Container(
      key: const Key('guarantorLiabilityBanner'),
      margin: const EdgeInsets.symmetric(horizontal: 16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFFEF3C7),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFF59E0B), width: 1),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(
            Icons.warning_amber_rounded,
            color: Color(0xFFB45309),
            size: 24,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Your guarantor takes on real financial liability',
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF92400E),
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'By submitting this form, your guarantor becomes jointly '
                  'responsible for all rental charges, damages, and penalties '
                  'for the duration of your subscription. Read the Guarantor '
                  'Agreement in the expandable card below for the full terms.',
                  style: const TextStyle(
                    fontSize: 12,
                    color: Color(0xFF78350F),
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
