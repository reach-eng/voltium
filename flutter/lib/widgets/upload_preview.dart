import 'package:flutter/material.dart';
import 'dart:io';
import '../theme/app_theme.dart';

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
    final hasFile = filePath != null && filePath!.isNotEmpty;

    return GestureDetector(
      onTap: onTap,
      child: Container(
        height: 100,
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: hasFile ? const Color(0xFF16A34A) : AppColors.outlineVariant,
          ),
        ),
        child: Stack(
          children: [
            if (isLoading)
              Positioned.fill(
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(11),
                  child: LinearProgressIndicator(
                    value: progress,
                    backgroundColor: Colors.grey[200],
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
                            borderRadius: BorderRadius.circular(8),
                            image: DecorationImage(
                              image: FileImage(
                                File(filePath!.startsWith('/')
                                    ? filePath!
                                    : filePath!,),
                              ),
                              fit: BoxFit.cover,
                            ),
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          label,
                          style: const TextStyle(
                            fontSize: 10,
                            color: Color(0xFF16A34A),
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    )
                  : Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          isLoading ? Icons.upload : Icons.add_photo_alternate,
                          color: const Color(0xFF667085),
                          size: 28,
                        ),
                        const SizedBox(height: 4),
                        Text(
                          label,
                          style: const TextStyle(
                            fontSize: 10,
                            color: AppColors.onSurfaceVariant,
                            fontWeight: FontWeight.w600,
                          ),
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
                    padding: const EdgeInsets.all(4),
                    decoration: const BoxDecoration(
                      color: Colors.red,
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
            borderRadius: BorderRadius.circular(8),
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
                padding: const EdgeInsets.all(4),
                decoration: const BoxDecoration(
                  color: Colors.red,
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
