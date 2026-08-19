import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:voltium_rider/services/photo_upload_service.dart';
import 'package:voltium_rider/theme/app_theme.dart';
import 'package:voltium_rider/theme/app_typography.dart';
import 'package:voltium_rider/widgets/photo_upload_sheet.dart';

/// Persistent floating top-bar pill displaying active background uploads status.
class PendingUploadsPill extends ConsumerWidget {
  const PendingUploadsPill({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    ref.watch(photoUploadProvider);
    final notifier = ref.read(photoUploadProvider.notifier);

    if (!notifier.hasActiveUploads && !notifier.hasFailures) {
      return const SizedBox.shrink();
    }

    final pendingCount = notifier.pendingCount;
    final hasFailures = notifier.hasFailures;

    return GestureDetector(
      onTap: () => PhotoUploadSheet.show(context),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: hasFailures ? AppColors.error : AppColors.primaryDark,
          borderRadius: BorderRadius.circular(AppRadius.lg),
          boxShadow: AppShadows.glass,
          border: Border.all(
            color: hasFailures
                ? AppColors.of(context).errorLight
                : AppColors.primary,
            width: 1,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (hasFailures)
              const Icon(Icons.warning_amber_rounded,
                  size: 14, color: Colors.white)
            else
              const SizedBox(
                width: 12,
                height: 12,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: Colors.white,
                ),
              ),
            const SizedBox(width: 6),
            Text(
              hasFailures
                  ? 'Upload error • Tap to retry'
                  : '$pendingCount upload${pendingCount > 1 ? 's' : ''} pending',
              style: AppTypography.labelSmall.copyWith(
                color: Colors.white,
                fontWeight: FontWeight.bold,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
