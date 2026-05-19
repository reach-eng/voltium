import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:image_picker/image_picker.dart';
import 'dart:io';
import 'dart:ui' as ui;
import 'dart:convert';
import 'package:flutter/rendering.dart';
import 'package:path_provider/path_provider.dart';
import '../services/api_service.dart';
import '../services/image_compression_service.dart';
import '../services/cache_service.dart';
import '../providers/app_provider.dart';
import '../theme/app_theme.dart';

class UserOnboardingScreen extends StatefulWidget {
  final VoidCallback? onNext;
  final VoidCallback? onBack;

  const UserOnboardingScreen({super.key, this.onNext, this.onBack});

  @override
  State<UserOnboardingScreen> createState() => _UserOnboardingScreenState();
}

class _UserOnboardingScreenState extends State<UserOnboardingScreen> {
  final ImageCompressionService _compressionService = ImageCompressionService();
  final _nameController = TextEditingController();
  final _emailController = TextEditingController();
  final _addressController = TextEditingController();
  final _dobController = TextEditingController();
  final _fatherNameController = TextEditingController();
  final _motherNameController = TextEditingController();
  final _bankNameController = TextEditingController();
  final _bankAccountController = TextEditingController();
  final _bankIfscController = TextEditingController();

  bool _isUploading = false;
  bool _aadhaarFrontUploaded = false;
  bool _aadhaarBackUploaded = false;
  bool _panUploaded = false;
  bool _selfieUploaded = false;
  bool _signatureUploaded = false;

  String? _aadhaarFrontPath;
  String? _aadhaarBackPath;
  String? _panPath;
  String? _selfiePath;
  String? _signaturePath;

  void _saveCache() {
    final cacheData = {
      'name': _nameController.text,
      'email': _emailController.text,
      'address': _addressController.text,
      'dob': _dobController.text,
      'fatherName': _fatherNameController.text,
      'motherName': _motherNameController.text,
      'bankName': _bankNameController.text,
      'bankAccount': _bankAccountController.text,
      'bankIfsc': _bankIfscController.text,
      'aadhaarFrontPath': _aadhaarFrontPath,
      'aadhaarBackPath': _aadhaarBackPath,
      'panPath': _panPath,
      'selfiePath': _selfiePath,
      'signaturePath': _signaturePath,
    };
    CacheService().setString('user_onboarding_form_cache', jsonEncode(cacheData));
  }

  void _loadCache() {
    final cachedStr = CacheService().getString('user_onboarding_form_cache');
    if (cachedStr != null && cachedStr.isNotEmpty) {
      try {
        final cacheData = jsonDecode(cachedStr) as Map<String, dynamic>;
        _nameController.text = cacheData['name'] ?? '';
        _emailController.text = cacheData['email'] ?? '';
        _addressController.text = cacheData['address'] ?? '';
        _dobController.text = cacheData['dob'] ?? '';
        _fatherNameController.text = cacheData['fatherName'] ?? '';
        _motherNameController.text = cacheData['motherName'] ?? '';
        _bankNameController.text = cacheData['bankName'] ?? '';
        _bankAccountController.text = cacheData['bankAccount'] ?? '';
        _bankIfscController.text = cacheData['bankIfsc'] ?? '';

        _aadhaarFrontPath = cacheData['aadhaarFrontPath'];
        _aadhaarFrontUploaded = _aadhaarFrontPath != null && _aadhaarFrontPath!.isNotEmpty;

        _aadhaarBackPath = cacheData['aadhaarBackPath'];
        _aadhaarBackUploaded = _aadhaarBackPath != null && _aadhaarBackPath!.isNotEmpty;

        _panPath = cacheData['panPath'];
        _panUploaded = _panPath != null && _panPath!.isNotEmpty;

        _selfiePath = cacheData['selfiePath'];
        _selfieUploaded = _selfiePath != null && _selfiePath!.isNotEmpty;

        _signaturePath = cacheData['signaturePath'];
        _signatureUploaded = _signaturePath != null && _signaturePath!.isNotEmpty;
      } catch (e) {
        debugPrint('Error loading user onboarding cache: $e');
      }
    }
  }

