import 'dart:ui' as ui;
import 'package:universal_io/io.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:image_picker/image_picker.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:voltium_rider/utils/app_constants.dart';
import 'package:voltium_rider/widgets/image_source_sheet.dart';
import '../../../../theme/app_theme.dart';
import 'package:voltium_rider/theme/app_typography.dart';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:voltium_rider/core/state/riverpod_providers.dart';

class TopUpProofScreen extends ConsumerStatefulWidget {
  final int amount;
  final VoidCallback? onBack;
  final VoidCallback? onEditAmount;
  final Function(File)? onImageSelected;
  final Function(File image, String? method, String? upiRef)? onSubmit;

  const TopUpProofScreen({
    super.key,
    required this.amount,
    this.onBack,
    this.onEditAmount,
    this.onImageSelected,
    this.onSubmit,
  });

  @override
  ConsumerState<TopUpProofScreen> createState() => _TopUpProofScreenState();
}

enum PaymentMode { cash, upi, online }

class _TopUpProofScreenState extends ConsumerState<TopUpProofScreen> {
  final ImagePicker _picker = ImagePicker();
  File? _imageFile;
  bool _isUploading = false;
  PaymentMode _selectedPaymentMode = PaymentMode.cash;
  String _selectedGateway = 'razorpay';

  void _showOnlinePaymentAlertDialog() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadius.lg)),
        title: Row(
          children: [
            const Icon(Icons.bolt, color: AppColors.primaryLight, size: 28),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                'Instant Online Top-Up',
                style: AppTypography.titleMedium
                    .copyWith(color: AppColors.slate800),
              ),
            ),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.all(Spacing.sm),
              decoration: BoxDecoration(
                color: AppColors.warningSurface,
                borderRadius: BorderRadius.circular(AppRadius.md),
              ),
              child: Row(
                children: [
                  const Icon(Icons.info_outline,
                      color: AppColors.onSurface, size: 20),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Instant Top-Up Notice',
                      style: AppTypography.labelLarge
                          .copyWith(color: AppColors.onSurface),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            Text(
              'Your wallet top-up will be processed instantly upon successful payment.',
              style: GoogleFonts.plusJakartaSans(
                  fontSize: 14, color: AppColors.slate700),
            ),
            const SizedBox(height: 8),
            Text(
              'Note: Payment gateway fee of up to 2.5% extra will apply on online transactions when enabled by admin.',
              style: GoogleFonts.plusJakartaSans(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: AppColors.error,
              ),
            ),
            const SizedBox(height: 16),
            Text(
              'Select Payment Gateway:',
              style:
                  AppTypography.labelMedium.copyWith(color: AppColors.slate800),
            ),
            const SizedBox(height: 8),
            DropdownButtonFormField<String>(
              value: _selectedGateway,
              decoration: InputDecoration(
                contentPadding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(AppRadius.md)),
              ),
              items: const [
                DropdownMenuItem(
                    value: 'razorpay', child: Text('Razorpay Gateway')),
                DropdownMenuItem(
                    value: 'phonepe', child: Text('PhonePe Gateway')),
                DropdownMenuItem(
                    value: 'cashfree', child: Text('Cashfree Gateway')),
                DropdownMenuItem(
                    value: 'easebuzz', child: Text('Easebuzz Gateway')),
              ],
              onChanged: (val) {
                if (val != null) {
                  setState(() => _selectedGateway = val);
                }
              },
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primaryLight,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(AppRadius.md)),
            ),
            onPressed: () async {
              Navigator.pop(ctx);
              setState(() {
                _selectedPaymentMode = PaymentMode.online;
              });
              final rider = ref.read(riderProvider).rider;
              final riderId = rider?.id ?? rider?.riderId ?? '';
              final checkoutUrl = Uri.parse(
                'https://api.razorpay.com/v1/checkout/embedded?rider_id=$riderId&amount=${widget.amount}&gateway=$_selectedGateway',
              );
              if (await canLaunchUrl(checkoutUrl)) {
                await launchUrl(checkoutUrl,
                    mode: LaunchMode.externalApplication);
              }
            },
            child: const Text('Proceed to Pay'),
          ),
        ],
      ),
    );
  }

  Widget _buildPaymentMethodSelector() {
    final colors = AppColors.of(context);
    return Container(
      padding: Spacing.paddingMd,
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        boxShadow: AppShadows.glass,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'SELECT PAYMENT METHOD',
            style: AppTypography.bodySmall
                .copyWith(fontWeight: FontWeight.w600)
                .copyWith(color: colors.onSurfaceMuted, letterSpacing: 0.5),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: GestureDetector(
                  onTap: () =>
                      setState(() => _selectedPaymentMode = PaymentMode.cash),
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    decoration: BoxDecoration(
                      color: _selectedPaymentMode == PaymentMode.cash
                          ? colors.primarySurface
                          : colors.surface,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(
                        color: _selectedPaymentMode == PaymentMode.cash
                            ? AppColors.primaryLight
                            : colors.outlineVariant,
                        width: 1.5,
                      ),
                    ),
                    child: Column(
                      children: [
                        Icon(
                          Icons.payments_outlined,
                          color: _selectedPaymentMode == PaymentMode.cash
                              ? AppColors.primaryLight
                              : colors.onSurfaceMuted,
                          size: 22,
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'Cash',
                          style: AppTypography.labelMedium.copyWith(
                            color: _selectedPaymentMode == PaymentMode.cash
                                ? AppColors.primaryLight
                                : colors.onSurface,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: GestureDetector(
                  onTap: () {
                    HapticFeedback.lightImpact();
                    setState(() => _selectedPaymentMode = PaymentMode.upi);
                  },
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    decoration: BoxDecoration(
                      color: _selectedPaymentMode == PaymentMode.upi
                          ? colors.primarySurface
                          : colors.surface,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(
                        color: _selectedPaymentMode == PaymentMode.upi
                            ? AppColors.primaryLight
                            : colors.outlineVariant,
                        width: 1.5,
                      ),
                    ),
                    child: Column(
                      children: [
                        Icon(
                          Icons.qr_code_2,
                          color: _selectedPaymentMode == PaymentMode.upi
                              ? AppColors.primaryLight
                              : colors.onSurfaceMuted,
                          size: 22,
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'UPI',
                          style: AppTypography.labelMedium.copyWith(
                            color: _selectedPaymentMode == PaymentMode.upi
                                ? AppColors.primaryLight
                                : colors.onSurface,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: GestureDetector(
                  onTap: () {
                    HapticFeedback.lightImpact();
                    _showOnlinePaymentAlertDialog();
                  },
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    decoration: BoxDecoration(
                      color: _selectedPaymentMode == PaymentMode.online
                          ? colors.primarySurface
                          : colors.surface,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(
                        color: _selectedPaymentMode == PaymentMode.online
                            ? AppColors.primaryLight
                            : colors.outlineVariant,
                        width: 1.5,
                      ),
                    ),
                    child: Column(
                      children: [
                        Icon(
                          Icons.credit_card,
                          color: _selectedPaymentMode == PaymentMode.online
                              ? AppColors.primaryLight
                              : colors.onSurfaceMuted,
                          size: 22,
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'Instant',
                          style: AppTypography.labelMedium.copyWith(
                            color: _selectedPaymentMode == PaymentMode.online
                                ? AppColors.primaryLight
                                : colors.onSurface,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
          if (_selectedPaymentMode == PaymentMode.online) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: colors.primarySurface,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Row(
                children: [
                  const Icon(Icons.bolt,
                      color: AppColors.primaryLight, size: 18),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      'Gateway: ${_selectedGateway.toUpperCase()} selected. Instant top-up (up to 2.5% extra fee may apply).',
                      style: AppTypography.bodySmall
                          .copyWith(color: AppColors.primaryLight),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  Future<void> _pickImage(ImageSource source) async {
    if (AppConstants.isTestMode) {
      final image = File('${Directory.systemTemp.path}/mock_top_up_proof.png');
      setState(() => _imageFile = image);
      widget.onImageSelected?.call(image);
      return;
    }

    final picked = await _picker.pickImage(
      source: source,
      imageQuality: 85,
      maxWidth: 1600,
      maxHeight: 1600,
      requestFullMetadata: false,
    );
    if (picked == null || !mounted) return;

    final image = File(picked.path);
    setState(() => _imageFile = image);
    widget.onImageSelected?.call(image);
  }

  Future<void> _showImageSourceSheet() async {
    final source = await ImageSourceBottomSheet.show(context: context);
    if (source != null) {
      _pickImage(source);
    }
  }

  final TextEditingController _upiRefCtrl = TextEditingController();

  @override
  void dispose() {
    _upiRefCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_imageFile == null) return;
    setState(() => _isUploading = true);
    final methodStr = _selectedPaymentMode == PaymentMode.upi ? 'UPI' : 'CASH';
    final refVal = _selectedPaymentMode == PaymentMode.upi &&
            _upiRefCtrl.text.trim().isNotEmpty
        ? _upiRefCtrl.text.trim()
        : null;
    await widget.onSubmit?.call(_imageFile!, methodStr, refVal);
    if (mounted) setState(() => _isUploading = false);
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Scaffold(
      backgroundColor: colors.surface,
      extendBody: true, // For glass bottom nav
      body: Column(
        children: [
          _buildHeader(),
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(
                  20, 24, 20, 140), // extra bottom padding for floating footer
              child: Column(
                children: [
                  _buildAmountCard(),
                  const SizedBox(height: 16),
                  _buildPaymentMethodSelector(),
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
        ],
      ),
      bottomNavigationBar: ClipRect(
        child: BackdropFilter(
          filter: ui.ImageFilter.blur(sigmaX: 16, sigmaY: 16),
          child: Container(
            padding: EdgeInsets.fromLTRB(
                20, 20, 20, MediaQuery.of(context).padding.bottom + 20),
            decoration: BoxDecoration(
              color: colors.card.withValues(alpha: 0.8),
              border: Border(
                top: BorderSide(
                  color: colors.outlineVariant.withValues(alpha: 0.3),
                  width: 1,
                ),
              ),
            ),
            child: _buildSubmitButton(),
          ),
        ),
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
      decoration: BoxDecoration(
        gradient: AppGradients.primary,
        borderRadius: const BorderRadius.vertical(bottom: Radius.circular(40)),
        boxShadow: [
          BoxShadow(
            color: AppColors.primary.withValues(alpha: 0.3),
            blurRadius: 30,
            offset: const Offset(0, 10),
          ),
        ],
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
          SizedBox(height: 24),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.2),
              borderRadius: BorderRadius.circular(AppRadius.md),
            ),
            child: Text(
              'Step 2 of 2',
              style: AppTypography.labelMedium
                  .copyWith(color: Colors.white, letterSpacing: 0.5),
            ),
          ),
          SizedBox(height: 12),
          Text(
            'Upload Proof',
            style: AppTypography.displayMedium
                .copyWith(color: Colors.white, letterSpacing: -0.5),
          ),
        ],
      ),
    );
  }

  Widget _buildAmountCard() {
    return Container(
      padding: const EdgeInsets.all(Spacing.md),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        boxShadow: AppShadows.glass,
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
                    .copyWith(fontWeight: FontWeight.w600)
                    .copyWith(color: AppColors.slate500, letterSpacing: 0.5),
              ),
              SizedBox(height: 4),
              Text(
                '₹${widget.amount.toString().replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (Match m) => '${m[1]},')}',
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 28,
                  fontWeight: FontWeight.w800,
                  color: AppColors.primaryLight,
                ),
              ),
            ],
          ),
          TextButton(
            onPressed: widget.onEditAmount,
            style: TextButton.styleFrom(
              foregroundColor: AppColors.primaryLight,
            ),
            child: Text(
              'Edit',
              style: AppTypography.bodyMedium
                  .copyWith(fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildInstructionCard() {
    return Container(
      padding: const EdgeInsets.all(Spacing.md),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        boxShadow: AppShadows.glass,
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: const BoxDecoration(
              color: AppColors.primarySurface,
              shape: BoxShape.circle,
            ),
            child: const Icon(
              Icons.description_outlined,
              color: AppColors.primaryLight,
              size: 20,
            ),
          ),
          SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Proof of Top Up',
                  style: AppTypography.titleSmall
                      .copyWith(color: AppColors.slate800),
                ),
                SizedBox(height: 6),
                Text(
                  'Please attach a photo of the rider giving the cash to a Voltium team member or the receipt of the online payment.',
                  style: GoogleFonts.plusJakartaSans(
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
      borderRadius: BorderRadius.circular(AppRadius.lg),
      onTap: _showImageSourceSheet,
      child: Container(
        padding: const EdgeInsets.all(Spacing.md),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(AppRadius.lg),
          boxShadow: AppShadows.glass,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(
                  Icons.image_outlined,
                  color: AppColors.slate800,
                  size: 20,
                ),
                SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Upload Photo Proof',
                    style: AppTypography.titleSmall
                        .copyWith(color: AppColors.slate800),
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
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(AppRadius.lg),
                  border: Border.all(color: AppColors.outlineVariant),
                ),
                child: Column(
                  children: [
                    const Icon(
                      Icons.cloud_upload_outlined,
                      color: AppColors.primaryLight,
                      size: 34,
                    ),
                    SizedBox(height: 10),
                    Text(
                      'Tap to upload photo',
                      style: AppTypography.labelLarge
                          .copyWith(color: AppColors.slate800),
                    ),
                    SizedBox(height: 4),
                    Text(
                      'Camera or gallery',
                      style: GoogleFonts.plusJakartaSans(
                        color: AppColors.slate500,
                        fontSize: 14,
                      ),
                    ),
                  ],
                ),
              )
            else
              Stack(
                children: [
                  Container(
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(AppRadius.lg),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.1),
                          blurRadius: 10,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(AppRadius.lg),
                      child: Image.file(
                        _imageFile!,
                        width: double.infinity,
                        height: 220,
                        fit: BoxFit.cover,
                      ),
                    ),
                  ),
                  Positioned(
                    top: 12,
                    right: 12,
                    child: IconButton.filled(
                      key: const Key('removeProofButton'),
                      onPressed: () => setState(() => _imageFile = null),
                      icon: const Icon(Icons.close, size: 20),
                      style: IconButton.styleFrom(
                        backgroundColor: AppColors.error,
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
      padding: Spacing.paddingMd,
      decoration: BoxDecoration(
        color: AppColors.warningSurface, // Pale yellow
        borderRadius: BorderRadius.circular(AppRadius.lg),
      ),
      child: RichText(
        text: TextSpan(
          style: GoogleFonts.plusJakartaSans(
            fontSize: 14,
            height: 1.5,
            color: AppColors.onSurface, // Amber text color
          ),
          children: [
            TextSpan(
              text: 'Note: ',
              style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w700),
            ),
            const TextSpan(
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
      behavior: HitTestBehavior.opaque,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        height: 60,
        decoration: BoxDecoration(
          gradient: canSubmit ? AppGradients.primary : null,
          color: canSubmit ? null : AppColors.outlineVariant,
          borderRadius: BorderRadius.circular(AppRadius.lg),
          boxShadow: canSubmit
              ? [
                  BoxShadow(
                    color: AppColors.primary.withValues(alpha: 0.3),
                    blurRadius: 16,
                    offset: const Offset(0, 8),
                  ),
                ]
              : null,
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
              : Text(
                  'Submit Proof',
                  style: AppTypography.titleSmall.copyWith(
                      letterSpacing: 0.5,
                      color: canSubmit ? Colors.white : AppColors.slate400),
                ),
        ),
      ),
    );
  }
}
