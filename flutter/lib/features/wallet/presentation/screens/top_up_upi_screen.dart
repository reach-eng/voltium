import 'package:universal_io/io.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:image_picker/image_picker.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:voltium_rider/theme/app_theme.dart';
import 'package:voltium_rider/utils/app_constants.dart';
import 'package:voltium_rider/widgets/image_source_sheet.dart';

import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/core/network/api_client.dart';
import 'package:voltium_rider/core/network/generated/api_client.dart';
import 'package:voltium_rider/core/network/files_repository.dart';
import 'package:voltium_rider/theme/app_typography.dart';

/// Matches web TopUpUpiScreen.tsx:
/// - Gradient header with back btn + "Step 3 of 3" + "Top Up"
/// - Amount summary card (white) with large amount and "Edit" link
/// - Info box (blue-10) with Smartphone icon
/// - Upload proof area:
///   - Dashed border if no photo
///   - Image preview with red "X" remove button if photo exists
/// - Yellow "Note" box
/// - Gradient "Submit Proof" pill button

class TopUpUpiScreen extends ConsumerStatefulWidget {
  final int amount;
  final String purpose;
  final VoidCallback? onSubmit;
  final VoidCallback? onBack;
  final VoidCallback? onEditAmount;

  const TopUpUpiScreen({
    super.key,
    required this.amount,
    required this.purpose,
    this.onSubmit,
    this.onBack,
    this.onEditAmount,
  });

  @override
  ConsumerState<TopUpUpiScreen> createState() => _TopUpUpiScreenState();
}

