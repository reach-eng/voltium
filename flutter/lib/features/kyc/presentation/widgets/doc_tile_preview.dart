import 'package:universal_io/io.dart';
import 'package:flutter/material.dart';
import 'package:voltium_rider/theme/app_theme.dart';

class DocTilePreview extends StatelessWidget {
  final bool isUploaded;
  final String? filePath;
  final IconData icon;

  const DocTilePreview({
    super.key,
    required this.isUploaded,
    this.filePath,
    required this.icon,
  });

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final hasLocalImage = isUploaded &&
        filePath != null &&
        filePath!.isNotEmpty &&
        File(filePath!).existsSync();

    if (hasLocalImage) {
      return ClipRRect(
        borderRadius: BorderRadius.circular(AppRadius.sm),
        child: Image.file(
          File(filePath!),
          height: 48,
          width: double.infinity,
          fit: BoxFit.cover,
        ),
      );
    }

    return Container(
      padding: Spacing.paddingSm,
      decoration: BoxDecoration(
        color: isUploaded
            ? AppColors.success.withValues(alpha: 0.2)
            : colors.iconBackground,
        borderRadius: BorderRadius.circular(AppRadius.sm),
      ),
      child: Icon(
        isUploaded ? Icons.check_circle : icon,
        color: isUploaded ? AppColors.success : colors.onSurfaceMuted,
        size: 20,
      ),
    );
  }
}