  @override
  void initState() {
    super.initState();
    _loadCache();

    _nameController.addListener(_saveCache);
    _emailController.addListener(_saveCache);
    _addressController.addListener(_saveCache);
    _dobController.addListener(_saveCache);
    _fatherNameController.addListener(_saveCache);
    _motherNameController.addListener(_saveCache);
    _bankNameController.addListener(_saveCache);
    _bankAccountController.addListener(_saveCache);
    _bankIfscController.addListener(_saveCache);

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (const String.fromEnvironment('TEST_MODE') == 'true') {
        if (_dobController.text.isEmpty) {
          setState(() {
            _dobController.text = '01-01-2000';
          });
        }
      }
      final rider = context.read<AppProvider>().rider;
      if (rider != null) {
        if (_nameController.text.isEmpty) {
          setState(() {
            _nameController.text = rider.name;
          });
        }
        if (_emailController.text.isEmpty) {
          setState(() {
            _emailController.text = rider.email ?? '';
          });
        }
      }
    });
  }

  @override
  void dispose() {
    _nameController.removeListener(_saveCache);
    _emailController.removeListener(_saveCache);
    _addressController.removeListener(_saveCache);
    _dobController.removeListener(_saveCache);
    _fatherNameController.removeListener(_saveCache);
    _motherNameController.removeListener(_saveCache);
    _bankNameController.removeListener(_saveCache);
    _bankAccountController.removeListener(_saveCache);
    _bankIfscController.removeListener(_saveCache);

    _nameController.dispose();
    _emailController.dispose();
    _addressController.dispose();
    _dobController.dispose();
    _fatherNameController.dispose();
    _motherNameController.dispose();
    _bankNameController.dispose();
    _bankAccountController.dispose();
    _bankIfscController.dispose();
    super.dispose();
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
            case 'selfie':
              _selfieUploaded = true;
              _selfiePath = compressedFile.path;
              break;
          }
        });
        _saveCache();
      }
    } catch (e) {
      if (mounted) _showError('Failed to capture document. Please try again.');
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

  bool get _isFormComplete {
    final emailRegex = RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$');
    return _nameController.text.isNotEmpty &&
        _dobController.text.isNotEmpty &&
        emailRegex.hasMatch(_emailController.text) &&
        _fatherNameController.text.isNotEmpty &&
        _motherNameController.text.isNotEmpty &&
        _addressController.text.isNotEmpty &&
        _aadhaarFrontUploaded &&
        _aadhaarBackUploaded &&
        _panUploaded &&
        _selfieUploaded &&
        _signatureUploaded &&
        _bankNameController.text.isNotEmpty &&
        _bankAccountController.text.length >= 9 &&
        _bankIfscController.text.length >= 8;
  }

  void _showError(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(msg), backgroundColor: AppColors.error),
    );
  }

  Future<void> _handleNext() async {
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
      String aadhaarFrontUrl = '';
      String aadhaarBackUrl = '';
      String panUrl = '';
      String selfieUrl = '';
      String signatureUrl = '';

      if (const String.fromEnvironment('TEST_MODE') == 'true') {
        aadhaarFrontUrl = 'mock_url_front.png';
        aadhaarBackUrl = 'mock_url_back.png';
        panUrl = 'mock_url_pan.png';
        selfieUrl = 'mock_url_selfie.png';
        signatureUrl = 'mock_url_signature.png';
      } else {
        final uploads = <Future<String>>[];
        final uploadTypes = <int>[];
        int idx = 0;

        if (_aadhaarFrontPath != null) {
          uploads.add(ApiService()
              .uploadFile(File(_aadhaarFrontPath!), 'KYC_AADHAAR_FRONT'));
          uploadTypes.add(idx++);
        }
        if (_aadhaarBackPath != null) {
          uploads.add(ApiService()
              .uploadFile(File(_aadhaarBackPath!), 'KYC_AADHAAR_BACK'));
          uploadTypes.add(idx++);
        }
        if (_panPath != null) {
          uploads.add(ApiService().uploadFile(File(_panPath!), 'KYC_PAN'));
          uploadTypes.add(idx++);
        }
        if (_selfiePath != null) {
          uploads
              .add(ApiService().uploadFile(File(_selfiePath!), 'KYC_SELFIE'));
          uploadTypes.add(idx++);
        }
        if (_signaturePath != null) {
          uploads.add(
              ApiService().uploadFile(File(_signaturePath!), 'KYC_SIGNATURE'));
          uploadTypes.add(idx++);
        }

        final results = await Future.wait(uploads);
        for (int i = 0; i < results.length; i++) {
          final url = results[i];
          final type = uploadTypes[i];
          if (type == 0)
            aadhaarFrontUrl = url;
          else if (type == 1)
            aadhaarBackUrl = url;
          else if (type == 2)
            panUrl = url;
          else if (type == 3)
            selfieUrl = url;
          else if (type == 4) signatureUrl = url;
        }
      }

      await ApiService().updateProfile(
        riderId: riderId,
        data: {
          'fullName': _nameController.text,
          'email': _emailController.text,
          'currentAddress': _addressController.text,
          'dob': _dobController.text,
          'fatherName': _fatherNameController.text,
          'motherName': _motherNameController.text,
          'aadhaarFront': aadhaarFrontUrl,
          'aadhaarBack': aadhaarBackUrl,
          'panCard': panUrl,
          'selfie': selfieUrl,
          'signature': signatureUrl,
          'bankName': _bankNameController.text,
          'bankAccount': _bankAccountController.text,
          'bankIfsc': _bankIfscController.text,
        },
      );
      await CacheService().remove('user_onboarding_form_cache');
      await provider.refresh();
      if (mounted && widget.onNext != null) widget.onNext!();
    } catch (e) {
      if (mounted) {
        String userMessage = 'Something went wrong. Please try again.';
        final msg = e.toString();
        debugPrint('Profile update error: $msg');
        if (msg.contains('422') || msg.contains('VALIDATION')) {
          // Extract the actual validation error message
          final match = RegExp(r'"message":"([^"]+)"').firstMatch(msg);
          userMessage = match != null
              ? match.group(1)!
              : 'Please check your documents and try uploading again.';
        } else if (msg.contains('401') || msg.contains('unauthorized'))
          userMessage = 'Session expired. Please log in again.';
        else if (msg.contains('network') || msg.contains('timeout'))
          userMessage = 'No internet connection. Please check and retry.';
        _showError(userMessage);
      }
    } finally {
      if (mounted) setState(() => _isUploading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F5F7),
      body: SafeArea(
        child: Column(
          children: [
            _buildAppBar(),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 120),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _buildHeader(),
                    const SizedBox(height: 20),
                    _buildPersonalDetailsCard(),
                    const SizedBox(height: 20),
                    _buildIdentityVerificationCard(),
                    const SizedBox(height: 20),
                    _buildSelfieCard(),
                    const SizedBox(height: 20),
                    _buildSignatureCard(),
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

  Widget _buildAppBar() {
    return Container(
      height: 56,
      padding: const EdgeInsets.symmetric(horizontal: 8),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(bottom: BorderSide(color: Color(0xFFE5E7EB), width: 1)),
      ),
      child: Row(
        children: [
          IconButton(
            icon: const Icon(Icons.arrow_back, color: Color(0xFF111827)),
            onPressed: () => widget.onBack?.call(),
          ),
          const Expanded(
            child: Text(
              'Onboarding',
              textAlign: TextAlign.center,
              style: TextStyle(
                  color: Color(0xFF111827),
                  fontSize: 18,
                  fontWeight: FontWeight.w600),
            ),
          ),
          const Padding(
            padding: EdgeInsets.only(right: 8),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text('Step',
                    style: TextStyle(fontSize: 11, color: Color(0xFF6B7280))),
                Text('1/2',
                    style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFF111827))),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildHeader() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          height: 6,
          decoration: BoxDecoration(
              color: const Color(0xFFE5E7EB),
              borderRadius: BorderRadius.circular(3)),
          child: Stack(
            children: [
              Positioned(
                left: 0,
                top: 0,
                bottom: 0,
                width: MediaQuery.of(context).size.width * 0.45,
                child: Container(
                    decoration: BoxDecoration(
                        color: const Color(0xFF10B981),
                        borderRadius: BorderRadius.circular(3))),
              ),
              Positioned(
                right: 0,
                top: 0,
                bottom: 0,
                width: MediaQuery.of(context).size.width * 0.45,
                child: Container(
                    decoration: BoxDecoration(
                        color: const Color(0xFFEEF2FF),
                        borderRadius: BorderRadius.circular(3))),
              ),
            ],
          ),
        ),
        const SizedBox(height: 20),
        const Text('Almost there!',
            style: TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.w700,
                color: Color(0xFF111827))),
        const SizedBox(height: 6),
        const Text(
            'We need a few more details to set up your fleet profile securely.',
            style: TextStyle(fontSize: 14, color: Color(0xFF6B7280))),
      ],
    );
  }

  Widget _buildPersonalDetailsCard() {
    final phone = context.read<AppProvider>().rider?.phone ?? '';
    final formattedPhone = phone.length >= 10
        ? '+91 ${phone.substring(0, 5)} ${phone.substring(5)}'
        : phone;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE5E7EB)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                    color: const Color(0xFFEFF6FF),
                    borderRadius: BorderRadius.circular(8)),
                child: const Icon(Icons.person,
                    color: Color(0xFF2563EB), size: 18),
              ),
              const SizedBox(width: 10),
              const Text('Personal Details',
                  style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF111827))),
            ],
          ),
          const SizedBox(height: 16),
          _buildTextField('Full Name', 'Enter full name', _nameController,
              key: const Key('fullNameField')),
          const SizedBox(height: 12),
          _buildDateField('Date of Birth', 'DD-MM-YYYY', _dobController),
          const SizedBox(height: 12),
          _buildTextField(
              'Email Address', 'Enter email address', _emailController,
              key: const Key('emailField')),
          const SizedBox(height: 12),
          _buildPhoneField(formattedPhone),
          const SizedBox(height: 12),
          _buildTextField(
              "Father's Name", "Enter father's name", _fatherNameController,
              key: const Key('fatherNameField')),
          const SizedBox(height: 12),
          _buildTextField(
              "Mother's Name", "Enter mother's name", _motherNameController,
              key: const Key('motherNameField')),
          const SizedBox(height: 12),
          _buildTextArea(
              'Current Address', 'Enter your full address', _addressController),
        ],
      ),
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
            style: const TextStyle(fontSize: 14, color: Color(0xFF111827)),
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
              fillColor: Colors.transparent,
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildDateField(
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
        GestureDetector(
          onTap: () async {
            final date = await showDatePicker(
              context: context,
              initialDate: DateTime(2000),
              firstDate: DateTime(1950),
              lastDate: DateTime.now(),
            );
            if (date != null && mounted)
              setState(() => controller.text =
                  '${date.day.toString().padLeft(2, '0')}-${date.month.toString().padLeft(2, '0')}-${date.year}');
          },
          child: Container(
            height: 48,
            decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: const Color(0xFFD1D5DB))),
            padding: const EdgeInsets.symmetric(horizontal: 12),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    controller.text.isEmpty ? hint : controller.text,
                    style: TextStyle(
                        fontSize: 14,
                        color: controller.text.isEmpty
                            ? const Color(0xFF9CA3AF)
                            : const Color(0xFF111827)),
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

  Widget _buildPhoneField(String phone) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Phone Number',
            style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w500,
                color: Color(0xFF374151))),
        const SizedBox(height: 6),
        Container(
          height: 48,
          decoration: BoxDecoration(
            color: const Color(0xFFF9FAFB),
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: const Color(0xFFD1D5DB)),
          ),
          padding: const EdgeInsets.symmetric(horizontal: 12),
          child: Row(
            children: [
              Expanded(
                  child: Text(phone,
                      style: const TextStyle(
                          fontSize: 14, color: Color(0xFF6B7280)))),
              const Icon(Icons.check_circle,
                  color: Color(0xFF10B981), size: 20),
            ],
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
              border: Border.all(color: const Color(0xFFD1D5DB))),
          padding: const EdgeInsets.all(12),
          child: TextFormField(
            controller: controller,
            maxLines: 3,
            style: const TextStyle(fontSize: 14, color: Color(0xFF111827)),
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
              fillColor: Colors.transparent,
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildIdentityVerificationCard() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE5E7EB)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                    color: const Color(0xFFEEF2FF),
                    borderRadius: BorderRadius.circular(8)),
                child: const Icon(Icons.badge_outlined,
                    color: Color(0xFF4F46E5), size: 18),
              ),
              const SizedBox(width: 10),
              const Text('Identity Verification',
                  style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF111827))),
            ],
          ),
          const SizedBox(height: 4),
          const Text('Clear photos only. Max 5MB each.',
              style: TextStyle(fontSize: 12, color: Color(0xFF6B7280))),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                  child: _buildDocTile(
                      'Aadhaar Card\n(Front)',
                      Icons.upload_file,
                      _aadhaarFrontUploaded,
                      () => _pickDocument('aadhaar_front', false))),
              const SizedBox(width: 12),
              Expanded(
                  child: _buildDocTile(
                      'Aadhaar Card\n(Back)',
                      Icons.upload_file,
                      _aadhaarBackUploaded,
                      () => _pickDocument('aadhaar_back', false))),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                  child: _buildDocTile('PAN Card', Icons.upload_file,
                      _panUploaded, () => _pickDocument('pan', false))),
              const SizedBox(width: 12),
              Expanded(
                  child: _buildDocTile('Bank Details', Icons.account_balance,
                      _bankNameController.text.isNotEmpty, _showBankDialog)),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildDocTile(
      String label, IconData icon, bool isUploaded, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: isUploaded ? const Color(0xFFF0FDF4) : const Color(0xFFF9FAFB),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color:
                isUploaded ? const Color(0xFF10B981) : const Color(0xFFD1D5DB),
            width: isUploaded ? 1 : 2,
          ),
        ),
        child: Column(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: isUploaded ? const Color(0xFFDCFCE7) : Colors.white,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(icon,
                  color: isUploaded
                      ? const Color(0xFF10B981)
                      : const Color(0xFF6B7280),
                  size: 20),
            ),
            const SizedBox(height: 8),
            Text(
              isUploaded ? 'Uploaded' : label,
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w500,
                color: isUploaded
                    ? const Color(0xFF10B981)
                    : const Color(0xFF374151),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSelfieCard() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE5E7EB)),
      ),
      child: GestureDetector(
        onTap: () async {
          final source = await showDialog<ImageSource>(
            context: context,
            builder: (ctx) => SimpleDialog(
              title: const Text('Take Selfie'),
              children: [
                SimpleDialogOption(
                  onPressed: () => Navigator.pop(ctx, ImageSource.camera),
                  child: const ListTile(
                      leading: Icon(Icons.camera_alt), title: Text('Camera')),
                ),
                SimpleDialogOption(
                  onPressed: () => Navigator.pop(ctx, ImageSource.gallery),
                  child: const ListTile(
                      leading: Icon(Icons.photo_library),
                      title: Text('Gallery')),
                ),
              ],
            ),
          );
          if (source != null)
            _pickDocument('selfie', source == ImageSource.camera);
        },
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (_selfieUploaded && _selfiePath != null)
              ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: Image.file(File(_selfiePath!),
                    height: 160, fit: BoxFit.cover),
              )
            else
              Container(
                height: 120,
                decoration: BoxDecoration(
                  color: const Color(0xFFF9FAFB),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: const Color(0xFFD1D5DB), width: 2),
                ),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: const Color(0xFFEFF6FF),
                        borderRadius: BorderRadius.circular(24),
                      ),
                      child: const Icon(Icons.photo_camera,
                          color: Color(0xFF2563EB), size: 28),
                    ),
                    const SizedBox(height: 8),
                    const Text('Take Rider Photo',
                        style: TextStyle(
                            fontSize: 14, fontWeight: FontWeight.w500)),
                    const SizedBox(height: 2),
                    const Text('Tap to capture your photo',
                        style:
                            TextStyle(fontSize: 12, color: Color(0xFF9CA3AF))),
                  ],
                ),
              ),
            if (_selfieUploaded) ...[
              const SizedBox(height: 8),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                        color: const Color(0xFFDCFCE7),
                        borderRadius: BorderRadius.circular(12)),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: const [
                        Icon(Icons.check, color: Color(0xFF10B981), size: 14),
                        SizedBox(width: 4),
                        Text('Photo Captured',
                            style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w500,
                                color: Color(0xFF065F46))),
                      ],
                    ),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildSignatureCard() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFFE5E7EB))),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                  padding: const EdgeInsets.all(6),
                  decoration: BoxDecoration(
                      color: const Color(0xFFEFF6FF),
                      borderRadius: BorderRadius.circular(8)),
                  child: const Icon(Icons.draw,
                      color: Color(0xFF2563EB), size: 18)),
              const SizedBox(width: 10),
              const Text('Digital Signature',
                  style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF111827))),
            ],
          ),
          const SizedBox(height: 4),
          const Text('Sign below to authorize documentation.',
              style: TextStyle(fontSize: 12, color: Color(0xFF6B7280))),
          const SizedBox(height: 12),
          GestureDetector(
            onTap: _openSignaturePad,
            child: Container(
              height: 120,
              decoration: BoxDecoration(
                color: _signatureUploaded
                    ? const Color(0xFFF0FDF4)
                    : const Color(0xFFF9FAFB),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(
                    color: _signatureUploaded
                        ? const Color(0xFF10B981)
                        : const Color(0xFFD1D5DB)),
              ),
              child: Stack(
                children: [
                  Center(
                      child: Text(
                          _signatureUploaded
                              ? 'Signature Captured'
                              : 'Tap to draw signature',
                          style: TextStyle(
                              fontSize: 14,
                              color: _signatureUploaded
                                  ? const Color(0xFF10B981)
                                  : const Color(0xFF9CA3AF)))),
                  if (_signatureUploaded)
                    Positioned(
                        top: 8,
                        right: 8,
                        child: Container(
                            padding: const EdgeInsets.all(2),
                            decoration: const BoxDecoration(
                                color: Color(0xFF10B981),
                                shape: BoxShape.circle),
                            child: const Icon(Icons.check,
                                color: Colors.white, size: 12))),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBottomButton() {
    final bool canProceed =
        const String.fromEnvironment('TEST_MODE') == 'true' || _isFormComplete;

    return Container(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
      decoration: const BoxDecoration(
          color: Colors.white,
          border: Border(top: BorderSide(color: Color(0xFFE5E7EB)))),
      child: SizedBox(
        width: double.infinity,
        height: 52,
        child: ElevatedButton(
          key: const Key('nextOnboardingButton'),
          onPressed: canProceed && !_isUploading ? _handleNext : null,
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
                      color: Colors.white, strokeWidth: 2))
              : Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                        canProceed
                            ? 'NEXT: ADD GUARANTOR'
                            : 'COMPLETE ALL FIELDS',
                        style: const TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w600,
                            color: Colors.white)),
                    const SizedBox(width: 8),
                    const Icon(Icons.arrow_forward,
                        color: Colors.white, size: 18),
                  ],
                ),
        ),
      ),
    );
  }

  void _showBankDialog() {
    showDialog(
      context: context,
      builder: (context) => Dialog(
        backgroundColor: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text('Bank Details',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
              const SizedBox(height: 16),
              _buildDialogField(
                  'Bank Name', 'e.g. State Bank of India', _bankNameController),
              const SizedBox(height: 12),
              _buildDialogField(
                  'Account Number', 'e.g. 30291038472', _bankAccountController),
              const SizedBox(height: 12),
              _buildDialogField(
                  'IFSC Code', 'e.g. SBIN0001234', _bankIfscController),
              const SizedBox(height: 20),
              ElevatedButton(
                onPressed: () {
                  if (_bankNameController.text.isEmpty) {
                    _showError('Please enter bank name');
                    return;
                  }
                  if (_bankAccountController.text.length < 9 ||
                      _bankAccountController.text.length > 18) {
                    _showError('Account number should be 9-18 digits');
                    return;
                  }
      if (_bankIfscController.text.trim().isEmpty) {
        _showError('Enter a valid IFSC code');
        return;
      }
                  Navigator.pop(context);
                  setState(() {});
                },
                style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF2563EB),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8)),
                    minimumSize: const Size(double.infinity, 48)),
                child:
                    const Text('Save', style: TextStyle(color: Colors.white)),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildDialogField(
      String label, String hint, TextEditingController controller) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label,
            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500)),
        const SizedBox(height: 4),
        TextField(
          controller: controller,
          decoration: InputDecoration(
            hintText: hint,
            hintStyle: const TextStyle(color: Color(0xFF9CA3AF)),
            border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
                borderSide: const BorderSide(color: Color(0xFFD1D5DB))),
            enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
                borderSide: const BorderSide(color: Color(0xFFD1D5DB))),
            focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
                borderSide: const BorderSide(color: Color(0xFF2563EB))),
            contentPadding:
                const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
          ),
        ),
      ],
    );
  }
}

