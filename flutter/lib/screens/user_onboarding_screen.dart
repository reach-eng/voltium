import 'package:flutter/material.dart';
import 'dart:ui';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';
import '../services/api_service.dart';
import '../services/image_compression_service.dart';
import '../providers/app_provider.dart';
import '../theme/app_theme.dart';
import '../widgets/fade_up_widget.dart';
import 'dart:io' show File;

class UserOnboardingScreen extends StatefulWidget {
  final VoidCallback? onNext;
  final int currentStep;
  final int totalSteps;

  const UserOnboardingScreen({
    super.key,
    this.onNext,
    this.currentStep = 1,
    this.totalSteps = 2,
  });

  @override
  State<UserOnboardingScreen> createState() => _UserOnboardingScreenState();
}

class _UserOnboardingScreenState extends State<UserOnboardingScreen> {
  final ImageCompressionService _compressionService = ImageCompressionService();
  final _nameController = TextEditingController();
  final _emailController = TextEditingController();
  final _fatherController = TextEditingController();
  final _motherController = TextEditingController();
  final _bankNameController = TextEditingController();
  final _bankAccountController = TextEditingController();
  final _bankIfscController = TextEditingController();

  bool _isUploading = false;
  bool _aadhaarFrontUploaded = false;
  bool _aadhaarBackUploaded = false;
  bool _panUploaded = false;
  bool _signatureUploaded = false;
  bool _photoUploaded = false;

