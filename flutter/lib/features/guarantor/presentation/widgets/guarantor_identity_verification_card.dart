import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../../theme/app_theme.dart';
import 'package:voltium_rider/features/kyc/presentation/widgets/user_onboarding_widgets.dart'
    show DocTile;
import 'package:voltium_rider/theme/app_typography.dart';

class GuarantorIdentityVerificationCard extends StatelessWidget {
  final bool aadhaarFrontUploaded;
  final bool aadhaarBackUploaded;
  final bool panUploaded;
  final bool photoUploaded;
  final VoidCallback onPickAadhaarFront;
  final VoidCallback onPickAadhaarBack;
  final VoidCallback onPickPan;
  final VoidCallback onPickPhoto;

  const GuarantorIdentityVerificationCard({
    super.key,
    required this.aadhaarFrontUploaded,
    required this.aadhaarBackUploaded,
    required this.panUploaded,
    required this.photoUploaded,
    required this.onPickAadhaarFront,
    required this.onPickAadhaarBack,
    required this.onPickPan,
    required this.onPickPhoto,
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
            'DOCUMENTS UPLOAD',
            style: AppTypography.bodySmall
                .copyWith(fontWeight: FontWeight.w800)
                .copyWith(color: colors.onSurfaceMuted, letterSpacing: 1.5),
          ),
          SizedBox(height: 4),
          Text(
            'Clear photos only. Max 5MB each.',
            style: GoogleFonts.plusJakartaSans(
              fontSize: 12,
              color: colors.onSurfaceMuted,
            ),
          ),
          const SizedBox(height: 24),
          Row(
            children: [
              Expanded(
                child: DocTile(
                  label: 'Aadhaar Card\n(Front)',
                  icon: Icons.upload_file,
                  isUploaded: aadhaarFrontUploaded,
                  onTap: onPickAadhaarFront,
                  key: const Key('guarantorAadhaarFrontTile'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: DocTile(
                  label: 'Aadhaar Card\n(Back)',
                  icon: Icons.upload_file,
                  isUploaded: aadhaarBackUploaded,
                  onTap: onPickAadhaarBack,
                  key: const Key('guarantorAadhaarBackTile'),
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
                  onTap: onPickPan,
                  key: const Key('guarantorPanTile'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: DocTile(
                  label: 'Guarantor Photo',
                  icon: Icons.face,
                  isUploaded: photoUploaded,
                  onTap: onPickPhoto,
                  key: const Key('guarantorPhotoTile'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
