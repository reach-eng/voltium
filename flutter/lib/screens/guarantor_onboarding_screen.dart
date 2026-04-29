import 'package:flutter/material.dart';
import 'dart:ui';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';
import '../services/api_service.dart';
import '../services/image_compression_service.dart';
import '../providers/app_provider.dart';
import '../theme/app_theme.dart';
import 'dart:io';
import 'user_onboarding_screen.dart' show SignaturePadScreen;

class GuarantorOnboardingScreen extends StatefulWidget {
  final VoidCallback? onNext;
  final int currentStep;
  final int totalSteps;

  const GuarantorOnboardingScreen({
    super.key,
    this.onNext,
    this.currentStep = 2,
    this.totalSteps = 2,
  });

  @override
  State<GuarantorOnboardingScreen> createState() =>
      _GuarantorOnboardingScreenState();
}

class _GuarantorOnboardingScreenState extends State<GuarantorOnboardingScreen> {
  final _nameController = TextEditingController();
  final _phoneController = TextEditingController();
  final _otpController = TextEditingController();
  final ImagePicker _picker = ImagePicker();
  final ImageCompressionService _compressionService = ImageCompressionService();

  String? _selectedRelation;
  DateTime? _selectedDob;

  String? _aadhaarFront;
  String? _aadhaarBack;
  String? _panCard;
  String? _videoPath;
  String? _signaturePath;

  bool _isUploading = false;
  bool _isSendingOtp = false;
  bool _isPhoneVerified = false;
  bool _showOtpField = false;
  bool _signatureConfirmed = false;

  @override
  void dispose() {
    _nameController.dispose();
    _phoneController.dispose();
    _otpController.dispose();
    super.dispose();
  }

  Future<void> _pickImage(String field) async {
    final compressedFile = await _compressionService.pickAndCompress(
      source: ImageSource.gallery,
      maxWidth: 1024,
      maxHeight: 1024,
      quality: 80,
    );

    if (compressedFile != null) {
      setState(() {
        if (field == 'aadhaarFront') _aadhaarFront = compressedFile.path;
        if (field == 'aadhaarBack') _aadhaarBack = compressedFile.path;
        if (field == 'panCard') _panCard = compressedFile.path;
      });
    }
  }

  Future<void> _pickVideo() async {
    final XFile? video = await _picker.pickVideo(source: ImageSource.camera);
    if (video != null) {
      setState(() => _videoPath = video.path);
    }
  }

  Future<void> _openSignaturePad() async {
    final result = await Navigator.of(context).push<String>(
      MaterialPageRoute(builder: (_) => const SignaturePadScreen()),
    );
    if (result != null) {
      setState(() {
        _signaturePath = result;
      });
    }
  }

