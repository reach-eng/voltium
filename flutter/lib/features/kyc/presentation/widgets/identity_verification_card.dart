import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../../theme/app_theme.dart';
import 'package:voltium_rider/theme/app_typography.dart';
import 'doc_tile.dart';

class IdentityVerificationCard extends StatelessWidget {
  final bool aadhaarFrontUploaded;
  final String? aadhaarFrontPath;
  final bool aadhaarBackUploaded;
  final String? aadhaarBackPath;
  final bool panUploaded;
  final String? panPath;
  final bool bankDetailsDone;
  final VoidCallback onPickAadhaarFront;
  final VoidCallback onPickAadhaarBack;
  final VoidCallback onPickPan;
  final VoidCallback onShowBankDialog;
  final bool aadhaarFrontEnabled;
  final bool aadhaarBackEnabled;
  final bool panEnabled;
  final bool bankEnabled;

  const IdentityVerificationCard({
    super.key,
    required this.aadhaarFrontUploaded,
    this.aadhaarFrontPath,
    required this.aadhaarBackUploaded,
    this.aadhaarBackPath,
    required this.panUploaded,
    this.panPath,
    required this.bankDetailsDone,
    required this.onPickAadhaarFront,
    required this.onPickAadhaarBack,
    required this.onPickPan,
    required this.onShowBankDialog,
    this.aadhaarFrontEnabled = true,
    this.aadhaarBackEnabled = true,
    this.panEnabled = true,
    this.bankEnabled = true,
  });

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: BorderRadius.circular(AppRadius.radiusModal),
        boxShadow: [
          BoxShadow(
            color: colors.onSurface.withValues(alpha: 0.04),
            blurRadius: 24,
            offset: const Offset(0, 8),
          ),
        ],
        border: Border.all(color: colors.surface, width: 1),
      ),
      padding: Spacing.paddingLg,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Identity Verification',
            style: AppTypography.titleSmall
                .copyWith(color: colors.onSurface, letterSpacing: -0.2),
          ),
          SizedBox(height: 4),
          Text(
            'Clear photos only. Max 5MB each.',
            style: GoogleFonts.plusJakartaSans(
                fontSize: 12, color: colors.onSurfaceMuted),
          ),
          const SizedBox(height: 24),
          Row(
            children: [
              Expanded(
                child: DocTile(
                  label: 'Aadhaar Card\n(Front)',
                  icon: Icons.upload_file,
                  isUploaded: aadhaarFrontUploaded,
                  filePath: aadhaarFrontPath,
                  onTap: onPickAadhaarFront,
                  enabled: aadhaarFrontEnabled,
                  key: const Key('aadhaarFrontTile'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: DocTile(
                  label: 'Aadhaar Card\n(Back)',
                  icon: Icons.upload_file,
                  isUploaded: aadhaarBackUploaded,
                  filePath: aadhaarBackPath,
                  onTap: onPickAadhaarBack,
                  enabled: aadhaarBackEnabled,
                  key: const Key('aadhaarBackTile'),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: DocTile(
                  label: 'PAN Card',
                  icon: Icons.upload_file,
                  isUploaded: panUploaded,
                  filePath: panPath,
                  onTap: onPickPan,
                  enabled: panEnabled,
                  key: const Key('panTile'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: DocTile(
                  label: 'Bank Details',
                  icon: Icons.account_balance,
                  isUploaded: bankDetailsDone,
                  onTap: onShowBankDialog,
                  enabled: bankEnabled,
                  key: const Key('bankTile'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
