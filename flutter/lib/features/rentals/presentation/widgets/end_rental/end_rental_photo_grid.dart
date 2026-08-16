import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:image_picker/image_picker.dart';
import 'package:universal_io/io.dart';
import 'package:voltium_rider/theme/app_theme.dart';

class EndRentalPhotoGrid extends StatelessWidget {
  final Map<String, XFile?> photos;
  final Function(String key) onTakePhoto;
  final Function(String key, String label) onOptionsDialog;

  const EndRentalPhotoGrid({
    super.key,
    required this.photos,
    required this.onTakePhoto,
    required this.onOptionsDialog,
  });

  Widget _buildPhotoSlot({
    required BuildContext context,
    required String photoKey,
    required String label,
    required IconData icon,
  }) {
    final photo = photos[photoKey];
    final hasPhoto = photo != null;

    return GestureDetector(
      key: Key('photoSlot_$photoKey'),
      onTap: () {
        if (hasPhoto) {
          onOptionsDialog(photoKey, label);
        } else {
          onTakePhoto(photoKey);
        }
      },
      child: Container(
        height: 110,
        decoration: BoxDecoration(
          color: hasPhoto ? Colors.black : AppColors.of(context).surfaceBright,
          borderRadius: BorderRadius.circular(AppRadius.md),
          border: Border.all(
            color: hasPhoto
                ? AppColors.success
                : AppColors.of(context).borderSubtle,
            width: hasPhoto ? 2 : 1.5,
          ),
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(AppRadius.md - 2),
          child: Stack(
            fit: StackFit.expand,
            children: [
              if (hasPhoto && photo.path != 'mock_photo.png')
                Image.file(
                  File(photo.path),
                  fit: BoxFit.cover,
                )
              else if (hasPhoto && photo.path == 'mock_photo.png')
                Container(
                  color: AppColors.of(context).successLight,
                  child: const Center(
                    child: Icon(
                      Icons.check_circle_rounded,
                      color: AppColors.successDark,
                      size: 32,
                    ),
                  ),
                )
              else
                Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(
                      icon,
                      size: 28,
                      color: AppColors.slate400,
                    ),
                    const SizedBox(height: 6),
                    Text(
                      label,
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: AppColors.slate600,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'Tap to capture',
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 10,
                        color: AppColors.slate400,
                      ),
                    ),
                  ],
                ),
              if (hasPhoto)
                Positioned(
                  top: 6,
                  right: 6,
                  child: Container(
                    padding: const EdgeInsets.all(Spacing.xs),
                    decoration: const BoxDecoration(
                      color: AppColors.success,
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.check,
                      size: 12,
                      color: Colors.white,
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Row(
          children: [
            Expanded(
              child: _buildPhotoSlot(
                context: context,
                photoKey: 'front',
                label: 'Front View',
                icon: Icons.two_wheeler_rounded,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _buildPhotoSlot(
                context: context,
                photoKey: 'left',
                label: 'Left Side',
                icon: Icons.turn_left_rounded,
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: _buildPhotoSlot(
                context: context,
                photoKey: 'right',
                label: 'Right Side',
                icon: Icons.turn_right_rounded,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _buildPhotoSlot(
                context: context,
                photoKey: 'speedometer',
                label: 'Speedometer',
                icon: Icons.speed_rounded,
              ),
            ),
          ],
        ),
      ],
    );
  }
}