  Future<void> _sendOtp() async {
    if (_phoneController.text.length < 10) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enter a valid phone number')),
      );
      return;
    }
    setState(() => _isSendingOtp = true);
    await Future.delayed(const Duration(seconds: 1));
    setState(() {
      _isSendingOtp = false;
      _showOtpField = true;
    });
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('OTP sent to guarantor')),
      );
    }
  }

  void _verifyOtp() {
    if (_otpController.text.length == 6) {
      setState(() {
        _isPhoneVerified = true;
        _showOtpField = false;
      });
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enter all 6 OTP digits')),
      );
    }
  }

  Future<void> _pickDate() async {
    if (!mounted) return;
    final picked = await showDatePicker(
      context: context,
      initialDate: _selectedDob ??
          DateTime.now().subtract(const Duration(days: 365 * 45)),
      firstDate: DateTime(1940),
      lastDate: DateTime.now().subtract(const Duration(days: 365 * 18)),
      builder: (context, child) {
        return Theme(
          data: ThemeData.light().copyWith(
              colorScheme: const ColorScheme.light(primary: AppColors.primary)),
          child: child!,
        );
      },
    );
    if (picked != null && mounted) {
      setState(() => _selectedDob = picked);
    }
  }

  Future<void> _handleSubmit() async {
    if (_nameController.text.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enter guarantor name')),
      );
      return;
    }
    if (_selectedRelation == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please select relationship')),
      );
      return;
    }
    if (_aadhaarFront == null ||
        _aadhaarBack == null ||
        _panCard == null ||
        _signaturePath == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please upload all required documents')),
      );
      return;
    }
    if (!_signatureConfirmed) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
            content: Text('Please confirm the declaration to proceed')),
      );
      return;
    }

    final provider = context.read<AppProvider>();
    final riderId = provider.rider?.id;
    if (riderId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Rider ID not found')),
      );
      return;
    }

    setState(() => _isUploading = true);

    try {
      final aadhaarFrontUrl = await ApiService()
          .uploadFile(File(_aadhaarFront!), 'GUARANTOR_AADHAAR_FRONT');
      final aadhaarBackUrl = await ApiService()
          .uploadFile(File(_aadhaarBack!), 'GUARANTOR_AADHAAR_BACK');
      final panUrl =
          await ApiService().uploadFile(File(_panCard!), 'GUARANTOR_PAN');
      final videoUrl = _videoPath != null
          ? await ApiService().uploadFile(File(_videoPath!), 'GUARANTOR_VIDEO')
          : null;
      final signatureUrl = await ApiService()
          .uploadFile(File(_signaturePath!), 'GUARANTOR_SIGNATURE');

      await ApiService().updateProfile(
        riderId: riderId,
        data: {
          'guarantorName': _nameController.text,
          'guarantorRelation': _selectedRelation,
          'guarantorPhone': _phoneController.text,
          'guarantorDob': _selectedDob?.toIso8601String(),
          'guarantorAadhaarFront': aadhaarFrontUrl,
          'guarantorAadhaarBack': aadhaarBackUrl,
          'guarantorPan': panUrl,
          'guarantorVideo': videoUrl,
          'guarantorSignature': signatureUrl,
          'guarantorStatus': 'VERIFIED',
        },
      );

      await provider.refresh();

      if (mounted && widget.onNext != null) {
        widget.onNext!();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _isUploading = false);
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
                        _buildStepProgress(),
                        const SizedBox(height: 40),
                        _buildSectionHeader('Guarantor Details', Icons.people),
                        const SizedBox(height: 20),
                        _buildInputField(
                            'Full Name', 'Johnathan Doe', Icons.badge,
                            controller: _nameController,
                            fieldKey: const Key('guarantorNameField')),
                        const SizedBox(height: 16),
                        _buildRelationField(),
                        const SizedBox(height: 16),
                        _buildDateField(),
                        const SizedBox(height: 48),
                        _buildSectionHeader('Phone Verification', Icons.phone),
                        const SizedBox(height: 20),
                        _buildPhoneVerificationCard(),
                        const SizedBox(height: 48),
                        _buildSectionHeader(
                            'Identity Verification', Icons.verified_user),
                        const SizedBox(height: 20),
                        _buildDocumentGrid(),
                        const SizedBox(height: 48),
                        _buildSectionHeader('Digital Signature', Icons.draw),
                        const SizedBox(height: 20),
                        _buildSignatureCard(),
                        const SizedBox(height: 24),
                        _buildSecurityBanner(),
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
                  'STEP ${widget.currentStep.toString().padLeft(2, '0')} OF ${widget.totalSteps.toString().padLeft(2, '0')}',
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
                  'Guarantor Verification',
                  style: TextStyle(
                    color: Color(0xFF0062FF),
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 1.5,
                  ),
                ),
                const SizedBox(height: 2),
                const Text(
                  "Guarantor's Details",
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
      {bool isLast = false, TextEditingController? controller, Key? fieldKey}) {
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
                    child: TextFormField(
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
                        hintStyle: const TextStyle(
                          color: Color(0xFF98A2B3),
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildRelationField() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Padding(
          padding: EdgeInsets.only(left: 4, bottom: 8),
          child: Text(
            'RELATIONSHIP WITH APPLICANT',
            style: TextStyle(
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
              ),
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: DropdownButtonHideUnderline(
                child: DropdownButton<String>(
                  key: const Key('relationshipDropdown'),
                  value: _selectedRelation,
                  hint: const Text('Select Relationship',
                      style: TextStyle(
                          color: Color(0xFF98A2B3),
                          fontWeight: FontWeight.w500)),
                  isExpanded: true,
                  icon: Icon(Icons.expand_more,
                      color: const Color(0xFF0062FF).withValues(alpha: 0.6)),
                  items: const [
                    DropdownMenuItem(value: 'father', child: Text('Father')),
                    DropdownMenuItem(value: 'mother', child: Text('Mother')),
                    DropdownMenuItem(value: 'spouse', child: Text('Spouse')),
                    DropdownMenuItem(value: 'other', child: Text('Other')),
                  ],
                  onChanged: (v) => setState(() => _selectedRelation = v),
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildDateField() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Padding(
          padding: EdgeInsets.only(left: 4, bottom: 8),
          child: Text(
            'DATE OF BIRTH',
            style: TextStyle(
              color: Color(0xFF667085),
              fontSize: 10,
              fontWeight: FontWeight.w700,
              letterSpacing: 1.5,
            ),
          ),
        ),
        GestureDetector(
          key: const Key('guarantorDobPicker'),
          onTap: _pickDate,
          child: ClipRect(
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
                ),
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Row(
                  children: [
                    Icon(Icons.calendar_today,
                        color: const Color(0xFF0062FF).withValues(alpha: 0.6),
                        size: 20),
                    const SizedBox(width: 12),
                    Text(
                      _selectedDob != null
                          ? '${_selectedDob!.day.toString().padLeft(2, '0')}/${_selectedDob!.month.toString().padLeft(2, '0')}/${_selectedDob!.year}'
                          : 'DD / MM / YYYY',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                        color: _selectedDob != null
                            ? const Color(0xFF1E293B)
                            : const Color(0xFF98A2B3),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildPhoneVerificationCard() {
    return ClipRect(
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 16, sigmaY: 16),
        child: Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.6),
            borderRadius: BorderRadius.circular(24),
            border: Border.all(
              color: Colors.white.withValues(alpha: 0.7),
              width: 1,
            ),
          ),
          child: Column(
            children: [
              Row(
                children: [
                  Expanded(
                    child: ClipRect(
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
                          ),
                          padding: const EdgeInsets.symmetric(horizontal: 16),
                          child: Row(
                            children: [
                              const Text('+91',
                                  style: TextStyle(
                                      color: Color(0xFF1E293B),
                                      fontWeight: FontWeight.w600,
                                      fontSize: 16)),
                              const SizedBox(width: 8),
                              Expanded(
                                child: TextFormField(
                                  key: const Key('guarantorPhoneField'),
                                  controller: _phoneController,
                                  keyboardType: TextInputType.phone,
                                  style: const TextStyle(
                                      fontSize: 16,
                                      fontWeight: FontWeight.w600,
                                      color: Color(0xFF1E293B)),
                                  decoration: InputDecoration(
                                    border: InputBorder.none,
                                    hintText: '98765 43210',
                                    hintStyle: const TextStyle(
                                        color: Color(0xFF98A2B3)),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Container(
                    key: const Key('sendGuarantorOtpButton'),
                    height: 56,
                    padding: const EdgeInsets.symmetric(horizontal: 20),
                    decoration: BoxDecoration(
                      gradient: _isPhoneVerified
                          ? null
                          : const LinearGradient(
                              colors: [Color(0xFF0053C1), Color(0xFF00A3FF)],
                            ),
                      color: _isPhoneVerified ? AppColors.success : null,
                      borderRadius: BorderRadius.circular(24),
                    ),
                    child: Center(
                      child: Text(
                        _isPhoneVerified
                            ? 'VERIFIED'
                            : (_isSendingOtp ? '...' : 'SEND OTP'),
                        style: TextStyle(
                          color: _isPhoneVerified ? Colors.white : Colors.white,
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 1,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
              if (_showOtpField) ...[
                const SizedBox(height: 16),
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
                      ),
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      child: Row(
                        children: [
                          Expanded(
                            child: TextFormField(
                              key: const Key('guarantorOtpField'),
                              controller: _otpController,
                              keyboardType: TextInputType.number,
                              maxLength: 6,
                              style: const TextStyle(
                                  fontSize: 18,
                                  fontWeight: FontWeight.w700,
                                  letterSpacing: 8,
                                  color: Color(0xFF1E293B)),
                              decoration: const InputDecoration(
                                border: InputBorder.none,
                                counterText: '',
                                hintText: 'Enter OTP',
                                hintStyle: TextStyle(
                                    color: Color(0xFF98A2B3), letterSpacing: 0),
                              ),
                            ),
                          ),
                          TextButton(
                            key: const Key('verifyGuarantorOtpButton'),
                            onPressed: _verifyOtp,
                            child: const Text('VERIFY',
                                style: TextStyle(
                                    color: Color(0xFF0053C1),
                                    fontWeight: FontWeight.w700)),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
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
                _aadhaarFront != null,
                const Color(0xFFF97316),
                () => _pickImage('aadhaarFront'),
                cardKey: const Key('guarantorAadhaarFront'),
              ),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: _buildDocCard(
                'Aadhaar Card',
                'Back',
                Icons.credit_card,
                _aadhaarBack != null,
                const Color(0xFFF97316),
                () => _pickImage('aadhaarBack'),
                cardKey: const Key('guarantorAadhaarBack'),
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
                _panCard != null,
                const Color(0xFF0062FF),
                () => _pickImage('panCard'),
                cardKey: const Key('guarantorPan'),
              ),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: _buildDocCard(
                'Video of',
                'Acceptance',
                Icons.videocam,
                _videoPath != null,
                const Color(0xFFDC2626),
                _pickVideo,
                cardKey: const Key('guarantorVideo'),
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
      key: const Key('guarantorSignature'),
      onTap: _signaturePath != null ? null : _openSignaturePad,
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
                  height: 140,
                  decoration: BoxDecoration(
                    color: const Color(0xFFF5F7FA),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Stack(
                    children: [
                      CustomPaint(
                        size: const Size(double.infinity, 140),
                        painter: _DotGridPainter(),
                      ),
                      if (_signaturePath != null)
                        const Center(
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(Icons.check_circle,
                                  color: AppColors.success, size: 48),
                              SizedBox(height: 8),
                              Text('Signature Captured',
                                  style: TextStyle(
                                      color: AppColors.success,
                                      fontWeight: FontWeight.w700,
                                      fontSize: 12)),
                            ],
                          ),
                        )
                      else
                        const Center(
                          child: Text('DRAW SIGNATURE HERE',
                              style: TextStyle(
                                  color: Color(0xFF98A2B3),
                                  fontWeight: FontWeight.w900,
                                  fontSize: 14,
                                  letterSpacing: 2)),
                        ),
                      if (_signaturePath != null)
                        Positioned(
                          bottom: 8,
                          right: 8,
                          child: GestureDetector(
                            onTap: () => setState(() {
                              _signaturePath = null;
                              _signatureConfirmed = false;
                            }),
                            child: Container(
                              width: 40,
                              height: 40,
                              decoration: BoxDecoration(
                                color: AppColors.error.withValues(alpha: 0.1),
                                shape: BoxShape.circle,
                              ),
                              child: const Icon(Icons.delete_sweep,
                                  color: AppColors.error, size: 20),
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Checkbox(
                      key: const Key('declarationCheckbox'),
                      value: _signatureConfirmed,
                      onChanged: (v) =>
                          setState(() => _signatureConfirmed = v ?? false),
                      activeColor: const Color(0xFF0053C1),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(4)),
                    ),
                    const Expanded(
                      child: Text.rich(
                        TextSpan(
                          text:
                              'I hereby declare that I am signing this application voluntarily and agree to the ',
                          style: TextStyle(
                              color: Color(0xFF667085),
                              fontSize: 13,
                              fontWeight: FontWeight.w500,
                              height: 1.5),
                          children: [
                            TextSpan(
                                text: 'terms of guarantee',
                                style: TextStyle(
                                    color: Color(0xFF0053C1),
                                    fontWeight: FontWeight.w700,
                                    decoration: TextDecoration.underline)),
                          ],
                        ),
                      ),
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
          child: const Row(
            children: [
              Icon(Icons.shield_outlined, color: Color(0xFF0053C1), size: 20),
              SizedBox(width: 12),
              Expanded(
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
                    gradient: const LinearGradient(
                      colors: [
                        Color(0xFF0053C1),
                        Color(0xFF0062FF),
                        Color(0xFF00C2FF),
                      ],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.circular(24),
                    boxShadow: [
                      BoxShadow(
                        color: const Color(0xFF0053C1).withValues(alpha: 0.3),
                        blurRadius: 20,
                        offset: const Offset(0, 8),
                      ),
                    ],
                  ),
                  child: ElevatedButton(
                    key: const Key('completeOnboardingButton'),
                    onPressed: _isUploading ? null : _handleSubmit,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.transparent,
                      shadowColor: Colors.transparent,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(24),
                      ),
                      padding: EdgeInsets.zero,
                    ),
                    child: _isUploading
                        ? const SizedBox(
                            width: 24,
                            height: 24,
                            child: CircularProgressIndicator(
                              color: Colors.white,
                              strokeWidth: 2,
                            ),
                          )
                        : const Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Text(
                                'COMPLETE ONBOARDING',
                                style: TextStyle(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w900,
                                  letterSpacing: 1.5,
                                  color: Colors.white,
                                ),
                              ),
                              SizedBox(width: 8),
                              Icon(Icons.chevron_right,
                                  color: Colors.white, size: 20),
                            ],
                          ),
                  ),
                ),
                const SizedBox(height: 16),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      'Step 2 of 2: Final verification',
                      style: TextStyle(
                        color: Color(0xFF667085),
                        fontSize: 9,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 1.5,
                      ),
                    ),
                    Row(
                      children: [
                        Container(
                          width: 24,
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
                          width: 24,
                          height: 4,
                          decoration: BoxDecoration(
                            gradient: const LinearGradient(
                              colors: [Color(0xFF0053C1), Color(0xFF00A3FF)],
                            ),
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

class _DotGridPainter extends CustomPainter {
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
