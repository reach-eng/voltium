import 'dart:ui' as ui;
import 'package:universal_io/io.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:image_picker/image_picker.dart';
import 'package:voltium_rider/utils/app_constants.dart';
import 'package:voltium_rider/widgets/image_source_sheet.dart';
import 'package:voltium_rider/widgets/pending_uploads_pill.dart';
import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:voltium_rider/utils/toast.dart';
import '../../../../theme/app_theme.dart';
import 'package:voltium_rider/theme/app_typography.dart';

import 'package:flutter_riverpod/flutter_riverpod.dart';

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

enum PaymentMode { cash, upi, instant }

class _TopUpProofScreenState extends ConsumerState<TopUpProofScreen> {
  final ImagePicker _picker = ImagePicker();
  File? _imageFile;
  bool _isUploading = false;
  PaymentMode _selectedPaymentMode = PaymentMode.cash;
  final String _mdrBearer = 'RIDER';
  final double _extraFeePercent = 2.5;

  Future<void> _showInstantPaymentAlert() async {
    HapticFeedback.lightImpact();
    final isRiderBearer = _mdrBearer == 'RIDER';
    final fee =
        isRiderBearer ? (widget.amount * (_extraFeePercent / 100)).round() : 0;

    final proceed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.of(context).card,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: AppColors.primaryLight.withValues(alpha: 0.1),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.bolt,
                  color: AppColors.primaryLight, size: 24),
            ),
            const SizedBox(width: 12),
            const Text(
              'Instant Payment',
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
            ),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              isRiderBearer
                  ? 'Top-up will be instant. Up to 2.5% extra (₹$fee) gateway fee will be added to your top-up amount.'
                  : 'Top-up will be instant. Gateway fee is 100% covered by Voltium (₹0 extra fee for rider).',
              style: GoogleFonts.plusJakartaSans(
                fontSize: 14,
                height: 1.4,
                color: AppColors.of(context).onSurface,
              ),
            ),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.of(context).primarySurface,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                children: [
                  const Icon(Icons.info_outline,
                      size: 18, color: AppColors.primaryLight),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Points to current active payment gateway',
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: AppColors.primaryLight,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            // T-66: hardcoded English button label. Localised
            // via the existing `txtcancel` ARB key.
            child: Text(AppLocalizations.of(context)!.txtcancel,
                style:
                    TextStyle(color: AppColors.of(context).onSurfaceVariant)),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primaryLight,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12)),
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
            ),
            // T-66: hardcoded English button label. Localised
            // via the existing `txtproceedToPayment` ARB key
            // (the closest semantic match — the rider proceeds
            // to the payment step).
            child: Text(AppLocalizations.of(context)!.txtproceedToPayment,
                style: const TextStyle(fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );

    if (proceed == true) {
      setState(() => _selectedPaymentMode = PaymentMode.instant);
    }
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
                  key: const Key('instantPaymentOption'),
                  onTap: _showInstantPaymentAlert,
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    decoration: BoxDecoration(
                      color: _selectedPaymentMode == PaymentMode.instant
                          ? colors.primarySurface
                          : colors.surface,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(
                        color: _selectedPaymentMode == PaymentMode.instant
                            ? AppColors.primaryLight
                            : colors.outlineVariant,
                        width: 1.5,
                      ),
                    ),
                    child: Column(
                      children: [
                        Icon(
                          Icons.bolt_rounded,
                          color: _selectedPaymentMode == PaymentMode.instant
                              ? AppColors.primaryLight
                              : colors.onSurfaceMuted,
                          size: 22,
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'Instant',
                          style: AppTypography.labelMedium.copyWith(
                            color: _selectedPaymentMode == PaymentMode.instant
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
    // ONBOARDING-AUDIT 2026-08-14 follow-up: double-tap guard at the
    // top of the handler. The submit button is gated on
    // `!_isUploading` but `setState(() => _isUploading = true)` is
    // only set below — a rapid double-tap can fire two onTaps before
    // the framework repaints, which would submit two SECURITY_DEPOSIT
    // (or TOP_UP) transactions. Bail out before any work begins.
    if (_isUploading) return;
    setState(() => _isUploading = true);
    final methodStr = _selectedPaymentMode == PaymentMode.instant
        ? 'INSTANT'
        : (_selectedPaymentMode == PaymentMode.upi ? 'UPI' : 'CASH');
    final refVal = _selectedPaymentMode == PaymentMode.upi &&
            _upiRefCtrl.text.trim().isNotEmpty
        ? _upiRefCtrl.text.trim()
        : null;

    final fileToSubmit = _imageFile ??
        File('${Directory.systemTemp.path}/instant_payment_receipt.png');

    try {
      await widget.onSubmit?.call(fileToSubmit, methodStr, refVal);
    } finally {
      if (mounted) setState(() => _isUploading = false);
    }
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
                  if (_selectedPaymentMode == PaymentMode.upi) ...[
                    const SizedBox(height: 16),
                    _buildUpiDetailsCard(),
                  ],
                  if (_selectedPaymentMode == PaymentMode.instant) ...[
                    const SizedBox(height: 16),
                    _buildInstantBreakdownCard(),
                  ],
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
              const PendingUploadsPill(),
            ],
          ),
          const SizedBox(height: 24),
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
          const SizedBox(height: 12),
          Text(
            'Upload Proof',
            style: AppTypography.displayMedium
                .copyWith(color: Colors.white, letterSpacing: -0.5),
          ),
        ],
      ),
    );
  }

  Widget _buildUpiDetailsCard() {
    final colors = AppColors.of(context);
    const companyUpiId = 'payments.voltium@icici';

    return Container(
      padding: const EdgeInsets.all(Spacing.md),
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        boxShadow: AppShadows.glass,
        border: Border.all(
          color: AppColors.primaryLight.withValues(alpha: 0.3),
          width: 1.5,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: AppColors.primaryLight.withValues(alpha: 0.1),
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.qr_code_2_rounded,
                  color: AppColors.primaryLight,
                  size: 20,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Pay via UPI',
                      style: AppTypography.titleSmall
                          .copyWith(color: colors.onSurface),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'Transfer to Voltium official UPI ID',
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 12,
                        color: colors.onSurfaceMuted,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          // UPI ID copy box
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              color: colors.surface,
              borderRadius: BorderRadius.circular(AppRadius.md),
              border: Border.all(color: colors.outlineVariant),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'VOLTIUM UPI ID',
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                          color: colors.onSurfaceMuted,
                          letterSpacing: 0.5,
                        ),
                      ),
                      const SizedBox(height: 2),
                      SelectableText(
                        companyUpiId,
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                          color: AppColors.primaryLight,
                        ),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  key: const Key('copyUpiIdButton'),
                  onPressed: () {
                    Clipboard.setData(const ClipboardData(text: companyUpiId));
                    HapticFeedback.lightImpact();
                    Toast.success(
                      context,
                      AppLocalizations.of(context)!.txtupiIdCopiedToClipboard,
                    );
                  },
                  icon: const Icon(Icons.copy_rounded, size: 18),
                  color: AppColors.primaryLight,
                  tooltip: 'Copy UPI ID',
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          // UPI Reference / UTR Number input
          Text(
            'UPI Reference / UTR Number',
            style: AppTypography.labelMedium.copyWith(
              color: colors.onSurface,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 6),
          TextFormField(
            key: const Key('upiRefField'),
            controller: _upiRefCtrl,
            keyboardType: TextInputType.text,
            textCapitalization: TextCapitalization.characters,
            inputFormatters: [
              FilteringTextInputFormatter.allow(RegExp(r'[a-zA-Z0-9]')),
              LengthLimitingTextInputFormatter(22),
            ],
            style: GoogleFonts.plusJakartaSans(
              fontSize: 14,
              fontWeight: FontWeight.w600,
              color: colors.onSurface,
            ),
            decoration: InputDecoration(
              hintText: 'Enter 12-digit UTR / Ref (optional)',
              hintStyle: GoogleFonts.plusJakartaSans(
                fontSize: 13,
                color: colors.onSurfaceMuted,
              ),
              prefixIcon: Icon(
                Icons.tag_rounded,
                size: 18,
                color: colors.onSurfaceMuted,
              ),
              filled: true,
              fillColor: colors.surface,
              contentPadding:
                  const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(AppRadius.md),
                borderSide: BorderSide(color: colors.outlineVariant),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(AppRadius.md),
                borderSide:
                    const BorderSide(color: AppColors.primaryLight, width: 1.5),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAmountCard() {
    final colors = AppColors.of(context);
    return Container(
      padding: const EdgeInsets.all(Spacing.md),
      decoration: BoxDecoration(
        color: colors.card,
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
                    .copyWith(
                        color: colors.onSurfaceVariant, letterSpacing: 0.5),
              ),
              const SizedBox(height: 4),
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
    final colors = AppColors.of(context);
    return Container(
      padding: const EdgeInsets.all(Spacing.md),
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        boxShadow: AppShadows.glass,
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: AppColors.of(context).primarySurface,
              shape: BoxShape.circle,
            ),
            child: const Icon(
              Icons.description_outlined,
              color: AppColors.primaryLight,
              size: 20,
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Proof of Top Up',
                  style: AppTypography.titleSmall
                      .copyWith(color: colors.onSurface),
                ),
                const SizedBox(height: 6),
                Text(
                  'Please attach a photo of the rider giving the cash to a Voltium team member or the receipt of the online payment.',
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 14,
                    height: 1.4,
                    color: colors.onSurfaceMuted,
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
    final colors = AppColors.of(context);
    return InkWell(
      key: const Key('uploadProofCard'),
      borderRadius: BorderRadius.circular(AppRadius.lg),
      onTap: _showImageSourceSheet,
      child: Container(
        padding: const EdgeInsets.all(Spacing.md),
        decoration: BoxDecoration(
          color: colors.card,
          borderRadius: BorderRadius.circular(AppRadius.lg),
          boxShadow: AppShadows.glass,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(
                  Icons.image_outlined,
                  color: colors.onSurface,
                  size: 20,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Upload Photo Proof',
                    style: AppTypography.titleSmall
                        .copyWith(color: colors.onSurface),
                  ),
                ),
                if (_imageFile != null)
                  TextButton(
                    key: const Key('changeProofButton'),
                    onPressed: _showImageSourceSheet,
                    // T-66: hardcoded English button label. Localised
                    // via the existing `txtchangePhoto` ARB key.
                    child: Text(AppLocalizations.of(context)!.txtchangePhoto),
                  ),
              ],
            ),
            const SizedBox(height: 16),
            if (_imageFile == null)
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(vertical: 36),
                decoration: BoxDecoration(
                  color: colors.surface,
                  borderRadius: BorderRadius.circular(AppRadius.lg),
                  border: Border.all(color: colors.outlineVariant),
                ),
                child: Column(
                  children: [
                    const Icon(
                      Icons.cloud_upload_outlined,
                      color: AppColors.primaryLight,
                      size: 34,
                    ),
                    const SizedBox(height: 10),
                    Text(
                      'Tap to upload photo',
                      style: AppTypography.labelLarge
                          .copyWith(color: colors.onSurface),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Camera or gallery',
                      style: GoogleFonts.plusJakartaSans(
                        color: colors.onSurfaceVariant,
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

  Widget _buildInstantBreakdownCard() {
    final isRiderBearer = _mdrBearer == 'RIDER';
    final fee =
        isRiderBearer ? (widget.amount * (_extraFeePercent / 100)).round() : 0;
    final total = widget.amount + fee;

    return Container(
      padding: const EdgeInsets.all(Spacing.md),
      decoration: BoxDecoration(
        color: AppColors.of(context).primarySurface,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        border: Border.all(
            color: AppColors.primaryLight.withValues(alpha: 0.3), width: 1.5),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.bolt, color: AppColors.primaryLight, size: 20),
              const SizedBox(width: 8),
              Text(
                'Instant Payment Breakdown',
                style: AppTypography.titleSmall
                    .copyWith(color: AppColors.of(context).onSurface),
              ),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: isRiderBearer
                      ? AppColors.primaryLight
                      : AppColors.success,
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  isRiderBearer ? '+$_extraFeePercent% Fee' : '₹0 Rider Fee',
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              // T-66: hardcoded English receipt line. Localised
              // via the new `txttopUpAmountAddedToWallet` ARB key.
              Text(AppLocalizations.of(context)!.txttopUpAmountAddedToWallet,
                  style: GoogleFonts.plusJakartaSans(
                      color: AppColors.of(context).onSurfaceVariant,
                      fontSize: 14)),
              Text('₹${widget.amount}',
                  style: GoogleFonts.plusJakartaSans(
                      fontWeight: FontWeight.w600,
                      color: AppColors.of(context).onSurface,
                      fontSize: 14)),
            ],
          ),
          const SizedBox(height: 6),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                  isRiderBearer
                      ? 'Gateway Fee ($_extraFeePercent%)'
                      : 'Gateway Fee',
                  style: GoogleFonts.plusJakartaSans(
                      color: AppColors.of(context).onSurfaceVariant,
                      fontSize: 14)),
              Text(
                isRiderBearer ? '+₹$fee' : '₹0 (Paid by Voltium)',
                style: GoogleFonts.plusJakartaSans(
                  fontWeight: FontWeight.w600,
                  color: isRiderBearer ? AppColors.warning : AppColors.success,
                  fontSize: 14,
                ),
              ),
            ],
          ),
          const Divider(height: 20),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              // T-66: hardcoded English receipt line. Localised
              // via the new `txttotalPayable` ARB key.
              Text(AppLocalizations.of(context)!.txttotalPayable,
                  style: GoogleFonts.plusJakartaSans(
                      fontWeight: FontWeight.bold,
                      color: AppColors.of(context).onSurface,
                      fontSize: 15)),
              Text('₹$total',
                  style: GoogleFonts.plusJakartaSans(
                      fontWeight: FontWeight.w800,
                      color: AppColors.primaryLight,
                      fontSize: 18)),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildNoteCard() {
    final colors = AppColors.of(context);
    return Container(
      padding: Spacing.paddingMd,
      decoration: BoxDecoration(
        color: colors.warningSurface,
        borderRadius: BorderRadius.circular(AppRadius.lg),
      ),
      child: RichText(
        text: TextSpan(
          style: GoogleFonts.plusJakartaSans(
            fontSize: 14,
            height: 1.5,
            color: colors.onSurfaceVariant,
          ),
          children: [
            TextSpan(
              text: 'Note: ',
              style: GoogleFonts.plusJakartaSans(
                fontWeight: FontWeight.w700,
                color: colors.onSurface,
              ),
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
    final isInstant = _selectedPaymentMode == PaymentMode.instant;
    final canSubmit = (isInstant || _imageFile != null) && !_isUploading;
    final isRiderBearer = _mdrBearer == 'RIDER';
    final fee =
        isRiderBearer ? (widget.amount * (_extraFeePercent / 100)).round() : 0;
    final total = widget.amount + fee;
    final colors = AppColors.of(context);

    return GestureDetector(
      onTap: canSubmit ? _submit : null,
      behavior: HitTestBehavior.opaque,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        height: 60,
        decoration: BoxDecoration(
          gradient: canSubmit ? AppGradients.primary : null,
          color: canSubmit ? null : colors.outlineVariant,
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
                  isInstant
                      ? 'Proceed to Instant Pay (₹$total)'
                      : 'Submit Proof',
                  style: AppTypography.titleSmall.copyWith(
                      letterSpacing: 0.5,
                      color: canSubmit ? Colors.white : colors.onSurfaceMuted),
                ),
        ),
      ),
    );
  }
}