  String? _aadhaarFrontPath;
  String? _aadhaarBackPath;
  String? _panPath;
  String? _signaturePath;
  String? _photoPath;

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    _fatherController.dispose();
    _motherController.dispose();
    _bankNameController.dispose();
    _bankAccountController.dispose();
    _bankIfscController.dispose();
    super.dispose();
  }

  Future<void> _pickDocument(String type, bool useCamera) async {
    final source = useCamera ? ImageSource.camera : ImageSource.gallery;
    final compressedFile = await _compressionService.pickAndCompress(
      source: source,
      maxWidth: 1024,
      maxHeight: 1024,
      quality: 80,
    );

    if (compressedFile != null) {
      setState(() {
        if (type == 'aadhaar_front') {
          _aadhaarFrontUploaded = true;
          _aadhaarFrontPath = compressedFile.path;
        }
        if (type == 'aadhaar_back') {
          _aadhaarBackUploaded = true;
          _aadhaarBackPath = compressedFile.path;
        }
        if (type == 'pan') {
          _panUploaded = true;
          _panPath = compressedFile.path;
        }
        if (type == 'photo') {
          _photoUploaded = true;
          _photoPath = compressedFile.path;
        }
      });
    }
  }

  Future<void> _openSignaturePad() async {
    final result = await Navigator.of(context).push<String>(
      MaterialPageRoute(builder: (_) => const SignaturePadScreen()),
    );
    if (result != null) {
      setState(() {
        _signatureUploaded = true;
        _signaturePath = result;
      });
    }
  }

  void _reuploadDocument(String type) {
    setState(() {
      if (type == 'aadhaar_front') {
        _aadhaarFrontUploaded = false;
        _aadhaarFrontPath = null;
      }
      if (type == 'aadhaar_back') {
        _aadhaarBackUploaded = false;
        _aadhaarBackPath = null;
      }
      if (type == 'pan') {
        _panUploaded = false;
        _panPath = null;
      }
      if (type == 'signature') {
        _signatureUploaded = false;
        _signaturePath = null;
      }
      if (type == 'photo') {
        _photoUploaded = false;
        _photoPath = null;
      }
    });
    if (type == 'signature') {
      _openSignaturePad();
    } else {
      _pickDocument(type, type == 'photo');
    }
  }

  Future<void> _handleNext() async {
    if (!_aadhaarFrontUploaded ||
        !_aadhaarBackUploaded ||
        !_panUploaded ||
        !_signatureUploaded ||
        !_photoUploaded ||
        _bankNameController.text.isEmpty ||
        _bankAccountController.text.isEmpty ||
        _bankIfscController.text.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content:
              Text('Please complete all details including bank info and docs.'),
          backgroundColor: AppColors.error,
        ),
      );
      return;
    }

    final provider = context.read<AppProvider>();
    final riderId = provider.rider?.id;
    if (riderId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Rider ID not found. Please restart the onboarding.'),
          backgroundColor: AppColors.error,
        ),
      );
      return;
    }

    setState(() => _isUploading = true);

    try {
      String? aadhaarFrontUrl;
      String? aadhaarBackUrl;
      String? panUrl;
      String? signatureUrl;
      String? photoUrl;

      if (_aadhaarFrontPath != null) {
        aadhaarFrontUrl = await ApiService()
            .uploadFile(File(_aadhaarFrontPath!), 'KYC_AADHAAR_FRONT');
      }
      if (_aadhaarBackPath != null) {
        aadhaarBackUrl = await ApiService()
            .uploadFile(File(_aadhaarBackPath!), 'KYC_AADHAAR_BACK');
      }
      if (_panPath != null) {
        panUrl = await ApiService().uploadFile(File(_panPath!), 'KYC_PAN');
      }
      if (_signaturePath != null) {
        signatureUrl = await ApiService()
            .uploadFile(File(_signaturePath!), 'KYC_SIGNATURE');
      }
      if (_photoPath != null) {
        photoUrl =
            await ApiService().uploadFile(File(_photoPath!), 'KYC_PHOTO');
      }

      await ApiService().updateProfile(
        riderId: riderId,
        data: {
          'name': _nameController.text,
          'email': _emailController.text,
          'fatherName': _fatherController.text,
          'motherName': _motherController.text,
          'kycDone': true,
          'registrationDone': true,
          'aadhaarFront': aadhaarFrontUrl,
          'aadhaarBack': aadhaarBackUrl,
          'panCard': panUrl,
          'signature': signatureUrl,
          'riderPhoto': photoUrl,
          'bankName': _bankNameController.text,
          'bankAccount': _bankAccountController.text,
          'bankIfsc': _bankIfscController.text,
        },
      );

      await provider.refresh();

      if (mounted && widget.onNext != null) {
        widget.onNext!();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error saving profile: $e')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF0F7FF),
      body: Stack(
        children: [
          _buildMeshBackground(),
          SafeArea(
            child: Column(
              children: [
                _buildAppBar(),
                Expanded(
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.fromLTRB(24, 0, 24, 160),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        FadeUpWidget(
                          delay: 0,
                          child: _buildStepProgress(),
                        ),
                        const SizedBox(height: 40),
                        FadeUpWidget(
                          delay: 100,
                          child: _buildSectionHeader(
                              'Personal Details', Icons.verified),
                        ),
                        const SizedBox(height: 20),
                        FadeUpWidget(
                          delay: 150,
                          child: _buildInputField(
                              'Full Name', 'Johnathan Doe', Icons.badge,
                              controller: _nameController,
                              fieldKey: const Key('fullNameField')),
                        ),
                        const SizedBox(height: 16),
                        FadeUpWidget(
                          delay: 200,
                          child: _buildInputField('Date of Birth', 'DD / MM / YYYY',
                              Icons.calendar_today,
                              isDate: true,
                              fieldKey: const Key('dobPicker')),
                        ),
                        const SizedBox(height: 16),
                        FadeUpWidget(
                          delay: 250,
                          child: _buildInputField('Email Address',
                              'john.doe@voltfleet.pro', Icons.alternate_email,
                              controller: _emailController,
                              fieldKey: const Key('emailField')),
                        ),
                        const SizedBox(height: 16),
                        FadeUpWidget(
                          delay: 300,
                          child: Row(
                            children: [
                              Expanded(
                                child: _buildInputField("Father's Name",
                                    "Legal Father's Name", Icons.family_restroom,
                                    controller: _fatherController,
                                    fieldKey: const Key('fatherNameField')),
                              ),
                              const SizedBox(width: 16),
                              Expanded(
                                child: _buildInputField("Mother's Name",
                                    "Legal Mother's Name", Icons.family_restroom,
                                    controller: _motherController,
                                    fieldKey: const Key('motherNameField')),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 48),
                        FadeUpWidget(
                          delay: 400,
                          child: _buildSectionHeader(
                              'Identity Verification', Icons.verified_user),
                        ),
                        const SizedBox(height: 20),
                        FadeUpWidget(
                          delay: 450,
                          child: _buildDocumentGrid(),
                        ),
                        const SizedBox(height: 48),
                        FadeUpWidget(
                          delay: 550,
                          child:
                              _buildSectionHeader('Digital Signature', Icons.draw),
                        ),
                        const SizedBox(height: 20),
                        FadeUpWidget(
                          delay: 600,
                          child: _buildSignatureCard(),
                        ),
                        const SizedBox(height: 24),
                        FadeUpWidget(
                          delay: 700,
                          child: _buildSecurityBanner(),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: _buildBottomNav(),
          ),
        ],
      ),
    );
  }

  Widget _buildMeshBackground() {
    return Positioned.fill(
      child: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              Color(0xFFF0F7FF),
              Color(0xFFF0F7FF),
            ],
          ),
        ),
        child: CustomPaint(
          painter: _MeshGradientPainter(),
        ),
      ),
    );
  }

  Widget _buildAppBar() {
    return ClipRect(
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
        child: Container(
          height: 64,
          padding: const EdgeInsets.symmetric(horizontal: 8),
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.7),
            border: Border(
              bottom: BorderSide(
                color: Colors.white.withValues(alpha: 0.4),
                width: 1,
              ),
            ),
          ),
          child: Row(
            children: [
              IconButton(
                icon: const Icon(Icons.arrow_back, color: Color(0xFF0062FF)),
                onPressed: () => Navigator.of(context).pop(),
              ),
              const Expanded(
                child: Text(
                  'Onboarding',
                  style: TextStyle(
                    color: Color(0xFF1E293B),
                    fontSize: 20,
                    fontWeight: FontWeight.w900,
                    letterSpacing: -0.5,
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.only(right: 16),
                child: Text(
                  'STEP ${widget.currentStep.toString().padLeft(2, '0')}',
                  style: const TextStyle(
                    color: Color(0xFF0062FF),
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 1.5,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildStepProgress() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Container(
              width: 56,
              height: 56,
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF0053C1), Color(0xFF00A3FF)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(16),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFF0053C1).withValues(alpha: 0.3),
                    blurRadius: 20,
                    offset: const Offset(0, 8),
                  ),
                ],
              ),
              child: Center(
                child: Transform.rotate(
                  angle: -0.05,
                  child: Text(
                    widget.currentStep.toString().padLeft(2, '0'),
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 24,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ),
              ),
            ),
            const SizedBox(width: 16),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Current Step',
                  style: TextStyle(
                    color: Color(0xFF0062FF),
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 1.5,
                  ),
                ),
                const SizedBox(height: 2),
                const Text(
                  'User Details',
                  style: TextStyle(
                    color: Color(0xFF1E293B),
                    fontSize: 24,
                    fontWeight: FontWeight.w900,
                    letterSpacing: -0.5,
                  ),
                ),
              ],
            ),
          ],
        ),
        const SizedBox(height: 16),
        Container(
          height: 8,
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.6),
            borderRadius: BorderRadius.circular(999),
            border: Border.all(
              color: Colors.white.withValues(alpha: 0.5),
              width: 1,
            ),
          ),
          child: FractionallySizedBox(
            alignment: Alignment.centerLeft,
            widthFactor: widget.currentStep / widget.totalSteps,
            child: Container(
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF0053C1), Color(0xFF00A3FF)],
                ),
                borderRadius: BorderRadius.circular(999),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFF0053C1).withValues(alpha: 0.3),
                    blurRadius: 8,
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildSectionHeader(String title, IconData icon) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          title,
          style: const TextStyle(
            color: Color(0xFF1E293B),
            fontSize: 18,
            fontWeight: FontWeight.w900,
            letterSpacing: -0.02,
          ),
        ),
        Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.7),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: Colors.white.withValues(alpha: 0.8),
              width: 1,
            ),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFF1E293B).withValues(alpha: 0.04),
                blurRadius: 8,
              ),
            ],
          ),
          child: Icon(icon, color: const Color(0xFF0062FF), size: 20),
        ),
      ],
    );
  }

  Widget _buildInputField(String label, String hint, IconData icon,
      {bool isLast = false,
      bool isDate = false,
      TextEditingController? controller,
      Key? fieldKey}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(left: 4, bottom: 8),
          child: Text(
            label.toUpperCase(),
            style: const TextStyle(
              color: Color(0xFF667085),
              fontSize: 10,
              fontWeight: FontWeight.w700,
              letterSpacing: 1.5,
            ),
          ),
        ),
        ClipRect(
          child: BackdropFilter(
            filter: ImageFilter.blur(sigmaX: 8, sigmaY: 8),
            child: Container(
              height: 56,
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.7),
                borderRadius: BorderRadius.circular(24),
                border: Border.all(
                  color: Colors.white.withValues(alpha: 0.9),
                  width: 1,
                ),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFF1E293B).withValues(alpha: 0.04),
                    blurRadius: 8,
                  ),
                ],
              ),
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Row(
                children: [
                  Icon(icon,
                      color: const Color(0xFF0062FF).withValues(alpha: 0.6),
                      size: 20),
                  const SizedBox(width: 12),
                  Expanded(
                    child: isDate
                        ? GestureDetector(
                            key: fieldKey,
                            onTap: () async {
                              final date = await showDatePicker(
                                context: context,
                                initialDate: DateTime(2000),
                                firstDate: DateTime(1950),
                                lastDate: DateTime.now(),
                              );
                              if (date != null && controller != null) {
                                controller.text =
                                    '${date.day.toString().padLeft(2, '0')}/${date.month.toString().padLeft(2, '0')}/${date.year}';
                              }
                            },
                            child: Text(
                              controller?.text ?? hint,
                              style: TextStyle(
                                color: controller?.text.isNotEmpty == true
                                    ? const Color(0xFF1E293B)
                                    : const Color(0xFF98A2B3),
                                fontSize: 16,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          )
                        : TextFormField(
                            key: fieldKey,
                            controller: controller,
                            style: const TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w600,
                              color: Color(0xFF1E293B),
                            ),
                            decoration: InputDecoration(
                              border: InputBorder.none,
                              isDense: true,
                              contentPadding: EdgeInsets.zero,
                              hintText: hint,
                              hintStyle: TextStyle(
                                color: const Color(0xFF98A2B3),
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ),
                  ),
                  if (isDate)
                    Icon(Icons.keyboard_arrow_down,
                        color: const Color(0xFF0062FF).withValues(alpha: 0.6),
                        size: 20),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildDocumentGrid() {
    return Column(
      children: [
        Row(
          children: [
            Expanded(
              child: _buildDocCard(
                'Aadhaar Card',
                'Front',
                Icons.contact_page,
                _aadhaarFrontUploaded,
                const Color(0xFFF97316),
                () => _pickDocument('aadhaar_front', false),
                cardKey: const Key('aadhaarFrontUpload'),
              ),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: _buildDocCard(
                'Aadhaar Card',
                'Back',
                Icons.credit_card,
                _aadhaarBackUploaded,
                const Color(0xFFF97316),
                () => _pickDocument('aadhaar_back', false),
                cardKey: const Key('aadhaarBackUpload'),
              ),
            ),
          ],
        ),
        const SizedBox(height: 16),
        Row(
          children: [
            Expanded(
              child: _buildDocCard(
                'PAN Card',
                'Verification',
                Icons.credit_card,
                _panUploaded,
                const Color(0xFF0062FF),
                () => _pickDocument('pan', false),
                cardKey: const Key('panUpload'),
              ),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: _buildDocCard(
                'Bank Details',
                'Account',
                Icons.account_balance,
                _bankNameController.text.isNotEmpty && _bankAccountController.text.isNotEmpty,
                const Color(0xFF0062FF),
                _showBankDetailsDialog,
                cardKey: const Key('bankDetailsButton'),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildDocCard(
    String title,
    String subtitle,
    IconData icon,
    bool isUploaded,
    Color accentColor,
    VoidCallback onTap, {
    Key? cardKey,
  }) {
    return GestureDetector(
      key: cardKey,
      onTap: onTap,
      child: ClipRect(
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 16, sigmaY: 16),
          child: Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.6),
              borderRadius: BorderRadius.circular(24),
              border: Border.all(
                color: Colors.white.withValues(alpha: 0.7),
                width: 1,
              ),
              boxShadow: [
                BoxShadow(
                  color: accentColor.withValues(alpha: 0.05),
                  blurRadius: 20,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: Column(
              children: [
                Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(
                    color: accentColor.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(
                    isUploaded ? Icons.check : icon,
                    color: isUploaded ? AppColors.success : accentColor,
                    size: 24,
                  ),
                ),
                const SizedBox(height: 12),
                Text(
                  title,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    color: Color(0xFF1E293B),
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.5,
                  ),
                ),
                const SizedBox(height: 4),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(
                      Icons.upload,
                      size: 12,
                      color: isUploaded
                          ? AppColors.success
                          : const Color(0xFF667085),
                    ),
                    const SizedBox(width: 4),
                    Text(
                      isUploaded ? 'Uploaded' : 'Upload',
                      style: TextStyle(
                        color: isUploaded
                            ? AppColors.success
                            : const Color(0xFF667085),
                        fontSize: 9,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 1.5,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Container(
                  width: 8,
                  height: 8,
                  decoration: BoxDecoration(
                    color: isUploaded
                        ? accentColor.withValues(alpha: 0.5)
                        : const Color(0xFFD0D5DD),
                    shape: BoxShape.circle,
                    boxShadow: isUploaded
                        ? [
                            BoxShadow(
                              color: accentColor.withValues(alpha: 0.5),
                              blurRadius: 8,
                            ),
                          ]
                        : null,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildSignatureCard() {
    return GestureDetector(
      key: const Key('signatureButton'),
      onTap: _signatureUploaded
          ? () => _reuploadDocument('signature')
          : _openSignaturePad,
      child: ClipRect(
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 16, sigmaY: 16),
          child: Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.6),
              borderRadius: BorderRadius.circular(24),
              border: Border.all(
                color: Colors.white.withValues(alpha: 0.7),
                width: 1,
              ),
              boxShadow: [
                BoxShadow(
                  color: const Color(0xFF0053C1).withValues(alpha: 0.05),
                  blurRadius: 20,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: Column(
              children: [
                Container(
                  width: 64,
                  height: 64,
                  decoration: BoxDecoration(
                    color: _signatureUploaded
                        ? AppColors.success.withValues(alpha: 0.1)
                        : const Color(0xFF0062FF).withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Icon(
                    _signatureUploaded ? Icons.check : Icons.draw,
                    color: _signatureUploaded
                        ? AppColors.success
                        : const Color(0xFF0062FF),
                    size: 32,
                  ),
                ),
                const SizedBox(height: 16),
                Text(
                  _signatureUploaded
                      ? 'Signature Captured'
                      : 'Draw Your Signature',
                  style: const TextStyle(
                    color: Color(0xFF1E293B),
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  _signatureUploaded ? 'Tap to redraw' : 'Use the canvas below',
                  style: const TextStyle(
                    color: Color(0xFF667085),
                    fontSize: 11,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildSecurityBanner() {
    return ClipRect(
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 8, sigmaY: 8),
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: const Color(0xFF0053C1).withValues(alpha: 0.05),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: const Color(0xFF0053C1).withValues(alpha: 0.1),
              width: 1,
            ),
          ),
          child: Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: const Color(0xFF0053C1).withValues(alpha: 0.1),
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.shield_outlined,
                  color: Color(0xFF0053C1),
                  size: 20,
                ),
              ),
              const SizedBox(width: 12),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Your data is secure',
                      style: TextStyle(
                        color: Color(0xFF1E293B),
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    SizedBox(height: 2),
                    Text(
                      'All documents are encrypted and stored securely.',
                      style: TextStyle(
                        color: Color(0xFF667085),
                        fontSize: 12,
                        fontWeight: FontWeight.w400,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildBottomNav() {
    final bool isPersonalInfoComplete = _nameController.text.isNotEmpty && _emailController.text.isNotEmpty && _fatherController.text.isNotEmpty;
    final bool isDocsComplete = _aadhaarFrontUploaded && _aadhaarBackUploaded && _panUploaded && _photoUploaded && _signatureUploaded;
    final bool isBankComplete = _bankNameController.text.isNotEmpty && _bankAccountController.text.isNotEmpty && _bankIfscController.text.isNotEmpty;
    final bool isFormValid = isPersonalInfoComplete && isDocsComplete && isBankComplete;

    return ClipRect(
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
        child: Container(
          padding: const EdgeInsets.fromLTRB(24, 16, 24, 24),
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.7),
            borderRadius: const BorderRadius.vertical(top: Radius.circular(40)),
            border: Border(
              top: BorderSide(
                color: Colors.white.withValues(alpha: 0.4),
                width: 1,
              ),
            ),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFF1E293B).withValues(alpha: 0.06),
                blurRadius: 48,
                offset: const Offset(0, -24),
              ),
            ],
          ),
          child: SafeArea(
            top: false,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: double.infinity,
                  height: 56,
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: isFormValid 
                        ? [const Color(0xFF0053C1), const Color(0xFF0062FF), const Color(0xFF00C2FF)]
                        : [const Color(0xFF94A3B8), const Color(0xFFCBD5E1), const Color(0xFFE2E8F0)],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.circular(24),
                    boxShadow: isFormValid ? [
                      BoxShadow(
                        color: const Color(0xFF0053C1).withValues(alpha: 0.3),
                        blurRadius: 20,
                        offset: const Offset(0, 8),
                      ),
                    ] : [],
                  ),
                  child: ElevatedButton(
                    key: const Key('nextOnboardingButton'),
                    onPressed: isFormValid ? _handleNext : null,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.transparent,
                      shadowColor: Colors.transparent,
                      disabledBackgroundColor: Colors.transparent,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(24),
                      ),
                      padding: EdgeInsets.zero,
                    ),
                    child: _isUploading 
                      ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                      : Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text(
                            isFormValid ? 'NEXT: ADD GUARANTOR' : 'PLEASE COMPLETE FORM',
                            style: const TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w900,
                              letterSpacing: 1.5,
                              color: Colors.white,
                            ),
                          ),
                          const SizedBox(width: 8),
                          if (isFormValid) const Icon(Icons.chevron_right, color: Colors.white, size: 20),
                        ],
                      ),
                  ),
                ),
                const SizedBox(height: 16),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      isFormValid ? 'Step 1 of 2 Complete' : 'Form Incomplete',
                      style: const TextStyle(
                        color: Color(0xFF667085),
                        fontSize: 9,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 1.5,
                      ),
                    ),
                    Row(
                      children: [
                        Container(
                          width: 16,
                          height: 4,
                          decoration: BoxDecoration(
                            gradient: const LinearGradient(
                              colors: [Color(0xFF0053C1), Color(0xFF00A3FF)],
                            ),
                            borderRadius: BorderRadius.circular(2),
                          ),
                        ),
                        const SizedBox(width: 4),
                        Container(
                          width: 16,
                          height: 4,
                          decoration: BoxDecoration(
                            color: const Color(0xFFE8ECEF),
                            borderRadius: BorderRadius.circular(2),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  void _showBankDetailsDialog() {
    showDialog(
      context: context,
      builder: (context) => BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
        child: Dialog(
          backgroundColor: Colors.white.withOpacity(0.9),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(32)),
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(color: const Color(0xFF0062FF).withOpacity(0.1), borderRadius: BorderRadius.circular(16)),
                      child: const Icon(Icons.account_balance, color: Color(0xFF0062FF), size: 24),
                    ),
                    const SizedBox(width: 16),
                    const Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Bank Details', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: Color(0xFF1E293B))),
                          Text('For refunds and deposits', style: TextStyle(fontSize: 12, color: Color(0xFF64748B))),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 24),
                _buildInputField('Bank Name', 'e.g. State Bank of India', Icons.account_balance, controller: _bankNameController),
                const SizedBox(height: 16),
                _buildInputField('Account Number', 'e.g. 30291038472', Icons.pin, controller: _bankAccountController),
                const SizedBox(height: 16),
                _buildInputField('IFSC Code', 'e.g. SBIN0001234', Icons.qr_code_2, controller: _bankIfscController),
                const SizedBox(height: 32),
                ElevatedButton(
                  key: const Key('saveBankButton'),
                  onPressed: () {
                    if (_bankNameController.text.isNotEmpty && _bankAccountController.text.isNotEmpty && _bankIfscController.text.isNotEmpty) {
                      Navigator.pop(context);
                      setState(() {}); // Refresh bottom nav button state
                    }
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF0062FF),
                    foregroundColor: Colors.white,
                    minimumSize: const Size(double.infinity, 56),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
                    elevation: 8,
                    shadowColor: const Color(0xFF0062FF).withOpacity(0.3),
                  ),
                  child: const Text('SAVE BANK DETAILS', style: TextStyle(fontWeight: FontWeight.w900, letterSpacing: 1)),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class SignaturePadScreen extends StatefulWidget {
  const SignaturePadScreen({super.key});

  @override
  State<SignaturePadScreen> createState() => _SignaturePadScreenState();
}

class _SignaturePadScreenState extends State<SignaturePadScreen> {
  final GlobalKey _canvasKey = GlobalKey();
  final List<Offset?> _points = [];

  void _clear() {
    setState(() {
      _points.clear();
    });
  }

  void _save() {
    Navigator.of(context).pop(_points.map((p) => p.toString()).join());
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.close, color: Color(0xFF1E293B)),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: const Text(
          'Draw Signature',
          style:
              TextStyle(color: Color(0xFF1E293B), fontWeight: FontWeight.w900),
        ),
        centerTitle: true,
        actions: [
          TextButton(
              key: const Key('clearSignatureButton'),
              onPressed: _clear,
              child: const Text('Clear',
                  style: TextStyle(color: Color(0xFF0053C1)))),
          TextButton(
              key: const Key('saveSignatureButton'),
              onPressed: _save,
              child: const Text('Save',
                  style: TextStyle(
                      color: Color(0xFF0053C1), fontWeight: FontWeight.w700))),
        ],
      ),
      body: Column(
        children: [
          Expanded(
            child: Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Container(
                  decoration: BoxDecoration(
                    border: Border.all(
                        color: const Color(0xFFE2E8F0).withValues(alpha: 0.5),
                        width: 2),
                    borderRadius: BorderRadius.circular(24),
                  ),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(22),
                    child: Stack(
                      children: [
                        CustomPaint(
                            size: Size.infinite, painter: _GridPainter()),
                        GestureDetector(
                          onPanUpdate: (details) {
                            setState(() {
                              final RenderBox box = _canvasKey.currentContext!
                                  .findRenderObject() as RenderBox;
                              _points.add(
                                  box.globalToLocal(details.globalPosition));
                            });
                          },
                          onPanEnd: (_) => _points.add(null),
                          child: CustomPaint(
                              key: _canvasKey,
                              size: Size.infinite,
                              painter: _SignaturePainter(_points)),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.only(bottom: 24),
            child: Text('Draw your signature in the box above',
                style: TextStyle(color: const Color(0xFF667085), fontSize: 13)),
          ),
        ],
      ),
    );
  }
}

class _MeshGradientPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint1 = Paint()
      ..shader = const RadialGradient(
        colors: [Color(0xFFD6E4FF), Color(0xFFF0F7FF)],
        stops: [0.0, 1.0],
      ).createShader(Rect.fromLTWH(0, 0, size.width, size.height));
    canvas.drawRect(Rect.fromLTWH(0, 0, size.width, size.height), paint1);

    final paint2 = Paint()
      ..shader = const RadialGradient(
        colors: [Color(0xFFE8F5E9), Color(0xFFF0F7FF)],
        stops: [0.0, 1.0],
      ).createShader(Rect.fromLTWH(size.width * 0.7, size.height * 0.7,
          size.width * 0.5, size.height * 0.5));
    canvas.drawRect(Rect.fromLTWH(0, 0, size.width, size.height), paint2);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

class _GridPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = const Color(0xFF0053C1).withValues(alpha: 0.1)
      ..strokeWidth = 1;
    for (double x = 0; x < size.width; x += 20) {
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), paint);
    }
    for (double y = 0; y < size.height; y += 20) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), paint);
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

class _SignaturePainter extends CustomPainter {
  final List<Offset?> points;
  _SignaturePainter(this.points);

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = const Color(0xFF1E293B)
      ..strokeCap = StrokeCap.round
      ..strokeWidth = 3.0;
    for (int i = 0; i < points.length - 1; i++) {
      if (points[i] != null && points[i + 1] != null) {
        canvas.drawLine(points[i]!, points[i + 1]!, paint);
      }
    }
  }

  @override
  bool shouldRepaint(covariant _SignaturePainter oldDelegate) => true;
}
