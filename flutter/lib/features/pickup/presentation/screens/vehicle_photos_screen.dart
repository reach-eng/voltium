import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:voltium_rider/theme/app_theme.dart';

import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/theme/app_typography.dart';
import 'package:voltium_rider/widgets/pending_uploads_pill.dart';

class VehiclePhotosScreen extends ConsumerWidget {
  final VoidCallback? onBack;
  const VehiclePhotosScreen({super.key, this.onBack});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final rider = ref.watch(riderProvider).rider;
    final vehicle = rider?.assignedVehicle ?? 'Not Assigned';
    final pickupPhoto = rider?.pickupPhotoFront;

    final photos = [
      {'label': 'Front View', 'url': pickupPhoto},
      {'label': 'Back View', 'url': rider?.pickupPhotoBack},
      {'label': 'Left Side', 'url': rider?.pickupPhotoLeft},
      {'label': 'Right Side', 'url': rider?.pickupPhotoRight},
      {'label': 'Photo with Vehicle', 'url': rider?.pickupPhotoWithVehicle},
    ];

    final colors = AppColors.of(context);

    return Scaffold(
      backgroundColor: colors.surface,
      body: SafeArea(
        child: Column(
          children: [
            _buildHeader(context),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
                child: Column(
                  children: [
                    _buildVehicleInfoCard(context, vehicle),
                    const SizedBox(height: 20),
                    _buildPhotosGrid(context, photos),
                    const SizedBox(height: 32),
                    _buildBackButton(context),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showZoomModal(BuildContext context, String url, String label) {
    showDialog(
      context: context,
      builder: (ctx) => Dialog.fullscreen(
        backgroundColor: Colors.black,
        child: Stack(
          children: [
            Center(
              child: InteractiveViewer(
                child: Image.network(url, fit: BoxFit.contain, cacheWidth: 800),
              ),
            ),
            Positioned(
              top: 40,
              left: 20,
              child: IconButton(
                icon: const Icon(Icons.close, color: Colors.white, size: 30),
                onPressed: () => Navigator.pop(ctx),
              ),
            ),
            Positioned(
              bottom: 30,
              left: 20,
              right: 20,
              child: Text(
                label,
                textAlign: TextAlign.center,
                style: const TextStyle(
                    color: Colors.white,
                    fontSize: 16,
                    fontWeight: FontWeight.bold),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader(BuildContext context) {
    final colors = AppColors.of(context);
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            children: [
              GestureDetector(
                onTap: () {
                  if (onBack != null) {
                    onBack!();
                  } else if (Navigator.canPop(context)) {
                    Navigator.pop(context);
                  }
                },
                child: Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: colors.card,
                    shape: BoxShape.circle,
                    border: Border.all(color: colors.outlineVariant),
                    boxShadow: AppShadows.glass,
                  ),
                  child: Icon(
                    Icons.arrow_back,
                    size: 18,
                    color: colors.onSurface,
                  ),
                ),
              ),
              const SizedBox(width: 16),
              Text(
                'Vehicle Photos',
                style: AppTypography.titleLarge
                    .copyWith(fontSize: 21)
                    .copyWith(color: colors.onSurface),
              ),
            ],
          ),
          const PendingUploadsPill(),
        ],
      ),
    );
  }

  Widget _buildVehicleInfoCard(BuildContext context, String vehicle) {
    final colors = AppColors.of(context);
    return Container(
      padding: const EdgeInsets.all(Spacing.md),
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        border: Border.all(color: colors.outlineVariant),
        boxShadow: AppShadows.card,
      ),
      child: Row(
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: colors.primarySurface,
              borderRadius: BorderRadius.circular(AppRadius.md),
            ),
            child: const Icon(
              Icons.electric_bike,
              color: AppColors.primary,
              size: 24,
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'ASSIGNED VEHICLE',
                  style: AppTypography.labelMedium.copyWith(
                      color: colors.onSurfaceVariant, letterSpacing: 1.0),
                ),
                const SizedBox(height: 4),
                Text(
                  vehicle,
                  style: AppTypography.titleSmall
                      .copyWith(color: colors.onSurface),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPhotosGrid(
      BuildContext context, List<Map<String, dynamic>> photos) {
    final colors = AppColors.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'PICKUP PHOTOS',
          style: AppTypography.bodySmall
              .copyWith(fontWeight: FontWeight.w800)
              .copyWith(color: colors.onSurface, letterSpacing: 1.2),
        ),
        const SizedBox(height: 12),
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 2,
            crossAxisSpacing: 12,
            mainAxisSpacing: 12,
            childAspectRatio: 1.2,
          ),
          itemCount: photos.length,
          itemBuilder: (ctx, index) {
            final photo = photos[index];
            final url = photo['url'] as String?;
            final label = photo['label'] as String;
            return GestureDetector(
              onTap: (url != null && url.isNotEmpty)
                  ? () => _showZoomModal(context, url, label)
                  : null,
              child: Container(
                decoration: BoxDecoration(
                  color: colors.card,
                  borderRadius: BorderRadius.circular(AppRadius.lg),
                  border: Border.all(color: colors.outlineVariant),
                  image: url != null && url.isNotEmpty
                      ? DecorationImage(
                          image: ResizeImage(
                            NetworkImage(url),
                            width: 400,
                            height: 300,
                          ),
                          fit: BoxFit.cover,
                        )
                      : null,
                ),
                child: url == null || url.isEmpty
                    ? Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(
                            Icons.camera_alt_outlined,
                            color: colors.onSurfaceMuted,
                            size: 32,
                          ),
                          const SizedBox(height: 8),
                          Text(
                            label,
                            style: AppTypography.bodySmall
                                .copyWith(fontWeight: FontWeight.w600)
                                .copyWith(color: colors.onSurfaceVariant),
                          ),
                        ],
                      )
                    : Align(
                        alignment: Alignment.bottomRight,
                        child: GestureDetector(
                          onTap: () => _showZoomModal(context, url, label),
                          child: Container(
                            margin: Spacing.paddingSm,
                            padding: const EdgeInsets.all(6),
                            decoration: const BoxDecoration(
                              color: Colors.black54,
                              shape: BoxShape.circle,
                            ),
                            child: const Icon(
                              Icons.zoom_in,
                              color: Colors.white,
                              size: 18,
                            ),
                          ),
                        ),
                      ),
              ),
            );
          },
        ),
      ],
    );
  }

  Widget _buildBackButton(BuildContext context) {
    return GestureDetector(
      key: const Key('backButton'),
      onTap: () => Navigator.maybePop(context),
      child: Container(
        height: 52,
        width: double.infinity,
        decoration: BoxDecoration(
          gradient: AppGradients.primary,
          borderRadius: BorderRadius.circular(AppRadius.full),
          boxShadow: AppShadows.primaryButton,
        ),
        child: Center(
          child: Text(
            'Back to Dashboard',
            style: AppTypography.labelLarge
                .copyWith(fontWeight: FontWeight.w700)
                .copyWith(color: Colors.white),
          ),
        ),
      ),
    );
  }
}
