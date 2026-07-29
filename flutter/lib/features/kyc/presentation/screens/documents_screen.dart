import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:voltium_rider/config/app_config.dart';
import 'package:voltium_rider/widgets/fade_up_widget.dart';
import 'package:voltium_rider/features/support/presentation/screens/support_center_screen.dart';
import 'package:voltium_rider/utils/app_navigator.dart';
import 'package:voltium_rider/services/document_local_cache.dart';
import 'package:universal_io/io.dart';
import '../../../../theme/app_theme.dart';

import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/theme/app_typography.dart';

class MyDocumentsScreen extends ConsumerWidget {
  const MyDocumentsScreen({super.key});

  Future<void> _viewDocument(BuildContext context, String? url,
      {String? cacheKey}) async {
    if (url == null || url.isEmpty) return;

    // Prefer local cached file if available (from onboarding upload).
    if (cacheKey != null) {
      final localPath = await DocumentLocalCache.get(cacheKey);
      if (localPath != null && File(localPath).existsSync()) {
        final uri = Uri.file(localPath);
        if (await canLaunchUrl(uri)) {
          await launchUrl(uri, mode: LaunchMode.externalApplication);
          return;
        }
      }
    }

    // Fallback to network download.
    String fullUrl = url;
    if (!url.startsWith('http')) {
      final baseUrl = AppConfig.apiBaseUrl;
      final path = url.startsWith('/') ? url.substring(1) : url;
      fullUrl = '$baseUrl/api/files/$path';
    }
    final uri = Uri.parse(fullUrl);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    } else {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Unable to open document')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      backgroundColor: AppColors.iconBackground, // mesh-gradient equivalent bg
      appBar: AppBar(
        backgroundColor: AppColors.iconBackground,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        leadingWidth: 68,
        leading: Padding(
          padding: const EdgeInsets.only(left: 20.0),
          child: UnconstrainedBox(
            child: Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: Colors.white,
                shape: BoxShape.circle,
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.05),
                    blurRadius: 10,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Material(
                color: Colors.transparent,
                child: InkWell(
                  borderRadius: BorderRadius.circular(AppRadius.lg),
                  onTap: () => Navigator.pop(context),
                  child: const Icon(
                    Icons.arrow_back,
                    color: AppColors.slate800,
                    size: 18,
                  ),
                ),
              ),
            ),
          ),
        ),
        title: Text(
          'My Documents',
          style: AppTypography.titleLarge.copyWith(color: AppColors.slate800),
        ),
        centerTitle: false,
      ),
      body: Consumer(
        builder: (context, ref, child) {
          final rider = ref.watch(riderProvider).rider;
          return ListView(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
            children: [
              FadeUpWidget(
                delay: 0,
                child: _buildVerificationStatusCard(
                  rider?.kycStatus.name ?? 'PENDING',
                ),
              ),
              const SizedBox(height: 24),
              FadeUpWidget(
                delay: 100,
                child: _buildCategoryHeader(
                  'YOUR DOCUMENTS',
                  _countDocs([
                    rider?.aadhaarFront,
                    rider?.aadhaarBack,
                    rider?.panCard,
                    rider?.signature,
                  ]),
                ),
              ),
              const SizedBox(height: 12),
              _buildDocList(
                context,
                [
                  _DocModel(
                    label: 'Aadhaar Card (Front)',
                    url: rider?.aadhaarFront,
                    icon: Icons.description_outlined,
                    cacheKey: 'aadhaarFront',
                  ),
                  _DocModel(
                    label: 'Aadhaar Card (Back)',
                    url: rider?.aadhaarBack,
                    icon: Icons.description_outlined,
                    cacheKey: 'aadhaarBack',
                  ),
                  _DocModel(
                    label: 'PAN Card',
                    url: rider?.panCard,
                    icon: Icons.badge_outlined,
                    cacheKey: 'panCard',
                  ),
                  _DocModel(
                    label: 'Digital Signature',
                    url: rider?.signature,
                    icon: Icons.gesture_outlined,
                    cacheKey: 'signature',
                  ),
                ],
                150,
              ),
              const SizedBox(height: 32),
              FadeUpWidget(
                delay: 400,
                child: _buildCategoryHeader(
                  "GUARANTOR'S DOCUMENTS",
                  _countDocs([
                    rider?.guarantorAadhaarFront,
                    rider?.guarantorAadhaarBack,
                    rider?.guarantorPan,
                    rider?.guarantorVideo,
                    rider?.guarantorSignature,
                  ]),
                ),
              ),
              const SizedBox(height: 12),
              _buildDocList(
                context,
                [
                  _DocModel(
                    label: "Guarantor's Aadhaar (Front)",
                    url: rider?.guarantorAadhaarFront,
                    icon: Icons.shield_outlined,
                    cacheKey: 'guarantorAadhaarFront',
                  ),
                  _DocModel(
                    label: "Guarantor's Aadhaar (Back)",
                    url: rider?.guarantorAadhaarBack,
                    icon: Icons.shield_outlined,
                    cacheKey: 'guarantorAadhaarBack',
                  ),
                  _DocModel(
                    label: "Guarantor's PAN Card",
                    url: rider?.guarantorPan,
                    icon: Icons.contact_mail_outlined,
                    cacheKey: 'guarantorPan',
                  ),
                  _DocModel(
                    label: "Verification Video",
                    url: rider?.guarantorVideo,
                    icon: Icons.videocam_outlined,
                    isVideo: true,
                    cacheKey: 'guarantorVideo',
                  ),
                  _DocModel(
                    label: "Guarantor's Signature",
                    url: rider?.guarantorSignature,
                    icon: Icons.gesture_outlined,
                    cacheKey: 'guarantorSignature',
                  ),
                ],
                450,
              ),
              const SizedBox(height: 32),
              FadeUpWidget(
                delay: 700,
                child: _buildSupportBanner(context),
              ),
              const SizedBox(height: 48),
            ],
          );
        },
      ),
    );
  }

  int _countDocs(List<String?> urls) {
    return urls.where((u) => u != null && u.isNotEmpty).length;
  }

  Widget _buildVerificationStatusCard(String status) {
    final bool isApproved = status.toUpperCase() == 'APPROVED' ||
        status.toUpperCase() == 'VERIFIED';
    return Container(
      padding: const EdgeInsets.all(Spacing.md),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(AppRadius.xl),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 48,
            offset: const Offset(0, 24),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Container(
                    height: 40,
                    width: 40,
                    decoration: const BoxDecoration(
                      color: AppColors.successSurfaceAlt,
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.shield_outlined,
                      color: AppColors.success,
                      size: 20,
                    ),
                  ),
                  SizedBox(width: 12),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'SECURITY PROFILE',
                        style: AppTypography.bodySmallTracked.copyWith(
                            color: AppColors.successText, letterSpacing: 1.2),
                      ),
                      SizedBox(height: 2),
                      Text(
                        'Verified & Secure',
                        style: AppTypography.bodyMediumEmphasis
                            .copyWith(color: AppColors.slate800),
                      ),
                    ],
                  ),
                ],
              ),
              Container(
                height: 4,
                width: 60,
                decoration: BoxDecoration(
                  color: AppColors.successSurfaceAlt,
                  borderRadius: BorderRadius.circular(2),
                ),
                child: FractionallySizedBox(
                  alignment: Alignment.centerLeft,
                  widthFactor: isApproved ? 1.0 : 0.6,
                  child: Container(
                    decoration: BoxDecoration(
                      color: AppColors.success,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
              ),
            ],
          ),
          SizedBox(height: 16),
          Text(
            isApproved
                ? 'Your identity and guarantor information have been verified. You can view or download copies of your documents below.'
                : 'Your verification is in progress. Some documents may still be under review by our safety team.',
            style: AppTypography.bodySmall
                .copyWith(color: AppColors.slate500, height: 1.5),
          ),
        ],
      ),
    );
  }

  Widget _buildCategoryHeader(String title, int count) {
    return Row(
      children: [
        Text(
          title,
          style: AppTypography.bodySmallTracked
              .copyWith(color: AppColors.slate500, letterSpacing: 1.2),
        ),
        const SizedBox(width: 8),
        Expanded(
          child:
              Container(height: 1, color: Colors.black.withValues(alpha: 0.05)),
        ),
        SizedBox(width: 8),
        Text(
          '$count FILES',
          style:
              AppTypography.bodySmallTracked.copyWith(color: AppColors.primary),
        ),
      ],
    );
  }

  Widget _buildDocList(
    BuildContext context,
    List<_DocModel> docs,
    int baseDelay,
  ) {
    final filtered = docs.where((d) => d.url != null).toList();
    if (filtered.isEmpty) {
      return Container(
        padding: const EdgeInsets.symmetric(vertical: 32),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.4),
          borderRadius: BorderRadius.circular(AppRadius.lg),
          border: Border.all(
            color: Colors.black.withValues(alpha: 0.05),
            style: BorderStyle.solid,
          ),
        ),
        child: Center(
          child: Text(
            'No documents submitted yet',
            style: GoogleFonts.plusJakartaSans(
              fontSize: 12,
              fontStyle: FontStyle.italic,
              color: AppColors.slate500,
            ),
          ),
        ),
      );
    }

    return Column(
      children: [
        for (int index = 0; index < filtered.length; index++) ...[
          if (index > 0) const SizedBox(height: 12),
          FadeUpWidget(
            delay: baseDelay + (index * 50),
            child: _buildDocItem(context, filtered[index]),
          ),
        ],
      ],
    );
  }

  Widget _buildDocItem(BuildContext context, _DocModel doc) {
    final bool isVideo = doc.isVideo;
    return InkWell(
      onTap: () => _viewDocument(context, doc.url, cacheKey: doc.cacheKey),
      borderRadius: BorderRadius.circular(AppRadius.lg),
      child: Container(
        padding: Spacing.paddingMd,
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(AppRadius.lg),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.02),
              blurRadius: 20,
              offset: const Offset(0, 8),
            ),
          ],
          border: Border.all(color: Colors.transparent),
        ),
        child: Row(
          children: [
            Container(
              height: 48,
              width: 48,
              decoration: BoxDecoration(
                color: isVideo
                    ? AppColors.orangeAccentSurface
                    : AppColors.primarySurface,
                borderRadius: BorderRadius.circular(AppRadius.lg),
              ),
              child: Icon(
                doc.icon,
                color: isVideo ? AppColors.warningDark : AppColors.primary,
                size: 22,
              ),
            ),
            SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    doc.label,
                    style: AppTypography.bodyMediumEmphasis
                        .copyWith(color: AppColors.slate800),
                  ),
                  SizedBox(height: 4),
                  Row(
                    children: [
                      Text(
                        'VERIFIED',
                        style: AppTypography.bodySmallTracked.copyWith(
                            color: AppColors.success, letterSpacing: 1),
                      ),
                      const SizedBox(width: 6),
                      Container(
                        height: 3,
                        width: 3,
                        decoration: const BoxDecoration(
                          color: AppColors.borderMedium,
                          shape: BoxShape.circle,
                        ),
                      ),
                      SizedBox(width: 6),
                      Text(
                        isVideo ? 'VIDEO' : 'IMAGE',
                        style: AppTypography.bodySmallTracked.copyWith(
                            color: AppColors.slate500, letterSpacing: 1),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            Container(
              height: 36,
              width: 36,
              decoration: const BoxDecoration(
                color: AppColors.surfaceBright,
                shape: BoxShape.circle,
              ),
              child: Icon(
                isVideo ? Icons.videocam_outlined : Icons.open_in_new,
                color: AppColors.slate400,
                size: 18,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSupportBanner(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(Spacing.md),
      decoration: BoxDecoration(
        color: AppColors.primary.withValues(alpha: 0.05),
        borderRadius: BorderRadius.circular(AppRadius.xl),
        border: Border.all(color: AppColors.primary.withValues(alpha: 0.1)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            height: 40,
            width: 40,
            decoration: BoxDecoration(
              color: AppColors.primary,
              borderRadius: BorderRadius.circular(AppRadius.md),
            ),
            child:
                const Icon(Icons.info_outline, color: Colors.white, size: 20),
          ),
          SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Having trouble with documents?',
                  style: AppTypography.bodyMediumEmphasis
                      .copyWith(color: AppColors.primary),
                ),
                SizedBox(height: 4),
                Text(
                  'If you see any issues with your verified documents or need to update them, please raise a support ticket.',
                  style: AppTypography.bodySmall
                      .copyWith(color: AppColors.primary, height: 1.5),
                ),
                SizedBox(height: 16),
                InkWell(
                  onTap: () =>
                      AppNavigator.push(context, const SupportCenterScreen()),
                  child: Row(
                    children: [
                      Text(
                        'CONTACT SUPPORT',
                        style: AppTypography.bodySmallTracked.copyWith(
                            color: AppColors.primary, letterSpacing: 1.2),
                      ),
                      SizedBox(width: 4),
                      Icon(
                        Icons.open_in_new,
                        color: AppColors.primary,
                        size: 14,
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _DocModel {
  final String label;
  final String? url;
  final IconData icon;
  final bool isVideo;
  final String? cacheKey;

  _DocModel({
    required this.label,
    this.url,
    required this.icon,
    this.isVideo = false,
    this.cacheKey,
  });
}