class SignaturePadScreen extends StatefulWidget {
  const SignaturePadScreen({super.key});

  @override
  State<SignaturePadScreen> createState() => _SignaturePadScreenState();
}

class _SignaturePadScreenState extends State<SignaturePadScreen> {
  final GlobalKey _boundaryKey = GlobalKey();
  final List<Offset?> _points = [];

  void _clear() => setState(() => _points.clear());

  void _addPoint(Offset point) {
    setState(() {
      _points.add(point);
    });
  }

  void _endStroke() {
    setState(() {
      _points.add(null);
    });
  }

  Future<void> _save() async {
    if (_points.isEmpty) {
      Navigator.of(context).pop();
      return;
    }

    try {
      final boundary = _boundaryKey.currentContext?.findRenderObject()
          as RenderRepaintBoundary?;
      if (boundary == null) return;

      final image = await boundary.toImage(pixelRatio: 3.0);
      final byteData = await image.toByteData(format: ui.ImageByteFormat.png);
      if (byteData == null) return;

      final bytes = byteData.buffer.asUint8List();
      final directory = await getTemporaryDirectory();
      final path =
          '${directory.path}/signature_${DateTime.now().millisecondsSinceEpoch}.png';
      final file = File(path);
      await file.writeAsBytes(bytes);

      if (mounted) Navigator.of(context).pop(path);
    } catch (e) {
      debugPrint('Error saving signature: $e');
      if (mounted) Navigator.of(context).pop();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
            icon: const Icon(Icons.close),
            onPressed: () => Navigator.pop(context)),
        title: const Text('Draw Signature',
            style: TextStyle(
                color: Color(0xFF111827), fontWeight: FontWeight.w600)),
        actions: [
          TextButton(
              onPressed: _clear,
              child: const Text('Clear',
                  style: TextStyle(color: Color(0xFF2563EB)))),
          TextButton(
              onPressed: _save,
              child: const Text('Save',
                  style: TextStyle(
                      color: Color(0xFF2563EB), fontWeight: FontWeight.w600))),
        ],
      ),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          children: [
            Expanded(
              child: RepaintBoundary(
                key: _boundaryKey,
                child: Container(
                  decoration: BoxDecoration(
                    color: Colors.white,
                    border: Border.all(color: const Color(0xFFE5E7EB)),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Stack(
                    children: [
                      SizedBox.expand(),
                      GestureDetector(
                        behavior: HitTestBehavior.opaque,
                        onPanStart: (details) =>
                            _addPoint(details.localPosition),
                        onPanUpdate: (details) =>
                            _addPoint(details.localPosition),
                        onPanEnd: (_) => _endStroke(),
                        child: CustomPaint(
                          painter: _SignaturePainter(_points),
                          size: Size.infinite,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SignaturePainter extends CustomPainter {
  final List<Offset?> points;
  _SignaturePainter(this.points);

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = const Color(0xFF111827)
      ..strokeCap = StrokeCap.round
      ..strokeWidth = 3;
    for (int i = 0; i < points.length - 1; i++) {
      if (points[i] != null && points[i + 1] != null)
        canvas.drawLine(points[i]!, points[i + 1]!, paint);
    }
  }

  @override
  bool shouldRepaint(covariant _SignaturePainter old) => true;
}
