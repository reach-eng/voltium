import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:voltium_rider/theme/app_theme.dart';
import 'package:voltium_rider/theme/app_typography.dart';

class ImageSourceBottomSheet {
  /// Shows a modal bottom sheet to select between Camera and Gallery.
  /// Returns [ImageSource.camera], [ImageSource.gallery], or null if dismissed.
  static Future<ImageSource?> show({required BuildContext context}) async {
    return showModalBottomSheet<ImageSource>(
      context: context,
      showDragHandle: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      builder: (context) {
        final colors = AppColors.of(context);
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                ListTile(
                  leading: const Icon(Icons.photo_camera_outlined,
                      color: AppColors.primary),
                  title: Text(
                    'Take Photo',
                    style: AppTypography.bodyLarge
                        .copyWith(color: colors.onSurface),
                  ),
                  onTap: () {
                    Navigator.pop(context, ImageSource.camera);
                  },
                ),
                ListTile(
                  leading: const Icon(Icons.photo_library_outlined,
                      color: AppColors.primary),
                  title: Text(
                    'Choose from Gallery',
                    style: AppTypography.bodyLarge
                        .copyWith(color: colors.onSurface),
                  ),
                  onTap: () {
                    Navigator.pop(context, ImageSource.gallery);
                  },
                ),
                Divider(color: colors.divider, height: 16),
                ListTile(
                  leading: Icon(Icons.close, color: colors.onSurfaceMuted),
                  title: Text(
                    'Cancel',
                    style: AppTypography.bodyLarge
                        .copyWith(color: colors.onSurfaceMuted),
                  ),
                  onTap: () {
                    Navigator.pop(context, null);
                  },
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}
