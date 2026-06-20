import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:image_picker/image_picker.dart';
import 'dart:io';
import 'package:voltium_rider/utils/app_constants.dart';
import 'package:voltium_rider/services/image_compression_service.dart';
import 'package:voltium_rider/providers/app_provider.dart';
import 'package:voltium_rider/theme/app_theme.dart';
import 'package:voltium_rider/features/kyc/presentation/widgets/user_onboarding_widgets.dart';
import 'package:voltium_rider/features/kyc/data/kyc_repository.dart';
import 'package:voltium_rider/features/kyc/presentation/screens/signature_pad_screen.dart';

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
    KycRepository.saveFormCache(cacheData);
  }

  void _loadCache() {
    KycRepository.loadFormCache().then((cacheData) {
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

  Future<void> _selectDob() async {
    final date = await showDatePicker(
      context: context,
      initialDate: DateTime(2000),
      firstDate: DateTime(1950),
      lastDate: DateTime.now(),
    );
    if (date != null && mounted) {
      setState(() => _dobController.text =
          '${date.day.toString().padLeft(2, '0')}-${date.month.toString().padLeft(2, '0')}-${date.year}',);
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
              decoration:
                  const InputDecoration(labelText: 'Account Number'),
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
      _showError('Please complete all fields and documents before continuing.');
      return;
    }

    final provider = context.read<AppProvider>();
    final riderId = provider.rider?.id;
    if (riderId == null) {
      _showError('Rider ID not found. Please restart onboarding.');
      return;
    }

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
        if (_aadhaarFrontPath != null) tasks['Aadhaar Front'] = () => _kycRepository!.uploadDocument(File(_aadhaarFrontPath!), 'KYC_AADHAAR_FRONT');
        if (_aadhaarBackPath != null) tasks['Aadhaar Back'] = () => _kycRepository!.uploadDocument(File(_aadhaarBackPath!), 'KYC_AADHAAR_BACK');
        if (_panPath != null) tasks['PAN'] = () => _kycRepository!.uploadDocument(File(_panPath!), 'KYC_PAN');
        if (_selfiePath != null) tasks['Selfie'] = () => _kycRepository!.uploadDocument(File(_selfiePath!), 'KYC_SELFIE');
        if (_signaturePath != null) tasks['Signature'] = () => _kycRepository!.uploadDocument(File(_signaturePath!), 'KYC_SIGNATURE');

        int completed = 0;
        final results = <String, String>{};
        
        for (final entry in tasks.entries) {
          if (mounted) {
            setState(() {
              _uploadProgressText = 'Uploading ${completed + 1} of ${tasks.length}...';
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
      await KycRepository.clearFormCache();
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
            UserOnboardingAppBar(
              onBack: () => widget.onBack?.call(),
            ),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 120),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const UserOnboardingHeader(),
                    const SizedBox(height: 20),
                    PersonalDetailsCard(
                      nameController: _nameController,
                      dobController: _dobController,
                      emailController: _emailController,
                      fatherNameController: _fatherNameController,
                      motherNameController: _motherNameController,
                      addressController: _addressController,
                      phone: context.read<AppProvider>().rider?.phone ?? '',
                      onSelectDob: _selectDob,
                    ),
                    const SizedBox(height: 20),
                    IdentityVerificationCard(
                      aadhaarFrontUploaded: _aadhaarFrontUploaded,
                      aadhaarBackUploaded: _aadhaarBackUploaded,
                      panUploaded: _panUploaded,
                      bankDetailsDone:
                          _bankAccountController.text.isNotEmpty,
                      onPickAadhaarFront: () =>
                          _pickDocument('aadhaar_front', false),
                      onPickAadhaarBack: () =>
                          _pickDocument('aadhaar_back', false),
                      onPickPan: () => _pickDocument('pan', false),
                      onShowBankDialog: () => _showBankDetailsDialog(),
                    ),
                    const SizedBox(height: 20),
                    SelfieCard(
                      selfieUploaded: _selfieUploaded,
                      selfiePath: _selfiePath,
                      onTap: () async {
                        final source = await showDialog<ImageSource>(
                          context: context,
                          builder: (ctx) => SimpleDialog(
                            title: const Text('Take Selfie'),
                            children: [
                              SimpleDialogOption(
                                onPressed: () =>
                                    Navigator.pop(ctx, ImageSource.camera),
                                child: const ListTile(
                                    leading: Icon(Icons.camera_alt),
                                    title: Text('Camera'),),
                              ),
                              SimpleDialogOption(
                                onPressed: () =>
                                    Navigator.pop(ctx, ImageSource.gallery),
                                child: const ListTile(
                                    leading: Icon(Icons.photo_library),
                                    title: Text('Gallery'),),
                              ),
                            ],
                          ),
                        );
                        if (source != null) {
                          _pickDocument('selfie', source == ImageSource.camera);
                        }
                      },
                    ),
                    const SizedBox(height: 20),
                    SignatureCard(
                      signatureUploaded: _signatureUploaded,
                      onTap: _openSignaturePad,
                    ),
                  ],
                ),
              ),
            ),
            UserOnboardingBottomButton(
              canProceed: AppConstants.isTestMode ||
                  _isFormComplete,
              isUploading: _isUploading,
              uploadProgressText: _uploadProgressText,
              onNext: _handleNext,
            ),
          ],
        ),
      ),
    );
  }
}
