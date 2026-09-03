import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:voltium_rider/services/photo_upload_service.dart';
import 'package:voltium_rider/theme/app_theme.dart';
import 'package:voltium_rider/theme/app_typography.dart';

/// Modal bottom sheet displaying real-time parallel photo upload progress tiles.
class PhotoUploadSheet extends ConsumerWidget {
  final VoidCallback? onAllCompleted;

  const PhotoUploadSheet({
    super.key,
    this.onAllCompleted,
  });

  static Future<void> show(BuildContext context,
      {VoidCallback? onAllCompleted}) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => PhotoUploadSheet(onAllCompleted: onAllCompleted),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tasks = ref.watch(photoUploadProvider);
    final notifier = ref.read(photoUploadProvider.notifier);

    final totalCount = tasks.length;
    final completedCount = notifier.completedCount;
    final isAllDone = notifier.isAllCompleted;
    final hasFailures = notifier.hasFailures;

    if (isAllDone && onAllCompleted != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        onAllCompleted!();
      });
    }

    return Container(
      decoration: BoxDecoration(
        color: AppColors.of(context).surface,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
      ),
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Center(
            child: Container(
              width: 36,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.white24,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          const SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'PHOTO UPLOADS',
                    style: AppTypography.labelMedium.copyWith(
                      color: AppColors.primary,
                      letterSpacing: 1.2,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    isAllDone
                        ? 'All $totalCount photos uploaded successfully'
                        : 'Uploading $completedCount of $totalCount photos...',
                    style: AppTypography.headingSmall
                        .copyWith(color: Colors.white),
                  ),
                ],
              ),
              IconButton(
                tooltip: 'Close',
                icon: const Icon(Icons.close_rounded, color: Colors.white70),
                onPressed: () => Navigator.pop(context),
              ),
            ],
          ),
          const SizedBox(height: 20),
          if (tasks.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 24),
              child: Center(
                child: Text(
                  'No active photo uploads',
                  style:
                      AppTypography.bodyMedium.copyWith(color: Colors.white54),
                ),
              ),
            )
          else
            GridView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                crossAxisSpacing: 12,
                mainAxisSpacing: 12,
                childAspectRatio: 1.2,
              ),
              itemCount: tasks.length,
              itemBuilder: (context, index) {
                final task = tasks[index];
                return _UploadTile(
                  task: task,
                  onRetry: () => notifier.retryTask(task.id),
                );
              },
            ),
          const SizedBox(height: 24),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: () => Navigator.pop(context),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: Colors.white,
                    side: const BorderSide(color: Colors.white24),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                  ),
                  child: Text(
                    isAllDone ? 'Close' : 'Dismiss to Background',
                    style: AppTypography.labelLarge,
                  ),
                ),
              ),
              if (hasFailures) ...[
                const SizedBox(width: 12),
                Expanded(
                  child: ElevatedButton(
                    onPressed: () {
                      for (final t in tasks) {
                        if (t.status == PhotoUploadStatus.failed) {
                          notifier.retryTask(t.id);
                        }
                      }
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                    ),
                    child: Text(
                      'Retry Failed',
                      style: AppTypography.labelLarge
                          .copyWith(fontWeight: FontWeight.bold),
                    ),
                  ),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }
}

class _UploadTile extends StatelessWidget {
  final PhotoUploadTask task;
  final VoidCallback onRetry;

  const _UploadTile({
    required this.task,
    required this.onRetry,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.05),
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(
          color: task.status == PhotoUploadStatus.failed
              ? AppColors.error
              : task.status == PhotoUploadStatus.completed
                  ? AppColors.success
                  : Colors.white12,
        ),
      ),
      clipBehavior: Clip.antiAlias,
      child: Stack(
        fit: StackFit.expand,
        children: [
          Image.file(
            task.file,
            fit: BoxFit.cover,
            errorBuilder: (_, __, ___) => const Center(
              child: Icon(Icons.broken_image_rounded, color: Colors.white38),
            ),
          ),
          Container(
            color: Colors.black.withValues(alpha: 0.4),
          ),
          Padding(
            padding: const EdgeInsets.all(8),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  task.label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppTypography.labelSmall.copyWith(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                Center(
                  child: _buildStatusOverlay(),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatusOverlay() {
    switch (task.status) {
      case PhotoUploadStatus.queued:
        return Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          decoration: BoxDecoration(
            color: Colors.black54,
            borderRadius: BorderRadius.circular(AppRadius.sm),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.schedule, size: 14, color: Colors.white70),
              const SizedBox(width: 4),
              Text(
                'Queued',
                style: AppTypography.labelSmall.copyWith(color: Colors.white70),
              ),
            ],
          ),
        );
      case PhotoUploadStatus.processing:
      case PhotoUploadStatus.uploading:
        return SizedBox(
          width: 32,
          height: 32,
          child: CircularProgressIndicator(
            value: task.progress > 0.1 ? task.progress : null,
            strokeWidth: 3,
            color: AppColors.primary,
            backgroundColor: Colors.white24,
          ),
        );
      case PhotoUploadStatus.completed:
        return Container(
          padding: const EdgeInsets.all(6),
          decoration: const BoxDecoration(
            color: AppColors.success,
            shape: BoxShape.circle,
          ),
          child: const Icon(Icons.check_rounded, size: 20, color: Colors.white),
        );
      case PhotoUploadStatus.failed:
        return GestureDetector(
          onTap: onRetry,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: AppColors.error,
              borderRadius: BorderRadius.circular(AppRadius.sm),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.refresh_rounded,
                    size: 14, color: Colors.white),
                const SizedBox(width: 4),
                Text(
                  'Retry',
                  style: AppTypography.labelSmall.copyWith(color: Colors.white),
                ),
              ],
            ),
          ),
        );
    }
  }
}
