import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:image_picker/image_picker.dart';
import 'dart:io';
import 'dart:convert';
import 'package:voltium_rider/services/api_service.dart';
import 'package:voltium_rider/services/image_compression_service.dart';
import 'package:voltium_rider/services/cache_service.dart';
import 'package:voltium_rider/providers/app_provider.dart';
import 'package:voltium_rider/utils/phone_validator.dart';
import 'package:voltium_rider/features/kyc/presentation/screens/user_onboarding_screen.dart' show SignaturePadScreen;
import 'package:voltium_rider/features/guarantor/presentation/widgets/guarantor_onboarding_widgets.dart';
import 'package:voltium_rider/theme/app_theme.dart';

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
    CacheService().setString('guarantor_onboarding_form_cache', jsonEncode(cacheData));
  }

  void _loadCache() {
    final cachedStr = CacheService().getString('guarantor_onboarding_form_cache');
    if (cachedStr != null && cachedStr.isNotEmpty) {
      try {
        final cacheData = jsonDecode(cachedStr) as Map<String, dynamic>;
        _nameController.text = cacheData['name'] ?? '';
        _dobController.text = cacheData['dob'] ?? '';
        _phoneController.text = cacheData['phone'] ?? '';
        _fatherNameController.text = cacheData['fatherName'] ?? '';
        _motherNameController.text = cacheData['motherName'] ?? '';
        _addressController.text = cacheData['address'] ?? '';
        _isPhoneVerified = cacheData['isPhoneVerified'] ?? false;
        _verifiedGuarantorPhone = cacheData['verifiedPhone'] ?? '';

        _aadhaarFrontPath = cacheData['aadhaarFrontPath'];
        _aadhaarFrontUploaded = _aadhaarFrontPath != null && _aadhaarFrontPath!.isNotEmpty;

        _aadhaarBackPath = cacheData['aadhaarBackPath'];
        _aadhaarBackUploaded = _aadhaarBackPath != null && _aadhaarBackPath!.isNotEmpty;

        _panPath = cacheData['panPath'];
        _panUploaded = _panPath != null && _panPath!.isNotEmpty;

        _videoPath = cacheData['videoPath'];
        _videoUploaded = _videoPath != null && _videoPath!.isNotEmpty;

        _signaturePath = cacheData['signaturePath'];
        _signatureUploaded = _signaturePath != null && _signaturePath!.isNotEmpty;

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

    _nameController.addListener(_saveCache);
    _dobController.addListener(_saveCache);
    _fatherNameController.addListener(_saveCache);
    _motherNameController.addListener(_saveCache);
    _addressController.addListener(_saveCache);

    _phoneController.addListener(() {
      final inputPhone = _phoneController.text.replaceAll(RegExp(r'\D'), '');
      final cleanVerified = _verifiedGuarantorPhone.replaceAll(RegExp(r'\D'), '');
      if (_isPhoneVerified && inputPhone != cleanVerified) {
        setState(() {
          _isPhoneVerified = false;
          _isOtpSent = false;
        });
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
                leading: Icon(Icons.camera_alt, color: AppColors.primary),
                title: const Text('Take a Photo'),
                onTap: () {
                  Navigator.pop(context);
                  _pickDocument(type, true);
                },
              ),
              ListTile(
                leading: Icon(Icons.photo_library, color: AppColors.primary),
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
      final result = await ApiService().sendOtp(phone: phone);
      if (mounted) {
        setState(() {
          _isSendingOtp = false;
          _isOtpSent = true;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('OTP sent to guarantor phone'),
            backgroundColor: Color(0xFF10B981),
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
        _showError(e.toString().contains('ApiException')
            ? 'Failed to send OTP. Please try again.'
            : 'Network error. Check your connection.');
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
      await ApiService().verifyPhone(phone: phone, otp: otp);
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
            backgroundColor: Color(0xFF10B981),
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
    return _nameController.text.isNotEmpty &&
        _dobController.text.isNotEmpty &&
        _phoneController.text.isNotEmpty &&
        _isPhoneVerified &&
        _fatherNameController.text.isNotEmpty &&
        _motherNameController.text.isNotEmpty &&
        _addressController.text.isNotEmpty &&
        _aadhaarFrontUploaded &&
        _aadhaarBackUploaded &&
        _panUploaded &&
        _photoUploaded &&
        _videoUploaded &&
        _signatureUploaded;
  }

  void _showError(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(msg), backgroundColor: const Color(0xFFEF4444)),
    );
  }

  Future<void> _handleSubmit() async {
    if (const String.fromEnvironment('TEST_MODE') != 'true' &&
        !_isFormComplete) {
      _showError('Please complete all fields and documents before continuing.');
      return;
    }
    final provider = context.read<AppProvider>();
    final riderId = provider.rider?.id;
    if (riderId == null) {
      _showError('Rider ID not found. Please restart onboarding.');
      return;
    }
    setState(() => _isUploading = true);
    try {
      String aadhaarFrontUrl = '',
          aadhaarBackUrl = '',
          panUrl = '',
          videoUrl = '',
          signatureUrl = '',
          photoUrl = '';

      if (const String.fromEnvironment('TEST_MODE') == 'true') {
        aadhaarFrontUrl = 'mock_url_front.png';
        aadhaarBackUrl = 'mock_url_back.png';
        panUrl = 'mock_url_pan.png';
        videoUrl = 'mock_url_video.mp4';
        signatureUrl = 'mock_url_signature.png';
        photoUrl = 'mock_url_photo.png';
      } else {
        final uploads = <Future<String>>[];
        final uploadLabels = <int>[];

        if (_aadhaarFrontPath != null) {
          uploads.add(ApiService()
              .uploadFile(File(_aadhaarFrontPath!), 'GUARANTOR_AADHAAR_FRONT'));
          uploadLabels.add(0);
        }
        if (_aadhaarBackPath != null) {
          uploads.add(ApiService()
              .uploadFile(File(_aadhaarBackPath!), 'GUARANTOR_AADHAAR_BACK'));
          uploadLabels.add(1);
        }
        if (_panPath != null) {
          uploads
              .add(ApiService().uploadFile(File(_panPath!), 'GUARANTOR_PAN'));
          uploadLabels.add(2);
        }
        if (_videoPath != null) {
          uploads.add(
              ApiService().uploadFile(File(_videoPath!), 'GUARANTOR_VIDEO'));
          uploadLabels.add(3);
        }
        if (_signaturePath != null) {
          uploads.add(ApiService()
              .uploadFile(File(_signaturePath!), 'GUARANTOR_SIGNATURE'));
          uploadLabels.add(4);
        }
        if (_photoPath != null) {
          uploads.add(
              ApiService().uploadFile(File(_photoPath!), 'GUARANTOR_PHOTO'));
          uploadLabels.add(5);
        }

        final results = await Future.wait(uploads);
        for (int i = 0; i < results.length; i++) {
          final url = results[i];
          switch (uploadLabels[i]) {
            case 0:
              aadhaarFrontUrl = url;
              break;
            case 1:
              aadhaarBackUrl = url;
              break;
            case 2:
              panUrl = url;
              break;
            case 3:
              videoUrl = url;
              break;
            case 4:
              signatureUrl = url;
              break;
            case 5:
              photoUrl = url;
              break;
          }
        }
      }
      await ApiService().updateProfile(riderId: riderId, data: {
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
      });
      await CacheService().remove('guarantor_onboarding_form_cache');
      await provider.refresh();
      if (mounted && widget.onNext != null) widget.onNext!();
    } catch (e) {
      if (mounted) {
        String userMessage = 'Something went wrong. Please try again.';
        final msg = e.toString();
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
      if (mounted) setState(() => _isUploading = false);
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
      setState(() => _dobController.text =
          '${date.day.toString().padLeft(2, '0')}-${date.month.toString().padLeft(2, '0')}-${date.year}');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF3F4F6),
      body: SafeArea(
        child: Column(
          children: [
            _buildHeader(),
            Expanded(
              child: SingleChildScrollView(
                child: Column(
                  children: [
                    _buildProgressSection(),
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
                      otpBoxes: _buildOtpBoxes(),
                    ),
                    const SizedBox(height: 16),
                    GuarantorIdentityVerificationCard(
                      aadhaarFrontUploaded: _aadhaarFrontUploaded,
                      aadhaarBackUploaded: _aadhaarBackUploaded,
                      panUploaded: _panUploaded,
                      photoUploaded: _photoUploaded,
                      onPickAadhaarFront: () => _showDocumentSourceDialog('aadhaar_front'),
                      onPickAadhaarBack: () => _showDocumentSourceDialog('aadhaar_back'),
                      onPickPan: () => _showDocumentSourceDialog('pan'),
                      onPickPhoto: () => _showDocumentSourceDialog('photo'),
                    ),
                    const SizedBox(height: 16),
                    GuarantorVideoProofCard(
                      videoUploaded: _videoUploaded,
                      videoPath: _videoPath,
                      onTap: _pickVideo,
                    ),
                    const SizedBox(height: 16),
                    GuarantorSignatureCard(
                      signatureUploaded: _signatureUploaded,
                      onTap: _openSignaturePad,
                    ),
                    const SizedBox(height: 120),
                  ],
                ),
              ),
            ),
            _buildBottomButton(),
          ],
        ),
      ),
    );
  }

  // ── Header ────────────────────────────────────────────────────────────────

  Widget _buildHeader() {
    return Container(
      color: Colors.white,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
        child: Row(
          children: [
            IconButton(
              icon: const Icon(Icons.arrow_back),
              onPressed: () => widget.onBack?.call(),
            ),
            const Expanded(
              child: Text(
                'Onboarding',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
              ),
            ),
            Padding(
              padding: const EdgeInsets.only(right: 8),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.end,
                children: const [
                  Text('Step',
                      style: TextStyle(fontSize: 11, color: Color(0xFF6B7280))),
                  Text('2/2',
                      style:
                          TextStyle(fontSize: 11, fontWeight: FontWeight.w600)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ── Progress Section ──────────────────────────────────────────────────────

  Widget _buildProgressSection() {
    return Container(
      color: Colors.white,
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            height: 8,
            decoration: BoxDecoration(
              color: const Color(0xFFE5E7EB),
              borderRadius: BorderRadius.circular(4),
            ),
            child: FractionallySizedBox(
              alignment: Alignment.centerLeft,
              widthFactor: 1.0,
              child: Container(
                decoration: BoxDecoration(
                  color: const Color(0xFF10B981),
                  borderRadius: BorderRadius.circular(4),
                ),
              ),
            ),
          ),
          const SizedBox(height: 24),
          const Text('One more step',
              style: TextStyle(fontSize: 24, fontWeight: FontWeight.w700)),
          const SizedBox(height: 8),
          const Text(
            'We need a few more details to set up your fleet profile securely.',
            style: TextStyle(fontSize: 14, color: Color(0xFF6B7280)),
          ),
        ],
      ),
    );
  }

  Widget _buildOtpBoxes() {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: List.generate(6, (i) {
        return SizedBox(
          width: 40,
          height: 48,
          child: TextFormField(
            controller: _otpControllers[i],
            focusNode: _otpFocusNodes[i],
            keyboardType: TextInputType.number,
            maxLength: 1,
            textAlign: TextAlign.center,
            textInputAction:
                i < 5 ? TextInputAction.next : TextInputAction.done,
            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
            decoration: InputDecoration(
              counterText: '',
              filled: true,
              fillColor: Colors.white,
              contentPadding: EdgeInsets.zero,
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
                borderSide: const BorderSide(color: Color(0xFFD1D5DB)),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
                borderSide:
                    const BorderSide(color: Color(0xFF2563EB), width: 2),
              ),
            ),
            onChanged: (v) {
              if (v.length == 1 && i < 5) {
                FocusScope.of(context).requestFocus(_otpFocusNodes[i + 1]);
              } else if (v.isEmpty && i > 0) {
                FocusScope.of(context).requestFocus(_otpFocusNodes[i - 1]);
              }
              setState(() {});
            },
          ),
        );
      }),
    );
  }

  // ── Bottom Button ─────────────────────────────────────────────────────────

  Widget _buildBottomButton() {
    final bool canProceed =
        const String.fromEnvironment('TEST_MODE') == 'true' || _isFormComplete;
    return Container(
      color: Colors.white,
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
      child: SizedBox(
        width: double.infinity,
        height: 52,
        child: ElevatedButton(
          key: const Key('completeOnboardingButton'),
          onPressed: canProceed && !_isUploading ? _handleSubmit : null,
          style: ElevatedButton.styleFrom(
            backgroundColor:
                canProceed ? const Color(0xFF2563EB) : const Color(0xFF9CA3AF),
            disabledBackgroundColor: const Color(0xFF9CA3AF),
            shape:
                RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            elevation: 0,
          ),
          child: _isUploading
              ? const SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(
                      color: Colors.white, strokeWidth: 2),
                )
              : Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: const [
                    Text('FINISH SETUP',
                        style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w600,
                            color: Colors.white)),
                    SizedBox(width: 8),
                    Icon(Icons.check, color: Colors.white, size: 18),
                  ],
                ),
        ),
      ),
    );
  }
}          RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            elevation: 0,
          ),
          child: _isUploading
              ? const SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(
                      color: Colors.white, strokeWidth: 2),
                )
              : Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: const [
                    Text('FINISH SETUP',
                        style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w600,
                            color: Colors.white)),
                    SizedBox(width: 8),
                    Icon(Icons.check, color: Colors.white, size: 18),
                  ],
                ),
        ),
      ),
    );
  }
}