class _TopUpUpiScreenState extends ConsumerState<TopUpUpiScreen>
    with SingleTickerProviderStateMixin {
  File? _imageFile;
  bool _isSubmitting = false;
  late final AnimationController _entryCtrl;

  @override
  void initState() {
    super.initState();
    _entryCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    )..forward();
  }

  @override
  void dispose() {
    _entryCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickImage() async {
    if (AppConstants.isTestMode) {
      setState(() =>
          _imageFile = File('${Directory.systemTemp.path}/mock_proof.png'));
      return;
    }

    final source = await ImageSourceBottomSheet.show(context: context);
    if (source == null) return;

    final picker = ImagePicker();
    final pickedFile = await picker.pickImage(
      source: source,
      maxWidth: 1600,
      maxHeight: 1600,
      imageQuality: 85,
      requestFullMetadata: false,
    );
    if (pickedFile != null && mounted) {
      setState(() => _imageFile = File(pickedFile.path));
    }
  }

  Future<void> _handleSubmit() async {
    if (_imageFile == null || _isSubmitting) return;
    setState(() => _isSubmitting = true);

    try {
      final client = ApiClient();
      final filesRepo = FilesRepository(client, VoltiumApiClient(client));
      final photoUrl = await filesRepo.uploadFile(_imageFile!, 'TOPUP_PROOF');
      if (!mounted) return;

      final riderId = ref.read(riderProvider).riderId;
      if (riderId == null) throw Exception('Not logged in');

      await ref.read(walletProvider).topUpWallet(
            riderId: riderId,
            amount: widget.amount.toDouble(),
            method: 'UPI',
            screenshotUrl: photoUrl,
            purpose: widget.purpose,
          );

      if (mounted) {
        widget.onSubmit?.call();
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isSubmitting = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: ${e.toString()}')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final canSubmit = _imageFile != null && !_isSubmitting;

    return Scaffold(
      backgroundColor: AppColors.surface,
      body: Column(
        children: [
          // Gradient header
          _buildHeader(),

          // Scrollable content
          Expanded(
            child: Transform.translate(
              offset: const Offset(0, -16),
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 32),
                child: Column(
                  children: [
                    // Amount Summary
                    _buildAmountSummary(),

                    const SizedBox(height: 16),

                    // Info Box
                    _buildInfoBox(),

                    const SizedBox(height: 16),

                    // Upload Area
                    _buildUploadArea(),

                    const SizedBox(height: 16),

                    // Note Box
                    _buildNoteBox(),

                    const SizedBox(height: 24),

                    // Submit Button
                    _buildSubmitButton(canSubmit),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildHeader() {
    return Container(
      padding: EdgeInsets.fromLTRB(
        20,
        MediaQuery.of(context).padding.top + 12,
        20,
        40,
      ),
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          colors: [AppColors.primary, AppColors.primaryLight],
          begin: Alignment.centerLeft,
          end: Alignment.centerRight,
        ),
      ),
      child: Stack(
        children: [
          Positioned(
            top: 0,
            left: 0,
            child: GestureDetector(
              onTap: widget.onBack ?? () => Navigator.maybePop(context),
              child: Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.15),
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.arrow_back,
                  color: Colors.white,
                  size: 20,
                ),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.only(left: 48, top: 4),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  padding: const EdgeInsets.all(2),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(AppRadius.md),
                  ),
                  child: Text(
                    ' Step 2 of 2 ',
                    style: AppTypography.labelMedium
                        .copyWith(color: AppColors.primary),
                  ),
                ),
                SizedBox(height: 4),
                Text(
                  'Top Up',
                  style: AppTypography.titleLarge
                      .copyWith(fontSize: 21)
                      .copyWith(color: Colors.white),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAmountSummary() {
    final colors = AppColors.of(context);
    final anim =
        CurvedAnimation(parent: _entryCtrl, curve: const Interval(0.1, 0.6));
    return FadeTransition(
      opacity: anim,
      child: Container(
        padding: const EdgeInsets.all(Spacing.md),
        decoration: BoxDecoration(
          color: colors.card,
          borderRadius: BorderRadius.circular(AppRadius.lg),
          border: Border.all(color: AppColors.primary.withValues(alpha: 0.1)),
          boxShadow: AppShadows.card,
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'TOP-UP AMOUNT',
                  style: AppTypography.bodySmall
                      .copyWith(fontWeight: FontWeight.w800)
                      .copyWith(
                        color: colors.onSurfaceMuted,
                        letterSpacing: 1.2,
                      ),
                ),
                SizedBox(height: 4),
                Text(
                  '₹${widget.amount.toString().replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (Match m) => '${m[1]},')}',
                  style: AppTypography.headingLarge
                      .copyWith(color: AppColors.primary),
                ),
              ],
            ),
            GestureDetector(
              key: const Key('editAmountLink'),
              onTap: widget.onEditAmount,
              child: Padding(
                padding: const EdgeInsets.symmetric(
                    vertical: 16.0, horizontal: 12.0),
                child: Text(
                  'Edit',
                  style: AppTypography.bodySmall
                      .copyWith(fontWeight: FontWeight.w800)
                      .copyWith(
                        color: AppColors.primary,
                        decoration: TextDecoration.underline,
                        decorationColor:
                            AppColors.primary.withValues(alpha: 0.3),
                        decorationThickness: 2,
                      ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildInfoBox() {
    final colors = AppColors.of(context);
    final anim =
        CurvedAnimation(parent: _entryCtrl, curve: const Interval(0.2, 0.7));
    return FadeTransition(
      opacity: anim,
      child: Container(
        padding: const EdgeInsets.all(Spacing.sm),
        decoration: BoxDecoration(
          color: colors.card,
          borderRadius: BorderRadius.circular(AppRadius.lg),
          boxShadow: AppShadows.card,
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: AppColors.primary.withValues(alpha: 0.1),
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.smartphone,
                color: AppColors.primary,
                size: 20,
              ),
            ),
            SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Proof of Top Up',
                    style: AppTypography.labelLarge
                        .copyWith(color: AppColors.onSurfaceMuted),
                  ),
                  SizedBox(height: 4),
                  Text(
                    'Please attach a photo of the rider giving the cash to a Voltium team member or the receipt of the online payment.',
                    style: GoogleFonts.plusJakartaSans(
                      fontSize: 14,
                      color: AppColors.onSurfaceVariant,
                      height: 1.5,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildUploadArea() {
    final anim =
        CurvedAnimation(parent: _entryCtrl, curve: const Interval(0.3, 0.8));
    return FadeTransition(
      opacity: anim,
      child: Container(
        padding: const EdgeInsets.all(Spacing.md),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(AppRadius.lg),
          boxShadow: AppShadows.card,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(
                  Icons.image_outlined,
                  size: 16,
                  color: AppColors.onSurfaceVariant,
                ),
                SizedBox(width: 8),
                Text(
                  'Upload Photo Proof',
                  style: AppTypography.bodyMedium
                      .copyWith(fontWeight: FontWeight.w600)
                      .copyWith(color: AppColors.onSurfaceMuted),
                ),
              ],
            ),
            const SizedBox(height: 16),
            if (_imageFile == null)
              GestureDetector(
                key: const Key('uploadProofArea'),
                onTap: _pickImage,
                child: Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(vertical: 40),
                  decoration: BoxDecoration(
                    color: AppColors.surface,
                    borderRadius: BorderRadius.circular(AppRadius.lg),
                    border: Border.all(
                      color: AppColors.divider,
                      width: 2,
                      style: BorderStyle
                          .solid, // Flutter doesn't have dashed natively easily without custom painter
                    ),
                  ),
                  child: Column(
                    children: [
                      Container(
                        width: 48,
                        height: 48,
                        decoration: BoxDecoration(
                          color: AppColors.primary.withValues(alpha: 0.1),
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(
                          Icons.upload_outlined,
                          color: AppColors.primary,
                          size: 24,
                        ),
                      ),
                      SizedBox(height: 12),
                      Text(
                        'Tap to upload photo',
                        style: AppTypography.bodyMedium
                            .copyWith(fontWeight: FontWeight.w600)
                            .copyWith(color: AppColors.onSurfaceMuted),
                      ),
                      SizedBox(height: 4),
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 40),
                        child: Text(
                          'Ensure the photo shows both the rider and team member or the payment receipt',
                          textAlign: TextAlign.center,
                          style: GoogleFonts.plusJakartaSans(
                            fontSize: 13,
                            color: AppColors.onSurfaceVariant,
                            height: 1.4,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              )
            else
              Stack(
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(AppRadius.lg),
                    child: Image.file(
                      _imageFile!,
                      width: double.infinity,
                      height: 200,
                      fit: BoxFit.cover,
                    ),
                  ),
                  Positioned(
                    top: 8,
                    right: 8,
                    child: GestureDetector(
                      key: const Key('removeProofButton'),
                      onTap: () => setState(() => _imageFile = null),
                      child: Container(
                        width: 44,
                        height: 44,
                        decoration: const BoxDecoration(
                          color: AppColors.errorDark,
                          shape: BoxShape.circle,
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black26,
                              blurRadius: 4,
                              offset: Offset(0, 2),
                            ),
                          ],
                        ),
                        child: const Icon(
                          Icons.close,
                          color: Colors.white,
                          size: 24,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            if (_imageFile != null) ...[
              SizedBox(height: 12),
              Row(
                children: [
                  const Icon(
                    Icons.check_circle,
                    color: AppColors.success,
                    size: 14,
                  ),
                  SizedBox(width: 4),
                  Text(
                    'Photo uploaded successfully',
                    style: AppTypography.bodyMedium
                        .copyWith(color: AppColors.success),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildNoteBox() {
    final anim =
        CurvedAnimation(parent: _entryCtrl, curve: const Interval(0.4, 0.9));
    return FadeTransition(
      opacity: anim,
      child: Container(
        padding: Spacing.paddingMd,
        decoration: BoxDecoration(
          color: AppColors.warningSurface,
          borderRadius: BorderRadius.circular(AppRadius.lg),
        ),
        child: RichText(
          text: TextSpan(
            style: GoogleFonts.plusJakartaSans(
              fontSize: 14,
              color: AppColors.onSurface,
              height: 1.5,
            ),
            children: [
              TextSpan(
                text: 'Note: ',
                style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.bold),
              ),
              const TextSpan(
                text:
                    'Payments are verified manually by our team. Balance will be updated within 24 hours of verification.',
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSubmitButton(bool canSubmit) {
    return GestureDetector(
      key: const Key('submitProofButton'),
      onTap: canSubmit ? _handleSubmit : null,
      behavior: HitTestBehavior.opaque,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        height: 56,
        decoration: BoxDecoration(
          gradient: canSubmit ? AppGradients.primary : null,
          color: canSubmit ? null : AppColors.divider,
          borderRadius: BorderRadius.circular(AppRadius.full),
          boxShadow: canSubmit ? AppShadows.primaryButton : null,
        ),
        child: Center(
          child: _isSubmitting
              ? const SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(
                    color: Colors.white,
                    strokeWidth: 2,
                  ),
                )
              : Text(
                  'Submit Proof',
                  style: AppTypography.labelLarge
                      .copyWith(fontWeight: FontWeight.w700)
                      .copyWith(
                          color: canSubmit
                              ? Colors.white
                              : AppColors.onSurfaceVariant),
                ),
        ),
      ),
    );
  }
}
