// PR-ONBOARDING-FLOW-2026-08-12: new active-path step.
//
// After the rider selects a plan (`choosePlan`), they must pay the
// security deposit before the pickup form. This screen is the
// rider-facing UI for that payment:
//
//   1. Show the deposit amount (joined from the rider's current plan).
//   2. Rider picks a payment method (UPI / bank transfer / cash).
//   3. Rider uploads a payment proof (image).
//   4. Submit — calls `VoltiumApiService.submitTopUp` with
//      `purpose: 'SECURITY_DEPOSIT'` and the proof URL. The server
//      records the deposit and an admin reviews + approves it on the
//      admin panel. Only after BOTH KYC approval AND deposit approval
//      does the rider flip from PICKUP_SCHEDULED → ACTIVE and the
//      HangTight screen auto-redirects to the dashboard.
//
// Design constraint (per the user): the new screen matches the current
// design language — brand blue (#0053C1), Plus Jakarta Sans typography,
// 4px spacing grid, the same `AppColors` / `AppTypography` / `Spacing` /
// `AppRadius` tokens. No existing screen (e.g. the archived top-up
// proof screen) is modified.

import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import 'package:voltium_rider/core/state/rider_provider.dart';
import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:voltium_rider/services/image_compression_service.dart';
import 'package:voltium_rider/services/voltium_api_service.dart';
import 'package:voltium_rider/theme/app_theme.dart';
import 'package:voltium_rider/theme/app_typography.dart';
import 'package:voltium_rider/utils/toast.dart';
import 'package:voltium_rider/widgets/image_source_sheet.dart';

/// New active-path step between `choosePlan` and `planSuccess`.
///
/// The deposit is a one-time payment during onboarding (UPI / bank
/// transfer / cash). Unlike the top-up flow (which has 4 screens:
/// amount → UPI → proof → receipt), this is a single screen because
/// the amount is fixed by the selected plan.
@Deprecated(
    'Use TopUpAmountScreen via router AuthState.topUpAmount. This screen is archived — see PR-ONBOARDING-FLOW-2026-08-13.')
class DepositWorkflowScreen extends ConsumerStatefulWidget {
  /// Invoked after the rider submits the deposit for review. The
  /// router advances to `planSuccess` (a brief confirmation) and
  /// then on to the pickup hub.
  final VoidCallback? onSubmitted;

  /// Invoked when the rider taps the back button. The router returns
  /// to `choosePlan`.
  final VoidCallback? onBack;

  const DepositWorkflowScreen({super.key, this.onSubmitted, this.onBack});

  @override
  ConsumerState<DepositWorkflowScreen> createState() =>
      _DepositWorkflowScreenState();
}

class _DepositWorkflowScreenState extends ConsumerState<DepositWorkflowScreen> {
  String _method = 'UPI';
  File? _proofImage;
  String? _proofImageUrl;
  bool _isUploadingProof = false;
  bool _isSubmitting = false;
  final _upiRefController = TextEditingController();
  final _compressionService = ImageCompressionService();

  @override
  void dispose() {
    _upiRefController.dispose();
    super.dispose();
  }

  Future<void> _pickProofImage() async {
    try {
      final source = await ImageSourceBottomSheet.show(context: context);
      if (source == null) return;
      final compressed = await _compressionService.pickAndCompress(
        source: source == ImageSource.camera
            ? ImageSource.camera
            : ImageSource.gallery,
        maxWidth: 1024,
        maxHeight: 1024,
        quality: 80,
      );
      if (compressed == null || !mounted) return;

      setState(() {
        _proofImage = compressed;
        _isUploadingProof = true;
        _proofImageUrl = null;
      });

      final url =
          await VoltiumApiService().uploadFile(compressed, 'security_deposit');
      if (!mounted) return;
      setState(() {
        _proofImageUrl = url;
        _isUploadingProof = false;
      });
    } catch (e) {
      if (mounted) {
        setState(() => _isUploadingProof = false);
        Toast.error(
          context,
          AppLocalizations.of(context)!.txtfailedToUploadProof(e.toString()),
        );
      }
    }
  }

