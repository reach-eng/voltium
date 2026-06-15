import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:image_picker/image_picker.dart';
import 'dart:io';
import 'dart:ui' as ui;
import 'package:flutter/rendering.dart';
import 'package:path_provider/path_provider.dart';
import 'package:voltium_rider/services/image_compression_service.dart';
import 'package:voltium_rider/providers/app_provider.dart';
import 'package:voltium_rider/theme/app_theme.dart';
import 'package:voltium_rider/features/kyc/presentation/widgets/user_onboarding_widgets.dart';
import 'package:voltium_rider/features/kyc/data/kyc_repository.dart';

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
      }
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

  Future<void> _selectDob() async {
    final date = await showDatePicker(
      context: context,
      initialDate: DateTime(2000),
      firstDate: DateTime(1950),
      lastDate: DateTime.now(),
    );
    if (date != null && mounted) {
      setState(() => _dobController.text =
          '${date.day.toString().padLeft(2, '0')}-${date.month.toString().padLeft(2, '0')}-${date.year}');
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

      if (const String.fromEnvironment('TEST_MODE') == 'true') {
        aadhaarFrontUrl = 'mock_url_front.png';
        aadhaarBackUrl = 'mock_url_back.png';
        panUrl = 'mock_url_pan.png';
        selfieUrl = 'mock_url_selfie.png';
        signatureUrl = 'mock_url_signature.png';
      } else {
        // Upload each file independently so the index can never get misaligned
        // when some paths are null (e.g. restored from cache).
        final futures = await Future.wait([
          _aadhaarFrontPath != null
              ? _kycRepository!.uploadDocument(File(_aadhaarFrontPath!), 'KYC_AADHAAR_FRONT')
              : Future.value(''),
          _aadhaarBackPath != null
              ? _kycRepository!.uploadDocument(File(_aadhaarBackPath!), 'KYC_AADHAAR_BACK')
              : Future.value(''),
          _panPath != null
              ? _kycRepository!.uploadDocument(File(_panPath!), 'KYC_PAN')
              : Future.value(''),
          _selfiePath != null
              ? _kycRepository!.uploadDocument(File(_selfiePath!), 'KYC_SELFIE')
              : Future.value(''),
          _signaturePath != null
              ? _kycRepository!.uploadDocument(File(_signaturePath!), 'KYC_SIGNATURE')
              : Future.value(''),
        ]);

        aadhaarFrontUrl = futures[0];
        aadhaarBackUrl  = futures[1];
        panUrl          = futures[2];
        selfieUrl       = futures[3];
        signatureUrl    = futures[4];
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
            _buildAppBar(),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 120),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _buildHeader(),
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
                      bankDetailsDone: _bankBankAccountController.text.isNotEmpty,
                      onPickAadhaarFront: () => _pickDocument('aadhaar_front', false),
                      onPickAadhaarBack: () => _pickDocument('aadhaar_back', false),
                      onPickPan: () => _pickDocument('pan', false),
                      onShowBankDialog: _showBankDialog,
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
