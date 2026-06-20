import 'dart:io';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:image_picker/image_picker.dart';
import 'package:voltium_rider/utils/app_constants.dart';
import '../../../../theme/app_theme.dart';

class TopUpProofScreen extends StatefulWidget {
  final int amount;
  final VoidCallback? onBack;
  final VoidCallback? onEditAmount;
  final Function(File)? onImageSelected;
  final Function(File)? onSubmit;

  const TopUpProofScreen({
    super.key,
    required this.amount,
    this.onBack,
    this.onEditAmount,
    this.onImageSelected,
    this.onSubmit,
  });

  @override
  State<TopUpProofScreen> createState() => _TopUpProofScreenState();
}

class _TopUpProofScreenState extends State<TopUpProofScreen> {
  final ImagePicker _picker = ImagePicker();
  File? _imageFile;
  bool _isUploading = false;

  Future<void> _pickImage(ImageSource source) async {
    if (AppConstants.isTestMode) {
      final image = File('/data/local/tmp/mock_top_up_proof.png');
      setState(() => _imageFile = image);
      widget.onImageSelected?.call(image);
      return;
    }

    final picked = await _picker.pickImage(
      source: source,
      imageQuality: 85,
      maxWidth: 1600,
    );
    if (picked == null || !mounted) return;

    final image = File(picked.path);
    setState(() => _imageFile = image);
    widget.onImageSelected?.call(image);
  }

