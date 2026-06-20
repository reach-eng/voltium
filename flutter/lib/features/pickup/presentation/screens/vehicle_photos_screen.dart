import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'package:voltium_rider/providers/app_provider.dart';
import 'package:voltium_rider/theme/app_theme.dart';

class VehiclePhotosScreen extends StatelessWidget {
  const VehiclePhotosScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final rider = context.watch<AppProvider>().rider;
    final vehicle = rider?.assignedVehicle ?? 'Not Assigned';
    final pickupPhoto = rider?.pickupPhotoFront;

    final photos = [
      {'label': 'Front View', 'url': pickupPhoto},
      {'label': 'Left Side', 'url': rider?.pickupPhotoLeft},
      {'label': 'Right Side', 'url': rider?.pickupPhotoRight},
      {'label': 'Speedometer', 'url': rider?.pickupPhotoWithVehicle},
    ];

    return Scaffold(
      backgroundColor: AppColors.surface,
      body: SafeArea(
        child: Column(
          children: [
            _buildHeader(context),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
                child: Column(
                  children: [
                    _buildVehicleInfoCard(vehicle),
                    const SizedBox(height: 20),
                    _buildPhotosGrid(photos),
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

  Widget _buildHeader(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
      child: Row(
        children: [
          GestureDetector(
            onTap: () => Navigator.maybePop(context),
            child: Container(
              width: 40,
              height: 40,
              decoration: const BoxDecoration(
                color: Colors.white,
                shape: BoxShape.circle,
                boxShadow: AppShadows.glass,
              ),
              child: const Icon(Icons.arrow_back,
                  size: 18, color: AppColors.onSurface,),
            ),
          ),
          const SizedBox(width: 16),
          Text('Vehicle Photos',
            style: GoogleFonts.inter(
              fontSize: 21,
              fontWeight: FontWeight.w700,
              color: AppColors.onSurface,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildVehicleInfoCard(String vehicle) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        boxShadow: AppShadows.card,
      ),
      child: Row(
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: const Color(0xFFEFF6FF),
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Icon(Icons.electric_bike,
                color: AppColors.primary, size: 24,),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('ASSIGNED VEHICLE',
                  style: GoogleFonts.inter(
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    color: AppColors.onSurfaceVariant,
                    letterSpacing: 1.0,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  vehicle,
                  style: GoogleFonts.inter(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: AppColors.onSurface,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPhotosGrid(List<Map<String, dynamic>> photos) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('PICKUP PHOTOS',
          style: GoogleFonts.inter(
            fontSize: 11,
            fontWeight: FontWeight.w800,
            color: AppColors.onSurface,
            letterSpacing: 1.2,
          ),
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
          itemBuilder: (context, index) {
            final photo = photos[index];
            final url = photo['url'] as String?;
            return Container(
              decoration: BoxDecoration(
                color: AppColors.iconBackground,
                borderRadius: BorderRadius.circular(16),
                image: url != null && url.isNotEmpty
                    ? DecorationImage(
                        image: ResizeImage(NetworkImage(url),
                            width: 400, height: 300,),
                        fit: BoxFit.cover,
                      )
                    : null,
              ),
              child: url == null || url.isEmpty
                  ? Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.camera_alt_outlined,
                            color: AppColors.onSurfaceVariant, size: 32,),
                        const SizedBox(height: 8),
                        Text(
                          photo['label'],
                          style: GoogleFonts.inter(
                            fontSize: 12,
                            color: AppColors.onSurfaceVariant,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    )
                  : Align(
                      alignment: Alignment.bottomRight,
                      child: Container(
                        margin: const EdgeInsets.all(8),
                        padding: const EdgeInsets.all(4),
                        decoration: const BoxDecoration(
                          color: Colors.black54,
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(Icons.zoom_in,
                            color: Colors.white, size: 16,),
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
          borderRadius: BorderRadius.circular(999),
          boxShadow: AppShadows.primaryButton,
        ),
        child: const Center(
          child: Text('Back to Dashboard',
            style: TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w700,
              color: Colors.white,
            ),
          ),
        ),
      ),
    );
  }
}
