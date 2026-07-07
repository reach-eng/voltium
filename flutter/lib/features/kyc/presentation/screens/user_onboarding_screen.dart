import 'dart:io';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:image_picker/image_picker.dart';
import 'package:universal_io/io.dart';
import 'package:voltium_rider/utils/app_constants.dart';
import 'package:voltium_rider/services/image_compression_service.dart';
import 'package:voltium_rider/providers/app_provider.dart';
import 'package:voltium_rider/theme/app_theme.dart';
import 'package:voltium_rider/features/kyc/presentation/widgets/user_onboarding_widgets.dart';
import 'package:voltium_rider/features/kyc/data/kyc_repository.dart';
import 'package:voltium_rider/features/kyc/presentation/screens/signature_pad_screen.dart';
import 'package:voltium_rider/models/rider_model.dart';

class UserOnboardingScreen extends StatefulWidget {
  final VoidCallback? onNext;
  final VoidCallback? onBack;

  const UserOnboardingScreen({super.key, this.onNext, this.onBack});

  @override
  State<UserOnboardingScreen> createState() => _UserOnboardingScreenState();
}

class _UserOnboardingScreenState extends State<UserOnboardingScreen> {
  final ImageCompressionService _compressionService = ImageCompressionService();
  KycRepository? _kycRepository;
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
  String _uploadProgressText = '';
  int _currentStep = 1;

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
    final riderId = context.read<AppProvider>().rider?.id;
    if (riderId == null) return;
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
    KycRepository.saveFormCache(riderId: riderId, data: cacheData);
  }

  void _loadCache() {
    final riderId = context.read<AppProvider>().rider?.id;
    if (riderId == null) return;
    KycRepository.loadFormCache(riderId: riderId).then((cacheData) {
      if (cacheData == null) return;
      setState(() {
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
        _aadhaarFrontUploaded =
            _aadhaarFrontPath != null && _aadhaarFrontPath!.isNotEmpty;

        _aadhaarBackPath = cacheData['aadhaarBackPath'];
        _aadhaarBackUploaded =
            _aadhaarBackPath != null && _aadhaarBackPath!.isNotEmpty;

        _panPath = cacheData['panPath'];
        _panUploaded = _panPath != null && _panPath!.isNotEmpty;

        _selfiePath = cacheData['selfiePath'];
        _selfieUploaded = _selfiePath != null && _selfiePath!.isNotEmpty;

        _signaturePath = cacheData['signaturePath'];
        _signatureUploaded =
            _signaturePath != null && _signaturePath!.isNotEmpty;
      });
    });
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
      if (AppConstants.isTestMode) {
        setState(() {
          if (_dobController.text.isEmpty) _dobController.text = '01-01-2000';
          if (_nameController.text.isEmpty) _nameController.text = 'Test Rider';
          if (_emailController.text.isEmpty)
            _emailController.text = 'test@example.com';
          if (_fatherNameController.text.isEmpty)
            _fatherNameController.text = 'Father Name';
          if (_motherNameController.text.isEmpty)
            _motherNameController.text = 'Mother Name';
          if (_addressController.text.isEmpty)
            _addressController.text = '123 Test Street';
          if (_bankNameController.text.isEmpty)
            _bankNameController.text = 'Test Bank';
          if (_bankAccountController.text.isEmpty)
            _bankAccountController.text = '1234567890';
          if (_bankIfscController.text.isEmpty)
            _bankIfscController.text = 'TEST0001234';
        });
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

  Future<void> _selectDob() async {
    // Default to 25 years ago — most riders are young adults. The
    // user can scroll back or forward. Also widen the firstDate to
    // 1940 so older users (born 1950–1970) don't have to scroll far.
    final now = DateTime.now();
    final defaultInitial =
        DateTime(now.year - 25, now.month, now.day).isAfter(now)
            ? DateTime(now.year - 25, 1, 1)
            : DateTime(now.year - 25, now.month, now.day);
    final date = await showDatePicker(
      context: context,
      initialDate: defaultInitial,
      firstDate: DateTime(1940),
      lastDate: now,
    );
    if (date != null && mounted) {
      setState(
        () => _dobController.text =
            '${date.day.toString().padLeft(2, '0')}-${date.month.toString().padLeft(2, '0')}-${date.year}',
      );
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
    return _nameController.text.trim().isNotEmpty &&
        _dobController.text.trim().isNotEmpty &&
        emailRegex.hasMatch(_emailController.text.trim()) &&
        _fatherNameController.text.trim().isNotEmpty &&
        _motherNameController.text.trim().isNotEmpty &&
        _addressController.text.trim().isNotEmpty &&
        _aadhaarFrontUploaded &&
        _aadhaarBackUploaded &&
        _panUploaded &&
        _selfieUploaded &&
        _signatureUploaded &&
        _bankNameController.text.trim().isNotEmpty &&
        _bankAccountController.text.trim().length >= 6 &&
        _bankIfscController.text.trim().length >= 8;
  }

  void _showBankDetailsDialog() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Bank Details'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextFormField(
              controller: _bankNameController,
              decoration: const InputDecoration(labelText: 'Bank Name'),
            ),
            const SizedBox(height: 8),
            TextFormField(
              controller: _bankAccountController,
              decoration: const InputDecoration(labelText: 'Account Number'),
              keyboardType: TextInputType.number,
            ),
            const SizedBox(height: 8),
            TextFormField(
              controller: _bankIfscController,
              decoration: const InputDecoration(labelText: 'IFSC Code'),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Close'),
          ),
        ],
      ),
    );
  }

  void _showError(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(msg), backgroundColor: AppColors.error),
    );
  }

  Future<void> _handleNext() async {
    final isTestMode = AppConstants.isTestMode;
    if (!isTestMode && !_isFormComplete) {
      final emailRegex = RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$');
      final missing = <String>[];
      if (_nameController.text.trim().isEmpty) missing.add('Name');
      if (_dobController.text.trim().isEmpty) missing.add('DOB');
      if (!emailRegex.hasMatch(_emailController.text.trim()))
        missing.add('Valid Email');
      if (_fatherNameController.text.trim().isEmpty)
        missing.add('Father\'s Name');
      if (_motherNameController.text.trim().isEmpty)
        missing.add('Mother\'s Name');
      if (_addressController.text.trim().isEmpty) missing.add('Address');
      if (!_aadhaarFrontUploaded) missing.add('Aadhaar Front');
      if (!_aadhaarBackUploaded) missing.add('Aadhaar Back');
      if (!_panUploaded) missing.add('PAN');
      if (!_selfieUploaded) missing.add('Selfie');
      if (!_signatureUploaded) missing.add('Signature');
      if (_bankNameController.text.trim().isEmpty ||
          _bankAccountController.text.trim().length < 6 ||
          _bankIfscController.text.trim().length < 8)
        missing.add('Bank Details');

      _showError('Missing: ${missing.join(', ')}');
      return;
    }

    final provider = context.read<AppProvider>();
    final rider = provider.rider;
    if (rider == null) {
      _showError('Session lost. Please log in again.');
      return;
    }
    final riderId = rider.id ?? rider.riderId;

    _kycRepository ??= KycRepository(
      provider.voltiumApiClient,
      provider.filesRepository,
    );

    setState(() => _isUploading = true);

    try {
      String aadhaarFrontUrl = '';
      String aadhaarBackUrl = '';
      String panUrl = '';
      String selfieUrl = '';
      String signatureUrl = '';

      if (isTestMode) {
        aadhaarFrontUrl = 'mock_url_front.png';
        aadhaarBackUrl = 'mock_url_back.png';
        panUrl = 'mock_url_pan.png';
        selfieUrl = 'mock_url_selfie.png';
        signatureUrl = 'mock_url_signature.png';
      } else {
        final Map<String, dynamic> tasks = {};
        if (_aadhaarFrontPath != null)
          tasks['Aadhaar Front'] = () => _kycRepository!
              .uploadDocument(File(_aadhaarFrontPath!), 'kyc_document');
        if (_aadhaarBackPath != null)
          tasks['Aadhaar Back'] = () => _kycRepository!
              .uploadDocument(File(_aadhaarBackPath!), 'kyc_document');
        if (_panPath != null)
          tasks['PAN'] = () =>
              _kycRepository!.uploadDocument(File(_panPath!), 'kyc_document');
        if (_selfiePath != null)
          tasks['Selfie'] = () => _kycRepository!
              .uploadDocument(File(_selfiePath!), 'profile_photo');
        if (_signaturePath != null)
          tasks['Signature'] = () => _kycRepository!
              .uploadDocument(File(_signaturePath!), 'kyc_document');

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
        selfieUrl = results['Selfie'] ?? '';
        signatureUrl = results['Signature'] ?? '';
      }

      if (mounted) {
        setState(() => _uploadProgressText = 'Saving profile...');
      }

      await _kycRepository!.updateProfile(
        riderId: riderId,
        name: _nameController.text,
        email: _emailController.text,
        address: _addressController.text,
        dob: _dobController.text,
        fatherName: _fatherNameController.text,
        motherName: _motherNameController.text,
        bankName: _bankNameController.text,
        accountNumber: _bankAccountController.text,
        ifscCode: _bankIfscController.text,
        aadhaarFrontUrl: aadhaarFrontUrl,
        aadhaarBackUrl: aadhaarBackUrl,
        panUrl: panUrl,
        selfieUrl: selfieUrl,
        signatureUrl: signatureUrl,
      );
      await KycRepository.clearFormCache(riderId: riderId);
      await provider.refresh();

      if (mounted) {
        widget.onNext?.call();
      }
    } catch (e) {
      if (mounted) {
        String userMessage = 'Something went wrong. Please try again.';
        final msg = e.toString();
        debugPrint('Profile update error: $msg');

        // Extract real validation error if available (e.g. from DioException)
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
          final match = RegExp(r'"message":"([^"]+)"').firstMatch(msg);
          userMessage = match != null
              ? match.group(1)!
              : 'Please check your documents and try uploading again.';
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

  Widget _buildStepIndicator() {
    return Padding(
      padding: const EdgeInsets.only(bottom: 20),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          _buildDot(1),
          _buildLine(),
          _buildDot(2),
          _buildLine(),
          _buildDot(3),
        ],
      ),
    );
  }

  Widget _buildDot(int step) {
    final isActive = _currentStep >= step;
    return Container(
      width: 24,
      height: 24,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: isActive ? AppColors.primary : AppColors.surfaceContainer,
        border: isActive ? null : Border.all(color: AppColors.divider),
      ),
      alignment: Alignment.center,
      child: Text(
        '$step',
        style: TextStyle(
          color: isActive ? Colors.white : AppColors.onSurfaceVariant,
          fontSize: 12,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }

  Widget _buildLine() {
    return Container(
      width: 40,
      height: 2,
      color: AppColors.divider,
    );
  }

  void _onBottomButtonPressed() {
    if (_currentStep < 3) {
      setState(() {
        _currentStep++;
      });
    } else {
      _handleNext();
    }
  }

  bool get _canProceedCurrentStep {
    if (AppConstants.isTestMode) return true;
    switch (_currentStep) {
      case 1:
        return _nameController.text.isNotEmpty &&
            _dobController.text.isNotEmpty &&
            _addressController.text.isNotEmpty;
      case 2:
        return _aadhaarFrontUploaded &&
            _aadhaarBackUploaded &&
            _panUploaded &&
            _bankAccountController.text.isNotEmpty;
      case 3:
        return _selfieUploaded && _signatureUploaded;
      default:
        return false;
    }
  }

  bool _isFieldEditable(String fieldName) {
    final rider = context.read<AppProvider>().rider;
    if (rider?.kycStatus != KycStatus.rejected ||
        rider?.kycEditableFields == null ||
        rider!.kycEditableFields!.isEmpty) {
      return true;
    }
    return rider.kycEditableFields!.contains(fieldName);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F5F7),
      body: SafeArea(
        child: SizedBox.expand(
          child: Column(
            children: [
              UserOnboardingAppBar(
                onBack: () {
                  if (_currentStep > 1) {
                    setState(() {
                      _currentStep--;
                    });
                  } else {
                    widget.onBack?.call();
                  }
                },
              ),
              Expanded(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 120),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const UserOnboardingHeader(),
                      const SizedBox(height: 20),
                      _buildStepIndicator(),
                      if (_currentStep == 1)
                        PersonalDetailsCard(
                          nameController: _nameController,
                          nameEnabled: _isFieldEditable('fullName'),
                          dobController: _dobController,
                          dobEnabled: _isFieldEditable('dob'),
                          emailController: _emailController,
                          emailEnabled: _isFieldEditable('email'),
                          fatherNameController: _fatherNameController,
                          fatherNameEnabled: _isFieldEditable('fatherName'),
                          motherNameController: _motherNameController,
                          motherNameEnabled: _isFieldEditable('motherName'),
                          addressController: _addressController,
                          addressEnabled: _isFieldEditable('currentAddress'),
                          phone: context.read<AppProvider>().rider?.phone ?? '',
                          onSelectDob: _selectDob,
                        ),
                      if (_currentStep == 2)
                        IdentityVerificationCard(
                          aadhaarFrontUploaded: _aadhaarFrontUploaded,
                          aadhaarFrontEnabled: _isFieldEditable('aadhaarFront'),
                          aadhaarBackUploaded: _aadhaarBackUploaded,
                          aadhaarBackEnabled: _isFieldEditable('aadhaarBack'),
                          panUploaded: _panUploaded,
                          panEnabled: _isFieldEditable('panCard'),
                          bankDetailsDone:
                              _bankAccountController.text.isNotEmpty,
                          bankEnabled: _isFieldEditable('accountNumber') ||
                              _isFieldEditable('bankName') ||
                              _isFieldEditable('ifscCode'),
                          onPickAadhaarFront: () =>
                              _showDocumentSourceDialog('aadhaar_front'),
                          onPickAadhaarBack: () =>
                              _showDocumentSourceDialog('aadhaar_back'),
                          onPickPan: () => _showDocumentSourceDialog('pan'),
                          onShowBankDialog: () => _showBankDetailsDialog(),
                        ),
                      if (_currentStep == 3) ...[
                        SelfieCard(
                          selfieUploaded: _selfieUploaded,
                          selfiePath: _selfiePath,
                          enabled: _isFieldEditable('profilePhoto'),
                          onTap: () => _showDocumentSourceDialog('selfie'),
                        ),
                        const SizedBox(height: 20),
                        SignatureCard(
                          signatureUploaded: _signatureUploaded,
                          enabled: _isFieldEditable('signature'),
                          onTap: _openSignaturePad,
                        ),
                      ],
                    ],
                  ),
                ),
              ),
              UserOnboardingBottomButton(
                canProceed: _canProceedCurrentStep,
                isUploading: _isUploading,
                uploadProgressText: _uploadProgressText,
                onNext: _onBottomButtonPressed,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