  Future<void> _showImageSourceSheet() async {
    await showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (context) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                ListTile(
                  leading: const Icon(Icons.photo_camera_outlined),
                  title: const Text('Take Photo'),
                  onTap: () {
                    Navigator.pop(context);
                    _pickImage(ImageSource.camera);
                  },
                ),
                ListTile(
                  leading: const Icon(Icons.photo_library_outlined),
                  title: const Text('Choose from Gallery'),
                  onTap: () {
                    Navigator.pop(context);
                    _pickImage(ImageSource.gallery);
                  },
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Future<void> _submit() async {
    if (_imageFile == null) return;
    setState(() => _isUploading = true);
    await widget.onSubmit?.call(_imageFile!);
    if (mounted) setState(() => _isUploading = false);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      body: Column(
        children: [
          _buildHeader(),
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(20, 24, 20, 32),
              child: Column(
                children: [
                  _buildAmountCard(),
                  const SizedBox(height: 16),
                  _buildInstructionCard(),
                  const SizedBox(height: 16),
                  _buildUploadCard(),
                  const SizedBox(height: 24),
                  _buildNoteCard(),
                ],
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(20),
            child: _buildSubmitButton(),
          ),
        ],
      ),
    );
  }

  Widget _buildHeader() {
    return Container(
      width: double.infinity,
      padding: EdgeInsets.fromLTRB(
        20,
        MediaQuery.of(context).padding.top + 16,
        20,
        48,
      ),
      decoration: const BoxDecoration(
        color: AppColors.primary,
        borderRadius: BorderRadius.vertical(bottom: Radius.circular(36)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              // Back button
              GestureDetector(
                key: const Key('backButton'),
                onTap: widget.onBack ?? () => Navigator.maybePop(context),
                child: Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.15),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.chevron_left_rounded,
                    color: Colors.white,
                    size: 28,
                  ),
                ),
              ),
              const SizedBox(width: 32),
            ],
          ),
          const SizedBox(height: 24),
          Text('Step 3 of 3',
            style: GoogleFonts.inter(
              color: Colors.white.withValues(alpha: 0.7),
              fontSize: 14,
              fontWeight: FontWeight.w500,
            ),
          ),
          const SizedBox(height: 4),
          Text('Upload Proof',
            style: GoogleFonts.inter(
              color: Colors.white,
              fontSize: 28,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAmountCard() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.iconBackground),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'TOP-UP AMOUNT',
                style: GoogleFonts.inter(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: AppColors.slate500,
                  letterSpacing: 0.5,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                '₹${widget.amount.toString().replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (Match m) => '${m[1]},')}',
                style: GoogleFonts.inter(
                  fontSize: 28,
                  fontWeight: FontWeight.w800,
                  color: AppColors.primaryGradientEnd,
                ),
              ),
            ],
          ),
          TextButton(
            onPressed: widget.onEditAmount,
            style: TextButton.styleFrom(
              foregroundColor: AppColors.primaryGradientEnd,
            ),
            child: Text('Edit',
              style: GoogleFonts.inter(
                fontSize: 14,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildInstructionCard() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.iconBackground),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: const BoxDecoration(
              color: Color(0xFFEFF6FF),
              shape: BoxShape.circle,
            ),
            child: const Icon(
              Icons.description_outlined,
              color: AppColors.primaryGradientEnd,
              size: 20,
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Proof of Top Up',
                  style: GoogleFonts.inter(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: const Color(0xFF1E293B),
                  ),
                ),
                const SizedBox(height: 6),
                Text('Please attach a photo of the rider giving the cash to a Voltium team member or the receipt of the online payment.',
                  style: GoogleFonts.inter(
                    fontSize: 14,
                    height: 1.4,
                    color: AppColors.slate500,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildUploadCard() {
    return InkWell(
      key: const Key('uploadProofCard'),
      borderRadius: BorderRadius.circular(16),
      onTap: _showImageSourceSheet,
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppColors.iconBackground),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(
                  Icons.image_outlined,
                  color: Color(0xFF1E293B),
                  size: 20,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text('Upload Photo Proof',
                    style: GoogleFonts.inter(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: const Color(0xFF1E293B),
                    ),
                  ),
                ),
                if (_imageFile != null)
                  TextButton(
                    key: const Key('changeProofButton'),
                    onPressed: _showImageSourceSheet,
                    child: const Text('Change Photo'),
                  ),
              ],
            ),
            const SizedBox(height: 16),
            if (_imageFile == null)
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(vertical: 36),
                decoration: BoxDecoration(
                  color: const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: AppColors.outlineVariant),
                ),
                child: Column(
                  children: [
                    const Icon(
                      Icons.cloud_upload_outlined,
                      color: AppColors.primaryGradientEnd,
                      size: 34,
                    ),
                    const SizedBox(height: 10),
                    Text('Tap to upload photo',
                      style: GoogleFonts.inter(
                        color: const Color(0xFF1E293B),
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text('Camera or gallery',
                      style: GoogleFonts.inter(
                        color: AppColors.slate500,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              )
            else
              Stack(
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(14),
                    child: Image.file(
                      _imageFile!,
                      width: double.infinity,
                      height: 220,
                      fit: BoxFit.cover,
                    ),
                  ),
                  Positioned(
                    top: 8,
                    right: 8,
                    child: IconButton.filled(
                      key: const Key('removeProofButton'),
                      onPressed: () => setState(() => _imageFile = null),
                      icon: const Icon(Icons.close),
                      style: IconButton.styleFrom(
                        backgroundColor: const Color(0xFFDC2626),
                        foregroundColor: Colors.white,
                      ),
                    ),
                  ),
                ],
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildNoteCard() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFFFFBEB), // Pale yellow
        borderRadius: BorderRadius.circular(12),
      ),
      child: RichText(
        text: TextSpan(
          style: GoogleFonts.inter(
            fontSize: 13,
            height: 1.5,
            color: AppColors.warningText, // Amber text color
          ),
          children: const [
            TextSpan(
              text: 'Note: ',
              style: TextStyle(fontWeight: FontWeight.w700),
            ),
            TextSpan(
              text:
                  'Payments are verified manually by our team. Balance will be updated within 24 hours of verification.',
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSubmitButton() {
    final canSubmit = _imageFile != null && !_isUploading;

    return GestureDetector(
      onTap: canSubmit ? _submit : null,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        height: 56,
        decoration: BoxDecoration(
          color: canSubmit ? AppColors.primaryGradientEnd : AppColors.outlineVariant,
          borderRadius: BorderRadius.circular(16),
        ),
        child: Center(
          child: _isUploading
              ? const SizedBox(
                  width: 24,
                  height: 24,
                  child: CircularProgressIndicator(
                    color: Colors.white,
                    strokeWidth: 2.5,
                  ),
                )
              : Text('Submit Proof',
                  style: GoogleFonts.inter(
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                    color: canSubmit ? Colors.white : AppColors.slate500,
                  ),
                ),
        ),
      ),
    );
  }
}
