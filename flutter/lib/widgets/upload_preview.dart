import 'package:flutter/material.dart';
import 'package:universal_io/io.dart';
import '../theme/app_theme.dart';
import 'package:voltium_rider/theme/app_typography.dart';

class UploadPreview extends StatelessWidget {
  final String? filePath;
  final String label;
  final VoidCallback? onTap;
  final VoidCallback? onRemove;
  final bool isLoading;
  final double progress;

  const UploadPreview({
    super.key,
    this.filePath,
    required this.label,
    this.onTap,
    this.onRemove,
    this.isLoading = false,
    this.progress = 0.0,
  });

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final hasFile = filePath != null && filePath!.isNotEmpty;

    return GestureDetector(
      onTap: onTap,
      child: Container(
        height: 100,
        decoration: BoxDecoration(
          color: colors.card,
          borderRadius: BorderRadius.circular(AppRadius.md),
          border: Border.all(
            color: hasFile ? AppColors.success : colors.outlineVariant,
          ),
        ),
        child: Stack(
          children: [
            if (isLoading)
              Positioned.fill(
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(AppRadius.md),
                  child: LinearProgressIndicator(
                    value: progress,
                    backgroundColor: AppColors.outlineVariant,
                    valueColor: const AlwaysStoppedAnimation<Color>(
                      AppColors.primary,
                    ),
                  ),
                ),
              ),
            Center(
              child: hasFile
                  ? Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Container(
                          width: 50,
                          height: 50,
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(AppRadius.sm),
                            image: DecorationImage(
                              image: FileImage(
                                File(
                                  filePath!.startsWith('/')
                                      ? filePath!
                                      : filePath!,
                                ),
                              ),
                              fit: BoxFit.cover,
                            ),
                          ),
                        ),
                        SizedBox(height: 4),
                        Text(
                          label,
                          style: AppTypography.labelSmall
                              .copyWith(fontSize: 10)
                              .copyWith(color: AppColors.success),
                        ),
                      ],
                    )
                  : Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          isLoading ? Icons.upload : Icons.add_photo_alternate,
                          color: AppColors.of(context).onSurfaceMuted,
                          size: 28,
                        ),
                        SizedBox(height: 4),
                        Text(
                          label,
                          style: AppTypography.labelSmall
                              .copyWith(fontSize: 10)
                              .copyWith(color: AppColors.onSurfaceVariant),
                        ),
                      ],
                    ),
            ),
            if (hasFile && onRemove != null)
              Positioned(
                top: 4,
                right: 4,
                child: GestureDetector(
                  onTap: onRemove,
                  child: Container(
                    padding: Spacing.paddingXs,
                    decoration: const BoxDecoration(
                      color: AppColors.error,
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.close,
                      color: Colors.white,
                      size: 12,
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class FilePreview extends StatelessWidget {
  final String filePath;
  final double? width;
  final double? height;
  final VoidCallback? onTap;
  final VoidCallback? onRemove;

  const FilePreview({
    super.key,
    required this.filePath,
    this.width,
    this.height,
    this.onTap,
    this.onRemove,
  });

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        Container(
          width: width ?? 80,
          height: height ?? 80,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(AppRadius.sm),
            image: DecorationImage(
              image: FileImage(
                File(filePath.startsWith('/') ? filePath : filePath),
              ),
              fit: BoxFit.cover,
            ),
          ),
        ),
        if (onRemove != null)
          Positioned(
            top: -4,
            right: -4,
            child: GestureDetector(
              onTap: onRemove,
              child: Container(
                padding: Spacing.paddingXs,
                decoration: const BoxDecoration(
                  color: AppColors.error,
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.close,
                  color: Colors.white,
                  size: 12,
                ),
              ),
            ),
          ),
      ],
    );
  }
}
