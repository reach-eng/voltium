import 'package:universal_io/io.dart';
import 'package:flutter/material.dart';
import 'package:voltium_rider/gen/app_localizations.dart';
import '../../../../theme/app_theme.dart';
import 'package:voltium_rider/theme/app_typography.dart';
import 'doc_tile_preview.dart';

class DocTile extends StatelessWidget {
  final String label;
  final IconData icon;
  final bool isUploaded;
  final String? filePath;
  final String? customUploadedLabel;
  final VoidCallback onTap;
  final bool enabled;

  const DocTile({
    super.key,
    required this.label,
    required this.icon,
    required this.isUploaded,
    this.filePath,
    this.customUploadedLabel,
    required this.onTap,
    this.enabled = true,
  });

  void _handleTap(BuildContext context) {
    if (!enabled) return;
    if (isUploaded &&
        filePath != null &&
        filePath!.isNotEmpty &&
        File(filePath!).existsSync()) {
      _showDocumentPreviewModal(context);
    } else {
      onTap();
    }
  }

  void _showDocumentPreviewModal(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final colors = AppColors.of(context);
    showDialog(
      context: context,
      barrierDismissible: true,
      builder: (ctx) {
        return Dialog(
          backgroundColor: colors.surface,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadius.lg),
          ),
          insetPadding:
              const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      label.replaceAll('\n', ' '),
                      style: AppTypography.titleSmall.copyWith(
                        color: colors.onSurface,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close, size: 20),
                      onPressed: () => Navigator.pop(ctx),
                      color: colors.onSurfaceMuted,
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                ClipRRect(
                  borderRadius: BorderRadius.circular(AppRadius.md),
                  child: Container(
                    constraints: const BoxConstraints(maxHeight: 360),
                    color: Colors.black,
                    child: InteractiveViewer(
                      minScale: 0.8,
                      maxScale: 3.0,
                      child: Image.file(
                        File(filePath!),
                        fit: BoxFit.contain,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: () {
                          Navigator.pop(ctx);
                          onTap(); // Trigger retake
                        },
                        style: OutlinedButton.styleFrom(
                          foregroundColor: AppColors.primary,
                          side: const BorderSide(color: AppColors.primary),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(AppRadius.md),
                          ),
                        ),
                        child: Text(l10n?.txtretakePhoto ?? 'Retake Photo'),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: ElevatedButton(
                        onPressed: () => Navigator.pop(ctx),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.primary,
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(AppRadius.md),
                          ),
                        ),
                        child: Text(l10n?.txtkeepPhoto ?? 'Keep Photo'),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final l10n = AppLocalizations.of(context);
    final uploadedText = customUploadedLabel ?? l10n?.txtuploaded ?? 'Uploaded';

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
            isUploaded ? uploadedText : label,
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
      onTap: () => _handleTap(context),
      child: Opacity(
        opacity: enabled ? 1.0 : 0.5,
        child: content,
      ),
    );
  }
}
