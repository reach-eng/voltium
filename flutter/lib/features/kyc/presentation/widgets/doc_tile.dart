import 'package:flutter/material.dart';
import '../../../../theme/app_theme.dart';
import 'package:voltium_rider/theme/app_typography.dart';
import 'doc_tile_preview.dart';

class DocTile extends StatelessWidget {
  final String label;
  final IconData icon;
  final bool isUploaded;
  final String? filePath;
  final VoidCallback onTap;
  final bool enabled;

  const DocTile({
    super.key,
    required this.label,
    required this.icon,
    required this.isUploaded,
    this.filePath,
    required this.onTap,
    this.enabled = true,
  });

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);

    final content = Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
      decoration: BoxDecoration(
        color:
            isUploaded ? AppColors.success.withValues(alpha: 0.1) : colors.card,
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(
          color: isUploaded ? AppColors.success : colors.outlineVariant,
          width: 1.5,
        ),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          DocTilePreview(
            isUploaded: isUploaded,
            filePath: filePath,
            icon: icon,
          ),
          const SizedBox(height: 8),
          Text(
            isUploaded ? 'Uploaded' : label,
            textAlign: TextAlign.center,
            style: AppTypography.bodySmall
                .copyWith(fontWeight: FontWeight.w600)
                .copyWith(
                    color: isUploaded
                        ? AppColors.success
                        : colors.onSurfaceVariant),
          ),
        ],
      ),
    );

    return GestureDetector(
      onTap: enabled ? onTap : null,
      child: Opacity(
        opacity: enabled ? 1.0 : 0.5,
        child: content,
      ),
    );
  }
}