  Future<void> _submit() async {
    final rider = ref.read(riderProvider).rider;
    final riderId = ref.read(riderProvider).riderId;
    final amount = rider?.activeRentalPlanSecurityDeposit ?? 0;
    if (riderId == null || amount <= 0) {
      Toast.error(
        context,
        'Cannot submit deposit: no active plan or zero deposit amount.',
      );
      return;
    }
    if (_proofImageUrl == null && _method != 'CASH') {
      Toast.error(
        context,
        AppLocalizations.of(context)!.txtpleaseUploadPaymentProof,
      );
      return;
    }

    setState(() => _isSubmitting = true);
    try {
      await VoltiumApiService().submitTopUp(
        riderId: riderId,
        amount: amount.toDouble(),
        method: _method,
        upiRef: _method == 'UPI' && _upiRefController.text.isNotEmpty
            ? _upiRefController.text
            : null,
        proofUrl: _proofImageUrl,
        purpose: 'SECURITY_DEPOSIT',
      );
      if (!mounted) return;
      await ref.read(riderProvider.notifier).refreshFromApi();
      if (!mounted) return;
      Toast.success(
        context,
        'Deposit submitted for review. We\'ll notify you when approved.',
      );
      // Move to the next step in the active path: planSuccess → pickupHub.
      widget.onSubmitted?.call();
    } catch (e) {
      if (mounted) {
        Toast.error(
          context,
          AppLocalizations.of(context)!.txtfailedToSubmitDeposit(e.toString()),
        );
      }
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final rider = ref.watch(riderProvider.select((p) => p.rider));
    final depositAmount = rider?.activeRentalPlanSecurityDeposit ?? 0;
    final planName = rider?.currentPlan ?? 'your selected plan';
    final canSubmit = !_isSubmitting &&
        !_isUploadingProof &&
        (_method == 'CASH' || _proofImageUrl != null);

    return Scaffold(
      backgroundColor: colors.surface,
      appBar: AppBar(
        // T-66: hardcoded English AppBar title. Localised via
        // the existing `wallet_securityDeposit` ARB key.
        title: Text(AppLocalizations.of(context)!.wallet_securityDeposit),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () {
            if (widget.onBack != null) {
              widget.onBack!();
            } else {
              Navigator.of(context).maybePop();
            }
          },
        ),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(Spacing.lg),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // ── Hero card: amount + plan ─────────────────────────
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(Spacing.lg),
                decoration: BoxDecoration(
                  gradient: AppGradients.primary,
                  borderRadius: BorderRadius.circular(AppRadius.lg),
                  boxShadow: AppShadows.primaryButton,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.18),
                            borderRadius: BorderRadius.circular(AppRadius.xs),
                          ),
                          child: const Text(
                            'SECURITY DEPOSIT',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                              letterSpacing: 1.0,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: Spacing.md),
                    Text(
                      '₹${_formatRupees(depositAmount.toInt())}',
                      style: AppTypography.displayMedium.copyWith(
                        color: Colors.white,
                        fontSize: 36,
                        fontWeight: FontWeight.w800,
                        letterSpacing: -0.8,
                      ),
                    ),
                    const SizedBox(height: Spacing.xs),
                    Text(
                      'Refundable • for $planName',
                      style: AppTypography.bodyMedium.copyWith(
                        color: Colors.white.withValues(alpha: 0.88),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: Spacing.lg),

              // ── Why we need this ───────────────────────────────
              Text(
                'Pay the security deposit to proceed to vehicle pickup. The deposit is fully refundable when you return the vehicle and close your account.',
                style: AppTypography.bodyMedium.copyWith(
                  color: colors.onSurfaceVariant,
                  height: 1.4,
                ),
              ),
              const SizedBox(height: Spacing.lg),

              // ── Payment method selector ─────────────────────────
              Text(
                'PAYMENT METHOD',
                style: AppTypography.labelSmall.copyWith(
                  color: colors.onSurfaceMuted,
                  letterSpacing: 1.0,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: Spacing.sm),
              _MethodSelector(
                selected: _method,
                onChanged: (m) => setState(() => _method = m),
              ),
              const SizedBox(height: Spacing.lg),

              // ── UPI reference (only when UPI is selected) ───────
              if (_method == 'UPI') ...[
                Text(
                  'UPI REFERENCE (OPTIONAL)',
                  style: AppTypography.labelSmall.copyWith(
                    color: colors.onSurfaceMuted,
                    letterSpacing: 1.0,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: Spacing.sm),
                TextField(
                  controller: _upiRefController,
                  decoration: InputDecoration(
                    hintText: 'e.g. UPI/2024/1234567890',
                    hintStyle: AppTypography.bodyMedium
                        .copyWith(color: colors.onSurfaceMuted),
                    filled: true,
                    fillColor: colors.card,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(AppRadius.md),
                      borderSide:
                          BorderSide(color: colors.outlineVariant, width: 1),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(AppRadius.md),
                      borderSide:
                          BorderSide(color: colors.outlineVariant, width: 1),
                    ),
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: Spacing.md,
                      vertical: Spacing.md,
                    ),
                  ),
                ),
                const SizedBox(height: Spacing.lg),
              ],

              // ── Proof upload (skip for cash) ─────────────────────
              if (_method != 'CASH') ...[
                Text(
                  'PAYMENT PROOF',
                  style: AppTypography.labelSmall.copyWith(
                    color: colors.onSurfaceMuted,
                    letterSpacing: 1.0,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: Spacing.sm),
                _ProofUploadCard(
                  imageFile: _proofImage,
                  imageUrl: _proofImageUrl,
                  isUploading: _isUploadingProof,
                  onTap: _pickProofImage,
                ),
                const SizedBox(height: Spacing.lg),
              ],

              // ── Info note ───────────────────────────────────────
              Container(
                padding: const EdgeInsets.all(Spacing.md),
                decoration: BoxDecoration(
                  color: AppColors.of(context).primarySurface,
                  borderRadius: BorderRadius.circular(AppRadius.md),
                  border: Border.all(
                    color: AppColors.primaryLightBlue,
                    width: 1,
                  ),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(
                      Icons.info_outline,
                      color: AppColors.primary,
                      size: 18,
                    ),
                    const SizedBox(width: Spacing.sm),
                    Expanded(
                      child: Text(
                        'An admin reviews the deposit within 5–10 minutes. We\'ll send a push notification when it\'s approved.',
                        style: AppTypography.bodySmall.copyWith(
                          color: colors.onSurfaceVariant,
                          height: 1.4,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: Spacing.xl),

              // ── Submit ─────────────────────────────────────────
              SizedBox(
                width: double.infinity,
                height: 52,
                child: FilledButton(
                  key: const Key('depositSubmitButton'),
                  onPressed: canSubmit ? _submit : null,
                  style: FilledButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: Colors.white,
                    disabledBackgroundColor: colors.outlineVariant,
                    disabledForegroundColor: colors.onSurfaceMuted,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(AppRadius.md),
                    ),
                  ),
                  child: _isSubmitting
                      ? const SizedBox(
                          width: 24,
                          height: 24,
                          child: CircularProgressIndicator(
                            color: Colors.white,
                            strokeWidth: 2,
                          ),
                        )
                      : Text(
                          'Submit for review',
                          style: AppTypography.labelLarge.copyWith(
                            fontWeight: FontWeight.w700,
                            color: Colors.white,
                          ),
                        ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Helpers ─────────────────────────────────────────────────────────

String _formatRupees(int amount) {
  final s = amount.toString();
  final buf = StringBuffer();
  for (int i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 == 0) buf.write(',');
    buf.write(s[i]);
  }
  return buf.toString();
}

/// 3-way payment-method selector (UPI / Bank transfer / Cash).
class _MethodSelector extends StatelessWidget {
  final String selected;
  final ValueChanged<String> onChanged;
  const _MethodSelector({required this.selected, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Container(
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(color: colors.outlineVariant, width: 1),
      ),
      child: Column(
        children: [
          _MethodTile(
            icon: Icons.account_balance_wallet_outlined,
            label: 'UPI',
            subtitle: 'Pay via any UPI app',
            value: 'UPI',
            selected: selected == 'UPI',
            onTap: onChanged,
          ),
          Divider(height: 1, color: colors.outlineVariant),
          _MethodTile(
            icon: Icons.account_balance_outlined,
            label: 'Bank transfer',
            subtitle: 'NEFT / IMPS / RTGS',
            value: 'BANK',
            selected: selected == 'BANK',
            onTap: onChanged,
          ),
          Divider(height: 1, color: colors.outlineVariant),
          _MethodTile(
            icon: Icons.payments_outlined,
            label: 'Cash',
            subtitle: 'Pay at the hub counter',
            value: 'CASH',
            selected: selected == 'CASH',
            onTap: onChanged,
          ),
        ],
      ),
    );
  }
}

class _MethodTile extends StatelessWidget {
  final IconData icon;
  final String label;
  final String subtitle;
  final String value;
  final bool selected;
  final ValueChanged<String> onTap;
  const _MethodTile({
    required this.icon,
    required this.label,
    required this.subtitle,
    required this.value,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return InkWell(
      onTap: () => onTap(value),
      borderRadius: BorderRadius.circular(AppRadius.md),
      child: Padding(
        padding: const EdgeInsets.symmetric(
          horizontal: Spacing.md,
          vertical: Spacing.md,
        ),
        child: Row(
          children: [
            Icon(icon, color: colors.onSurface, size: 22),
            const SizedBox(width: Spacing.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    label,
                    style: AppTypography.titleMedium.copyWith(
                      color: colors.onSurface,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    subtitle,
                    style: AppTypography.bodySmall.copyWith(
                      color: colors.onSurfaceMuted,
                    ),
                  ),
                ],
              ),
            ),
            Icon(
              selected ? Icons.radio_button_checked : Icons.radio_button_off,
              color: selected ? AppColors.primary : colors.onSurfaceMuted,
            ),
          ],
        ),
      ),
    );
  }
}

/// Upload-card for the payment proof. Shows a placeholder when empty,
/// the picked image when selected, a spinner while uploading, and a
/// success check once the server returns a URL.
class _ProofUploadCard extends StatelessWidget {
  final File? imageFile;
  final String? imageUrl;
  final bool isUploading;
  final VoidCallback onTap;
  const _ProofUploadCard({
    required this.imageFile,
    required this.imageUrl,
    required this.isUploading,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final hasFile = imageFile != null;
    final uploaded = imageUrl != null && !isUploading;
    return InkWell(
      onTap: isUploading ? null : onTap,
      borderRadius: BorderRadius.circular(AppRadius.md),
      child: Container(
        width: double.infinity,
        height: 160,
        decoration: BoxDecoration(
          color: colors.card,
          borderRadius: BorderRadius.circular(AppRadius.md),
          border: Border.all(
            color: uploaded ? AppColors.success : colors.outlineVariant,
            width: uploaded ? 1.5 : 1,
          ),
        ),
        child: Stack(
          children: [
            if (hasFile)
              Positioned.fill(
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(AppRadius.md),
                  child: Image.file(
                    imageFile!,
                    fit: BoxFit.cover,
                  ),
                ),
              ),
            if (isUploading)
              Container(
                color: Colors.black54,
                alignment: Alignment.center,
                child: const CircularProgressIndicator(color: Colors.white),
              ),
            if (!hasFile && !isUploading)
              Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      Icons.cloud_upload_outlined,
                      size: 36,
                      color: colors.onSurfaceMuted,
                    ),
                    const SizedBox(height: Spacing.sm),
                    Text(
                      'Tap to upload payment proof',
                      style: AppTypography.bodyMedium.copyWith(
                        color: colors.onSurfaceMuted,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'JPG / PNG, up to 5 MB',
                      style: AppTypography.bodySmall.copyWith(
                        color: colors.onSurfaceMuted,
                        fontSize: 11,
                      ),
                    ),
                  ],
                ),
              ),
            if (uploaded)
              Positioned(
                top: Spacing.sm,
                right: Spacing.sm,
                child: Container(
                  padding: const EdgeInsets.all(4),
                  decoration: const BoxDecoration(
                    color: AppColors.success,
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.check,
                    color: Colors.white,
                    size: 16,
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
