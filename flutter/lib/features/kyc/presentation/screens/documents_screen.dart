import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:universal_io/io.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:voltium_rider/config/app_config.dart';
import 'package:voltium_rider/core/observability/posthog_service.dart';
import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/features/support/presentation/screens/support_center_screen.dart';
import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:voltium_rider/services/document_local_cache.dart';
import 'package:voltium_rider/theme/app_theme.dart';
import 'package:voltium_rider/theme/app_typography.dart';
import 'package:voltium_rider/utils/app_navigator.dart';
import 'package:voltium_rider/utils/haptic_service.dart';
import 'package:voltium_rider/utils/toast.dart';
import 'package:voltium_rider/widgets/fade_up_widget.dart';

class MyDocumentsScreen extends ConsumerStatefulWidget {
  final VoidCallback? onBack;
  const MyDocumentsScreen({super.key, this.onBack});

  @override
  ConsumerState<MyDocumentsScreen> createState() => _MyDocumentsScreenState();
}

class _MyDocumentsScreenState extends ConsumerState<MyDocumentsScreen> {
  @override
  void initState() {
    super.initState();
    PostHogService.screen('my_documents_screen');
  }

  void _showDocumentPreviewModal(
    BuildContext context, {
    required String title,
    required String localPath,
  }) {
    final colors = AppColors.of(context);
    final l10n = AppLocalizations.of(context);
    showDialog(
      context: context,
      barrierDismissible: true,
      builder: (ctx) {
        return Dialog(
          backgroundColor: colors.surface,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadius.lg),
          ),
          insetPadding:
              const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: Text(
                        title,
                        style: AppTypography.titleSmall.copyWith(
                          color: colors.onSurface,
                          fontWeight: FontWeight.w600,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    IconButton(
                      tooltip: 'Close',
                      icon: const Icon(Icons.close, size: 20),
                      onPressed: () {
                        HapticService.light();
                        Navigator.pop(ctx);
                      },
                      color: colors.onSurfaceMuted,
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                ClipRRect(
                  borderRadius: BorderRadius.circular(AppRadius.md),
                  child: Container(
                    constraints: const BoxConstraints(maxHeight: 360),
                    color: Colors.black,
                    child: InteractiveViewer(
                      minScale: 0.8,
                      maxScale: 3.0,
                      child: Image.file(
                        File(localPath),
                        fit: BoxFit.contain,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: () async {
                          HapticService.light();
                          Navigator.pop(ctx);
                          final uri = Uri.file(localPath);
                          try {
                            await launchUrl(uri,
                                mode: LaunchMode.externalApplication);
                          } catch (_) {}
                        },
                        icon: const Icon(Icons.open_in_new, size: 16),
                        label: Text(l10n?.txtopenExternal ?? 'Open External'),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: colors.onSurface,
                          side: BorderSide(color: colors.outlineVariant),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(AppRadius.md),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: ElevatedButton(
                        onPressed: () {
                          HapticService.light();
                          Navigator.pop(ctx);
                        },
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.primary,
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(AppRadius.md),
                          ),
                        ),
                        child: Text(l10n?.txtclose ?? 'Close'),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Future<void> _viewDocument(
    BuildContext context,
    String? url, {
    required String title,
    String? cacheKey,
    bool isVideo = false,
  }) async {
    HapticService.light();
    PostHogService.capture('document_viewed', properties: {
      'title': title,
      'is_video': isVideo,
      'has_cache_key': cacheKey != null,
    });

    if (url == null || url.isEmpty) return;

    // 1. Prefer local cached file if available (from onboarding upload).
    if (cacheKey != null) {
      final localPath = await DocumentLocalCache.get(cacheKey);
      if (localPath != null && File(localPath).existsSync()) {
        final lower = localPath.toLowerCase();
        final isImage = lower.endsWith('.jpg') ||
            lower.endsWith('.jpeg') ||
            lower.endsWith('.png') ||
            lower.endsWith('.webp');

        if (isImage && context.mounted) {
          _showDocumentPreviewModal(
            context,
            title: title,
            localPath: localPath,
          );
          return;
        }

        final uri = Uri.file(localPath);
        try {
          await launchUrl(uri, mode: LaunchMode.externalApplication);
          return;
        } catch (_) {
          // Fall through to network download below.
        }
      }
    }

    // 2. Fallback to network download.
    String fullUrl = url;
    if (!url.startsWith('http')) {
      final baseUrl = AppConfig.apiBaseUrl;
      final path = url.startsWith('/') ? url.substring(1) : url;
      fullUrl = '$baseUrl/api/files/$path';
    }
    final uri = Uri.parse(fullUrl);
    try {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    } catch (_) {
      if (context.mounted) {
        Toast.error(
          context,
          AppLocalizations.of(context)?.txtunableToOpenDocument ??
              'Unable to open document',
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final l10n = AppLocalizations.of(context);

    return Scaffold(
      backgroundColor: colors.surface,
      appBar: AppBar(
        backgroundColor: colors.surface,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: Icon(Icons.arrow_back, color: colors.onSurface, size: 20),
          tooltip: AppLocalizations.of(context)?.txtback ?? 'Back',
          onPressed: () {
            HapticService.light();
            if (widget.onBack != null) {
              widget.onBack!();
            } else if (Navigator.canPop(context)) {
              Navigator.pop(context);
            }
          },
        ),
        title: Text(
          l10n?.txtmyDocuments ?? 'My Documents',
          style: AppTypography.titleLarge.copyWith(color: colors.onSurface),
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
                  context,
                  rider?.kycStatus.name ?? 'PENDING',
                ),
              ),
              const SizedBox(height: 24),
              FadeUpWidget(
                delay: 100,
                child: _buildCategoryHeader(
                  context,
                  l10n?.txtyourDocuments ?? 'YOUR DOCUMENTS',
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
                    label: l10n?.txtaadhaarCardFront ?? 'Aadhaar Card (Front)',
                    url: rider?.aadhaarFront,
                    icon: Icons.description_outlined,
                    cacheKey: 'aadhaarFront',
                  ),
                  _DocModel(
                    label: l10n?.txtaadhaarCardBack ?? 'Aadhaar Card (Back)',
                    url: rider?.aadhaarBack,
                    icon: Icons.description_outlined,
                    cacheKey: 'aadhaarBack',
                  ),
                  _DocModel(
                    label: l10n?.txtpanCardLabel ?? 'PAN Card',
                    url: rider?.panCard,
                    icon: Icons.badge_outlined,
                    cacheKey: 'panCard',
                  ),
                  _DocModel(
                    label: l10n?.txtdigitalSignature ?? 'Digital Signature',
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
                  context,
                  l10n?.txtguarantorDocuments ?? "GUARANTOR'S DOCUMENTS",
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
                    label: l10n?.txtguarantorAadhaarFront ??
                        "Guarantor's Aadhaar (Front)",
                    url: rider?.guarantorAadhaarFront,
                    icon: Icons.shield_outlined,
                    cacheKey: 'guarantorAadhaarFront',
                  ),
                  _DocModel(
                    label: l10n?.txtguarantorAadhaarBack ??
                        "Guarantor's Aadhaar (Back)",
                    url: rider?.guarantorAadhaarBack,
                    icon: Icons.shield_outlined,
                    cacheKey: 'guarantorAadhaarBack',
                  ),
                  _DocModel(
                    label: l10n?.txtguarantorPanCard ?? "Guarantor's PAN Card",
                    url: rider?.guarantorPan,
                    icon: Icons.contact_mail_outlined,
                    cacheKey: 'guarantorPan',
                  ),
                  _DocModel(
                    label: l10n?.txtverificationVideo ?? "Verification Video",
                    url: rider?.guarantorVideo,
                    icon: Icons.videocam_outlined,
                    isVideo: true,
                    cacheKey: 'guarantorVideo',
                  ),
                  _DocModel(
                    label: l10n?.txtguarantorSignatureDoc ??
                        "Guarantor's Signature",
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

  Widget _buildVerificationStatusCard(BuildContext context, String status) {
    final colors = AppColors.of(context);
    final l10n = AppLocalizations.of(context);
    final bool isApproved = status.toUpperCase() == 'APPROVED' ||
        status.toUpperCase() == 'VERIFIED';
    return Container(
      padding: const EdgeInsets.all(Spacing.md),
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: BorderRadius.circular(AppRadius.radiusModal),
        border: Border.all(
          color: colors.outlineVariant.withValues(alpha: 0.5),
        ),
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
                    decoration: BoxDecoration(
                      color: colors.successLight,
                      shape: BoxShape.circle,
                    ),
                    child: Icon(
                      Icons.shield_outlined,
                      color: colors.success,
                      size: 20,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        l10n?.txtsecurityProfile ?? 'SECURITY PROFILE',
                        style: AppTypography.labelSmall.copyWith(
                          fontWeight: FontWeight.w800,
                          letterSpacing: 1.2,
                          color: colors.onSurfaceMuted,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        isApproved
                            ? (l10n?.txtverifiedAndSecure ??
                                'Verified & Secure')
                            : (l10n?.txtunderReview ?? 'Under Review'),
                        style: AppTypography.bodyMedium.copyWith(
                          fontWeight: FontWeight.w600,
                          color: colors.onSurface,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
              Container(
                height: 4,
                width: 60,
                decoration: BoxDecoration(
                  color: colors.successLight,
                  borderRadius: BorderRadius.circular(2),
                ),
                child: FractionallySizedBox(
                  alignment: Alignment.centerLeft,
                  widthFactor: isApproved ? 1.0 : 0.6,
                  child: Container(
                    decoration: BoxDecoration(
                      color: colors.success,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Text(
            isApproved
                ? (l10n?.txtidentityGuarantorVerifiedDesc ??
                    'Your identity and guarantor information have been verified. You can view or download copies of your documents below.')
                : (l10n?.txtverificationInProgressDesc ??
                    'Your verification is in progress. Some documents may still be under review by our safety team.'),
            style: AppTypography.bodySmall.copyWith(
              color: colors.onSurfaceMuted,
              height: 1.5,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCategoryHeader(BuildContext context, String title, int count) {
    final colors = AppColors.of(context);
    final l10n = AppLocalizations.of(context);
    return Row(
      children: [
        Text(
          title,
          style: AppTypography.labelSmall.copyWith(
            fontWeight: FontWeight.w800,
            letterSpacing: 1.2,
            color: colors.onSurfaceMuted,
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: Container(
            height: 1,
            color: colors.outlineVariant.withValues(alpha: 0.5),
          ),
        ),
        const SizedBox(width: 8),
        Text(
          l10n?.txtfilesCount(count) ?? '$count FILES',
          style: AppTypography.labelSmall.copyWith(
            fontWeight: FontWeight.w800,
            letterSpacing: 1.2,
            color: AppColors.primary,
          ),
        ),
      ],
    );
  }

  Widget _buildDocList(
    BuildContext context,
    List<_DocModel> docs,
    int baseDelay,
  ) {
    final colors = AppColors.of(context);
    final l10n = AppLocalizations.of(context);
    final filtered = docs.where((d) => d.url != null).toList();
    if (filtered.isEmpty) {
      return Container(
        padding: const EdgeInsets.symmetric(vertical: 32),
        decoration: BoxDecoration(
          color: colors.card.withValues(alpha: 0.4),
          borderRadius: BorderRadius.circular(AppRadius.lg),
          border: Border.all(
            color: colors.outlineVariant.withValues(alpha: 0.5),
            style: BorderStyle.solid,
          ),
        ),
        child: Center(
          child: Text(
            l10n?.txtnoDocumentsSubmittedYet ?? 'No documents submitted yet',
            style: AppTypography.bodySmall.copyWith(
              fontStyle: FontStyle.italic,
              color: colors.onSurfaceMuted,
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
    final colors = AppColors.of(context);
    final l10n = AppLocalizations.of(context);
    final bool isVideo = doc.isVideo;

    return InkWell(
      onTap: () => _viewDocument(
        context,
        doc.url,
        title: doc.label,
        cacheKey: doc.cacheKey,
        isVideo: isVideo,
      ),
      borderRadius: BorderRadius.circular(AppRadius.lg),
      child: Container(
        padding: Spacing.paddingMd,
        decoration: BoxDecoration(
          color: colors.card,
          borderRadius: BorderRadius.circular(AppRadius.lg),
          border: Border.all(
            color: colors.outlineVariant.withValues(alpha: 0.5),
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.02),
              blurRadius: 20,
              offset: const Offset(0, 8),
            ),
          ],
        ),
        child: Row(
          children: [
            Container(
              height: 48,
              width: 48,
              decoration: BoxDecoration(
                color: isVideo ? colors.warningLight : colors.primarySurface,
                borderRadius: BorderRadius.circular(AppRadius.lg),
              ),
              child: Icon(
                doc.icon,
                color:
                    isVideo ? colors.warningLightForeground : AppColors.primary,
                size: 22,
              ),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    doc.label,
                    style: AppTypography.bodyMedium.copyWith(
                      fontWeight: FontWeight.w600,
                      color: colors.onSurface,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      Container(
                        height: 6,
                        width: 6,
                        decoration: BoxDecoration(
                          color: isVideo ? colors.warning : colors.success,
                          shape: BoxShape.circle,
                        ),
                      ),
                      const SizedBox(width: 6),
                      Text(
                        l10n?.txtverifiedAndActive ?? 'Verified & Active',
                        style: AppTypography.bodySmall.copyWith(
                          color: colors.onSurfaceMuted,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            Container(
              height: 36,
              width: 36,
              decoration: BoxDecoration(
                color: colors.iconBackground,
                shape: BoxShape.circle,
              ),
              child: Icon(
                isVideo ? Icons.videocam_outlined : Icons.open_in_new,
                color: colors.onSurfaceVariant,
                size: 18,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSupportBanner(BuildContext context) {
    final colors = AppColors.of(context);
    final l10n = AppLocalizations.of(context);

    return Container(
      padding: const EdgeInsets.all(Spacing.md),
      decoration: BoxDecoration(
        color: colors.primarySurface,
        borderRadius: BorderRadius.circular(AppRadius.radiusModal),
        border: Border.all(color: AppColors.primary.withValues(alpha: 0.15)),
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
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  l10n?.txthavingTroubleWithDocuments ??
                      'Having trouble with documents?',
                  style: AppTypography.bodyMedium.copyWith(
                    fontWeight: FontWeight.w600,
                    color: colors.onSurface,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  l10n?.txtifYouSeeAnyIssuesWithYourVerifiedDocumentsOrNeedToUpdateThemPleaseRaiseASupportTicket ??
                      'If you see any issues with your verified documents or need to update them, please raise a support ticket.',
                  style: AppTypography.bodySmall.copyWith(
                    color: colors.onSurfaceVariant,
                    height: 1.5,
                  ),
                ),
                const SizedBox(height: 16),
                InkWell(
                  onTap: () {
                    HapticService.light();
                    PostHogService.capture('documents_support_clicked');
                    AppNavigator.push(context, const SupportCenterScreen());
                  },
                  child: Row(
                    children: [
                      Text(
                        l10n?.txtcontactSupport ?? 'CONTACT SUPPORT',
                        style: AppTypography.labelSmall.copyWith(
                          fontWeight: FontWeight.w800,
                          letterSpacing: 1.2,
                          color: AppColors.primary,
                        ),
                      ),
                      const SizedBox(width: 4),
                      const Icon(
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
