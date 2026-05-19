import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:image_picker/image_picker.dart';
import 'dart:io';
import 'dart:convert';
import '../services/api_service.dart';
import '../services/image_compression_service.dart';
import '../services/cache_service.dart';
import '../providers/app_provider.dart';
import '../utils/phone_validator.dart';
import 'user_onboarding_screen.dart' show SignaturePadScreen;
import '../theme/app_theme.dart';

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
              child: Column(children: [
                _buildProgressSection(),
                const SizedBox(height: 24),
                _buildGuarantorDetailsCard(),
                const SizedBox(height: 16),
                _buildIdentityVerificationCard(),
                const SizedBox(height: 16),
                _buildVideoProofCard(),
                const SizedBox(height: 16),
                _buildSignatureCard(),
                const SizedBox(height: 120),
              ]),
            )),
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

  // ── Card Helper ───────────────────────────────────────────────────────────

  Widget _buildCard({
    required IconData icon,
    Color iconColor = const Color(0xFF2563EB),
    Color iconBgColor = const Color(0xFFEFF6FF),
    required String title,
    String? subtitle,
    required List<Widget> children,
  }) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFFE5E7EB)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  padding: const EdgeInsets.all(6),
                  decoration: BoxDecoration(
                    color: iconBgColor,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Icon(icon, color: iconColor, size: 18),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(title,
                          style: const TextStyle(
                              fontSize: 16, fontWeight: FontWeight.w600)),
                      if (subtitle != null) ...[
                        const SizedBox(height: 4),
                        Text(subtitle,
                            style: const TextStyle(
                                fontSize: 12, color: Color(0xFF6B7280))),
                      ],
                    ],
                  ),
                ),
              ],
            ),
            ...children,
          ],
        ),
      ),
    );
  }

  // ── Guarantor's Details Card ──────────────────────────────────────────────

  Widget _buildGuarantorDetailsCard() {
    return _buildCard(
      icon: Icons.person,
      iconColor: const Color(0xFF2563EB),
      iconBgColor: const Color(0xFFEFF6FF),
      title: "Guarantor's Details",
      children: [
        const SizedBox(height: 16),
        _buildTextField(
            'Full Name', 'Enter guarantor full name', _nameController,
            key: const Key('guarantorNameField')),
        const SizedBox(height: 14),
        _buildDateField('Date of Birth', _dobController),
        const SizedBox(height: 14),
        _buildPhoneField(),
        // Show verified badge when phone is verified
        if (_isPhoneVerified) ...[
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: const Color(0xFFDCFCE7),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: const Color(0xFF10B981)),
            ),
            child: Row(
              children: const [
                Icon(Icons.check_circle, color: Color(0xFF10B981), size: 18),
                SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Guarantor phone number verified successfully',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF065F46),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
        // Show OTP section only when OTP has been sent and phone not yet verified
        if (_isOtpSent && !_isPhoneVerified) ...[
          const SizedBox(height: 14),
          const Text('6-digit OTP',
              style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w500,
                  color: Color(0xFF374151))),
          const SizedBox(height: 8),
          _buildOtpBoxes(),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            height: 44,
            child: OutlinedButton(
              onPressed: _isVerifyingOtp ? null : _verifyOtp,
              style: OutlinedButton.styleFrom(
                foregroundColor: const Color(0xFF2563EB),
                side: const BorderSide(color: Color(0xFF2563EB), width: 2),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8)),
              ),
              child: _isVerifyingOtp
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(
                          color: Color(0xFF2563EB), strokeWidth: 2),
                    )
                  : const Text('VERIFY OTP',
                      style:
                          TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
            ),
          ),
        ],
        const SizedBox(height: 14),
        _buildTextField(
            "Father's Name", "Enter father's name", _fatherNameController,
            key: const Key('guarantorFatherNameField')),
        const SizedBox(height: 14),
        _buildTextField(
            "Mother's Name", "Enter mother's name", _motherNameController,
            key: const Key('guarantorMotherNameField')),
        const SizedBox(height: 14),
        _buildTextArea('Current Address', 'Enter guarantor full address',
            _addressController),
      ],
    );
  }

  Widget _buildTextField(
      String label, String hint, TextEditingController controller,
      {Key? key}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label,
            style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w500,
                color: Color(0xFF374151))),
        const SizedBox(height: 6),
        Container(
          height: 48,
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: const Color(0xFFD1D5DB)),
          ),
          padding: const EdgeInsets.symmetric(horizontal: 12),
          child: TextFormField(
            key: key,
            controller: controller,
            style: const TextStyle(fontSize: 14),
            decoration: InputDecoration(
              border: InputBorder.none,
              focusedBorder: InputBorder.none,
              enabledBorder: InputBorder.none,
              errorBorder: InputBorder.none,
              focusedErrorBorder: InputBorder.none,
              contentPadding: EdgeInsets.zero,
              hintText: hint,
              hintStyle:
                  const TextStyle(color: Color(0xFF9CA3AF), fontSize: 14),
              filled: false,
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildDateField(String label, TextEditingController controller) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label,
            style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w500,
                color: Color(0xFF374151))),
        const SizedBox(height: 6),
        GestureDetector(
          onTap: () async {
            final date = await showDatePicker(
              context: context,
              initialDate: DateTime(1990),
              firstDate: DateTime(1940),
              lastDate: DateTime.now().subtract(const Duration(days: 365 * 18)),
            );
            if (date != null && mounted) {
              setState(() => controller.text =
                  '${date.day.toString().padLeft(2, '0')}-${date.month.toString().padLeft(2, '0')}-${date.year}');
            }
          },
          child: Container(
            height: 48,
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: const Color(0xFFD1D5DB)),
            ),
            padding: const EdgeInsets.symmetric(horizontal: 12),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    controller.text.isEmpty ? 'DD-MM-YYYY' : controller.text,
                    style: TextStyle(
                      fontSize: 14,
                      color: controller.text.isEmpty
                          ? const Color(0xFF9CA3AF)
                          : const Color(0xFF111827),
                    ),
                  ),
                ),
                const Icon(Icons.calendar_today_outlined,
                    color: Color(0xFF6B7280), size: 18),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildTextArea(
      String label, String hint, TextEditingController controller) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label,
            style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w500,
                color: Color(0xFF374151))),
        const SizedBox(height: 6),
        Container(
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: const Color(0xFFD1D5DB)),
          ),
          padding: const EdgeInsets.symmetric(horizontal: 12),
          child: TextFormField(
            controller: controller,
            maxLines: 3,
            style: const TextStyle(fontSize: 14),
            decoration: InputDecoration(
              border: InputBorder.none,
              focusedBorder: InputBorder.none,
              enabledBorder: InputBorder.none,
              contentPadding: EdgeInsets.zero,
              hintText: hint,
              hintStyle:
                  const TextStyle(color: Color(0xFF9CA3AF), fontSize: 14),
              filled: false,
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildPhoneField() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Phone Number',
            style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w500,
                color: Color(0xFF374151))),
        const SizedBox(height: 6),
        Row(
          children: [
            Expanded(
              child: Container(
                height: 48,
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: const Color(0xFFD1D5DB)),
                ),
                padding: const EdgeInsets.symmetric(horizontal: 12),
                child: TextFormField(
                  key: const Key('guarantorPhoneField'),
                  controller: _phoneController,
                  keyboardType: TextInputType.phone,
                  enabled: !_isPhoneVerified,
                  inputFormatters: [
                    FilteringTextInputFormatter.digitsOnly,
                    LengthLimitingTextInputFormatter(10)
                  ],
                  style: const TextStyle(fontSize: 14),
                  decoration: const InputDecoration(
                    border: InputBorder.none,
                    focusedBorder: InputBorder.none,
                    enabledBorder: InputBorder.none,
                    contentPadding: EdgeInsets.zero,
                    hintText: '+91 00000 00000',
                    hintStyle:
                        TextStyle(color: Color(0xFF9CA3AF), fontSize: 14),
                    filled: false,
                  ),
                ),
              ),
            ),
            const SizedBox(width: 8),
            SizedBox(
              height: 48,
              child: OutlinedButton(
                onPressed: _isPhoneVerified ? null : _sendOtp,
                style: OutlinedButton.styleFrom(
                  foregroundColor: const Color(0xFF2563EB),
                  side: const BorderSide(color: Color(0xFF2563EB)),
                  disabledForegroundColor: const Color(0xFF9CA3AF),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8)),
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                ),
                child: _isSendingOtp
                    ? const SizedBox(
                        width: 14,
                        height: 14,
                        child: CircularProgressIndicator(
                            color: Color(0xFF2563EB), strokeWidth: 2),
                      )
                    : Text(
                        _isPhoneVerified ? 'Verified' : 'SEND OTP',
                        style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                            color: Color(0xFF2563EB)),
                      ),
              ),
            ),
          ],
        ),
      ],
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

  // ── Identity Verification Card ────────────────────────────────────────────

  Widget _buildIdentityVerificationCard() {
    return _buildCard(
      icon: Icons.badge_outlined,
      iconColor: const Color(0xFF4F46E5),
      iconBgColor: const Color(0xFFEEF2FF),
      title: 'Identity Verification',
      subtitle: 'Clear photos only. Max 5MB each.',
      children: [
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: _buildDocTile(
                'Aadhaar Card\n(Front)',
                Icons.upload_file,
                _aadhaarFrontUploaded,
                () => _showDocumentSourceDialog('aadhaar_front'),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _buildDocTile(
                'Aadhaar Card\n(Back)',
                Icons.upload_file,
                _aadhaarBackUploaded,
                () => _showDocumentSourceDialog('aadhaar_back'),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: _buildDocTile(
                'PAN Card',
                Icons.upload_file,
                _panUploaded,
                () => _showDocumentSourceDialog('pan'),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _buildDocTile(
                'Guarantor\nPhoto',
                Icons.photo_camera,
                _photoUploaded,
                () => _showDocumentSourceDialog('photo'),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildDocTile(
      String label, IconData icon, bool uploaded, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: uploaded ? const Color(0xFFDCFCE7) : const Color(0xFFF9FAFB),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: uploaded ? const Color(0xFF10B981) : const Color(0xFFD1D5DB),
            width: uploaded ? 1 : 2,
            strokeAlign: BorderSide.strokeAlignInside,
          ),
        ),
        child: Column(
          children: [
            Icon(
              uploaded ? Icons.check_circle : icon,
              color:
                  uploaded ? const Color(0xFF10B981) : const Color(0xFF6B7280),
              size: 24,
            ),
            const SizedBox(height: 6),
            Text(
              uploaded ? 'Uploaded' : label,
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w500,
                color: uploaded
                    ? const Color(0xFF10B981)
                    : const Color(0xFF374151),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ── Video Proof Card ──────────────────────────────────────────────────────

  Widget _buildVideoProofCard() {
    return _buildCard(
      icon: Icons.videocam,
      iconColor: const Color(0xFFEF4444),
      iconBgColor: const Color(0xFFFEF2F2),
      title: 'Video Proof',
      subtitle: 'Record a 5-second video saying your name.',
      children: [
        const SizedBox(height: 16),
        GestureDetector(
          onTap: _pickVideo,
          child: Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(vertical: 24),
            decoration: BoxDecoration(
              color: const Color(0xFFF9FAFB),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: _videoUploaded
                    ? const Color(0xFF10B981)
                    : const Color(0xFFD1D5DB),
                width: _videoUploaded ? 1 : 2,
              ),
            ),
            child: Column(
              children: [
                Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(
                    color: const Color(0xFF2563EB).withOpacity(0.1),
                    borderRadius: BorderRadius.circular(24),
                  ),
                  child: Icon(
                    _videoUploaded
                        ? Icons.check_circle
                        : Icons.fiber_manual_record,
                    color: _videoUploaded
                        ? const Color(0xFF10B981)
                        : const Color(0xFF2563EB),
                    size: 24,
                  ),
                ),
                const SizedBox(height: 12),
                Text(
                  _videoUploaded ? 'Video Recorded' : 'Start Recording',
                  style: const TextStyle(
                      fontSize: 14, fontWeight: FontWeight.w500),
                ),
                const SizedBox(height: 4),
                const Text(
                  'or click to upload video file',
                  style: TextStyle(fontSize: 12, color: Color(0xFF6B7280)),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  // ── Signature Card ────────────────────────────────────────────────────────

  Widget _buildSignatureCard() {
    return _buildCard(
      icon: Icons.draw,
      iconColor: const Color(0xFF2563EB),
      iconBgColor: const Color(0xFFEFF6FF),
      title: 'Digital Signature',
      subtitle: 'Sign below to authorize documentation.',
      children: [
        const SizedBox(height: 16),
        GestureDetector(
          onTap: _openSignaturePad,
          child: Container(
            width: double.infinity,
            height: 128,
            decoration: BoxDecoration(
              color: const Color(0xFFF9FAFB),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: _signatureUploaded
                    ? const Color(0xFF10B981)
                    : const Color(0xFFD1D5DB),
                width: _signatureUploaded ? 1 : 2,
              ),
            ),
            child: Center(
              child: _signatureUploaded
                  ? const Icon(Icons.check_circle,
                      color: Color(0xFF10B981), size: 32)
                  : const Text('Tap to draw signature',
                      style: TextStyle(fontSize: 14, color: Color(0xFF9CA3AF))),
            ),
          ),
        ),
      ],
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
}
