import 'package:universal_io/io.dart';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import 'package:voltium_rider/models/rider_model.dart';
import 'package:voltium_rider/theme/app_theme.dart';

import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/core/network/api_client.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:voltium_rider/theme/app_typography.dart';

import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:voltium_rider/utils/haptic_service.dart';
import 'package:voltium_rider/utils/toast.dart';

/// TL Details bottom sheet
void showTLDetailsSheet(BuildContext context, RiderModel rider) {
  final l10n = AppLocalizations.of(context);
  final isUnassigned = rider.teamLeader == null ||
      rider.teamLeader!.isEmpty ||
      rider.teamLeader == 'Not Assigned';
  final displayName =
      isUnassigned ? (l10n?.txtnotAssigned ?? 'Not assigned') : rider.teamLeader!;

  showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (context) {
      final colors = AppColors.of(context);
      return Container(
        decoration: BoxDecoration(
          color: colors.card,
          borderRadius: const BorderRadius.only(
            topLeft: Radius.circular(32),
            topRight: Radius.circular(32),
          ),
        ),
        padding: const EdgeInsets.fromLTRB(24, 12, 24, 32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: colors.outlineVariant,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 24),
            CircleAvatar(
              radius: 48,
              backgroundColor: colors.iconBackground,
              child: Icon(Icons.person, size: 48, color: colors.onSurfaceMuted),
            ),
            const SizedBox(height: 16),
            Text(
              displayName,
              style: AppTypography.headingSmall
                  .copyWith(color: colors.onSurface),
            ),
            const SizedBox(height: 4),
            Text(
              l10n?.txtassignedTeamLeader ?? 'Assigned Team Leader',
              style: AppTypography.bodyMedium
                  .copyWith(fontSize: 13)
                  .copyWith(color: colors.onSurfaceVariant),
            ),
            const SizedBox(height: 24),
            Container(
              padding: Spacing.paddingMd,
              decoration: BoxDecoration(
                color: colors.surfaceBright,
                borderRadius: BorderRadius.circular(AppRadius.lg),
              ),
              child: Row(
                children: [
                  const Icon(
                    Icons.phone_outlined,
                    color: AppColors.primary,
                    size: 20,
                  ),
                  const SizedBox(width: 16),
                  Text(
                    (rider.teamLeaderPhone == null ||
                            rider.teamLeaderPhone!.isEmpty)
                        ? ''
                        : rider.teamLeaderPhone!,
                    style: AppTypography.bodyLarge
                        .copyWith(color: colors.onSurface),
                  ),
                  const Spacer(),
                  IconButton(
                    key: const Key('callTeamLeaderButton'),
                    onPressed: () async {
                      HapticService.light();
                      // PR-AUDIT-FIX 2026-08-17 (AD-P0-1): dial the assigned Team Leader's phone
                      final phone = (rider.teamLeaderPhone == null ||
                              rider.teamLeaderPhone!.isEmpty)
                          ? ''
                          : rider.teamLeaderPhone!;
                      final sanitized = phone.replaceAll(RegExp(r'[^\d+]'), '');
                      if (sanitized.isEmpty) {
                        if (context.mounted) {
                          Toast.warning(
                            context,
                            l10n?.txtnoContactNumberTl ??
                                'No contact number available for your Team Leader.',
                          );
                        }
                        return;
                      }
                      final uri = Uri.parse('tel:$sanitized');

                      try {
                        if (!await launchUrl(uri)) {
                          throw Exception('Could not launch dialer');
                        }
                      } catch (e) {
                        if (context.mounted) {
                          Toast.error(
                            context,
                            l10n?.txtcouldNotOpenDialer ??
                                'Could not open the phone dialer. Please try again.',
                          );
                        }
                      }
                    },
                    icon: const Icon(Icons.call, color: AppColors.success),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 32),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    key: const Key('changeTeamLeaderButton'),
                    onPressed: () {
                      HapticService.light();
                      Navigator.pop(context);
                      showChangeTLReasonSheet(context);
                    },
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      side: BorderSide(color: colors.outlineVariant),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(AppRadius.lg),
                      ),
                    ),
                    child: Text(
                      l10n?.txtchangeTl ?? 'Change TL',
                      style: GoogleFonts.plusJakartaSans(
                        color: AppColors.error,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: ElevatedButton(
                    onPressed: () {
                      HapticService.light();
                      Navigator.pop(context);
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(AppRadius.lg),
                      ),
                    ),
                    child: Text(
                      l10n?.txtclose ?? 'Close',
                      style: GoogleFonts.plusJakartaSans(
                          fontWeight: FontWeight.bold),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      );
    },
  );
}

/// Change TL Reason bottom sheet
void showChangeTLReasonSheet(BuildContext context) {
  final TextEditingController reasonController = TextEditingController();
  final l10n = AppLocalizations.of(context);

  showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (context) {
      final colors = AppColors.of(context);
      return Padding(
        padding:
            EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
        child: Container(
          decoration: BoxDecoration(
            color: colors.card,
            borderRadius: const BorderRadius.only(
              topLeft: Radius.circular(32),
              topRight: Radius.circular(32),
            ),
          ),
          padding: const EdgeInsets.fromLTRB(24, 12, 24, 32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: colors.outlineVariant,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 24),
              Text(
                l10n?.txtchangeTeamLeaderTitle ?? 'Change Team Leader',
                style: AppTypography.titleLarge
                    .copyWith(color: colors.onSurface),
              ),
              const SizedBox(height: 8),
              Text(
                l10n?.txtchangeTlReasonPrompt ??
                    'Please provide a reason for changing your assigned Team Leader. This will be reviewed by the support team.',
                style: GoogleFonts.plusJakartaSans(
                    fontSize: 14,
                    color: colors.onSurfaceVariant),
              ),
              const SizedBox(height: 20),
              TextFormField(
                controller: reasonController,
                maxLines: 3,
                style: TextStyle(color: colors.onSurface),
                decoration: InputDecoration(
                  hintText: l10n?.txtenterReasonHint ?? 'Enter your reason here...',
                  hintStyle: TextStyle(color: colors.onSurfaceMuted),
                  filled: true,
                  fillColor: colors.surfaceBright,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(AppRadius.lg),
                    borderSide: BorderSide.none,
                  ),
                ),
              ),
              const SizedBox(height: 24),
              ElevatedButton(
                onPressed: () async {
                  HapticService.light();
                  final reason = reasonController.text.trim();
                  if (reason.length < 5) {
                    Toast.error(
                      context,
                      l10n?.txtprovideDetailedReason ??
                          'Please provide a detailed reason (at least 5 characters)',
                    );
                    return;
                  }
                  Navigator.pop(context);
                  try {
                    await ProviderScope.containerOf(context)
                        .read(supportProvider.notifier)
                        .createTicket(
                          category: 'GENERAL',
                          subject: 'Request to change Team Leader',
                          message:
                              'Rider request to change Team Leader. Reason: $reason',
                        );
                    if (context.mounted) {
                      Toast.success(
                        context,
                        l10n?.txttlChangeSubmitted ??
                            'Your TL change request has been submitted for approval',
                      );
                    }
                  } catch (e) {
                    if (context.mounted) {
                      Toast.error(
                        context,
                        l10n?.txtfailedToSubmitRequest(e.toString()) ??
                            'Failed to submit request: ${e.toString()}',
                      );
                    }
                  }
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.error,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(AppRadius.lg),
                  ),
                ),
                child: Text(
                  l10n?.txtsubmitRequest ?? 'Submit Request',
                  style:
                      GoogleFonts.plusJakartaSans(fontWeight: FontWeight.bold),
                ),
              ),
            ],
          ),
        ),
      );
    },
  ).whenComplete(() => reasonController.dispose());
}

/// Subscription management bottom sheet
void showSubscriptionSheet(
  BuildContext context,
  RiderModel rider, {
  VoidCallback? onRequestPlanChange,
}) {
  final l10n = AppLocalizations.of(context);
  final planLower = (rider.currentPlan ?? '').toLowerCase();

  showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (context) {
      final colors = AppColors.of(context);
      final cadence = planLower.contains('daily')
          ? (l10n?.txtperDay ?? '/ day')
          : (planLower.contains('monthly')
              ? (l10n?.txtperMonth ?? '/ month')
              : (l10n?.txtperWeek ?? '/ week'));
      final displayPlan = rider.currentPlan?.replaceAll('_', ' ').toUpperCase() ??
          (l10n?.txtnoPlan ?? 'NO PLAN');

      final intentLabel = rider.intent != null
          ? (l10n?.txtchangeIntentPrefix(rider.intent!) ??
              'Change Intent: ${rider.intent}')
          : (l10n?.txtchangeIntentButton ?? 'Change Intent of Use');

      return Container(
        decoration: BoxDecoration(
          color: colors.card,
          borderRadius: const BorderRadius.only(
            topLeft: Radius.circular(24),
            topRight: Radius.circular(24),
          ),
        ),
        padding:
            const EdgeInsets.only(top: 12, left: 24, right: 24, bottom: 32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: colors.outlineVariant,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 24),
            Text(
              l10n?.txtmanageSubscriptionTitle ?? 'Manage Subscription',
              style: AppTypography.titleLarge
                  .copyWith(color: colors.onSurface),
            ),
            const SizedBox(height: 8),
            Text(
              l10n?.txtmanageSubscriptionSubtitle ??
                  'View your current active plan details below. To change or upgrade your plan, please submit a request to your hub manager.',
              style: GoogleFonts.plusJakartaSans(
                fontSize: 14,
                color: colors.onSurfaceVariant,
              ),
            ),
            const SizedBox(height: 24),
            Container(
              padding: const EdgeInsets.all(Spacing.md),
              decoration: BoxDecoration(
                color: colors.surfaceBright,
                borderRadius: BorderRadius.circular(AppRadius.lg),
                border: Border.all(color: colors.outlineVariant),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        displayPlan,
                        style: AppTypography.titleSmall
                            .copyWith(color: colors.onSurface),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 4,
                        ),
                        decoration: BoxDecoration(
                          color: colors.successLight,
                          borderRadius: BorderRadius.circular(AppRadius.md),
                        ),
                        child: Text(
                          l10n?.txtactiveBadge ?? 'Active',
                          style: AppTypography.labelMedium
                              .copyWith(color: AppColors.success),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Icon(
                        Icons.currency_rupee,
                        size: 16,
                        color: colors.onSurfaceVariant,
                      ),
                      Text(
                        '${rider.activeRentalPlanPrice.toInt()} $cadence',
                        style: AppTypography.bodyMedium
                            .copyWith(fontWeight: FontWeight.w600)
                            .copyWith(color: colors.onSurfaceVariant),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),
            FilledButton(
              key: const Key('requestPlanChangeButton'),
              onPressed: () {
                HapticService.light();
                Navigator.pop(context);
                onRequestPlanChange?.call();
              },
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.white,
                minimumSize: const Size(double.infinity, 54),
                shape: const StadiumBorder(),
              ),
              child: Text(
                l10n?.txtrequestPlanChangeButton ?? 'Request Plan Change',
                style: AppTypography.titleSmall,
              ),
            ),
            const SizedBox(height: 12),
            OutlinedButton(
              key: const Key('endRentalButton'),
              onPressed: () {
                HapticService.light();
                Navigator.pop(context);
                startVehicleReturnWorkflow(context, rider);
              },
              style: OutlinedButton.styleFrom(
                foregroundColor: colors.error,
                side: const BorderSide(color: AppColors.errorBorder),
                minimumSize: const Size(double.infinity, 54),
                shape: const StadiumBorder(),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.assignment_return_outlined, size: 20),
                  const SizedBox(width: 8),
                  Text(
                    l10n?.txtendRentalButton ?? 'End Rental',
                    style: AppTypography.titleSmall,
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            OutlinedButton(
              key: const Key('changeIntentButton'),
              onPressed: () {
                HapticService.light();
                Navigator.pop(context);
                showIntentDialog(context, rider);
              },
              style: OutlinedButton.styleFrom(
                foregroundColor: colors.onSurfaceVariant,
                side: BorderSide(color: colors.outlineVariant),
                minimumSize: const Size(double.infinity, 54),
                shape: const StadiumBorder(),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.work_outline, size: 20),
                  const SizedBox(width: 8),
                  Text(
                    intentLabel,
                    style: AppTypography.titleSmall,
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            OutlinedButton(
              onPressed: () {
                HapticService.light();
                Navigator.pop(context);
              },
              style: OutlinedButton.styleFrom(
                foregroundColor: colors.onSurfaceVariant,
                side: BorderSide(color: colors.outlineVariant),
                minimumSize: const Size(double.infinity, 54),
                shape: const StadiumBorder(),
              ),
              child: Text(
                l10n?.txtclose ?? 'Close',
                style: AppTypography.titleSmall,
              ),
            ),
            SizedBox(height: MediaQuery.of(context).padding.bottom),
          ],
        ),
      );
    },
  );
}

/// Vehicle return workflow using ImagePicker
Future<void> startVehicleReturnWorkflow(
  BuildContext context,
  RiderModel rider,
) async {
  final picker = ImagePicker();
  final List<File> photos = [];
  final l10n = AppLocalizations.of(context);

  final List<String> labels = [
    l10n?.txtleftSide ?? 'Left Side',
    l10n?.txtrightSide ?? 'Right Side',
    l10n?.txtfrontView ?? 'Front View',
    l10n?.txtspeedometer ?? 'Speedometer',
  ];

  for (int i = 0; i < labels.length; i++) {
    final XFile? image = await showModalBottomSheet<XFile?>(
      context: context,
      backgroundColor: AppColors.of(context).card,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) {
        final colors = AppColors.of(context);
        final stepText = l10n?.txtstepXofY(i + 1, 4) ?? 'Step ${i + 1} of 4';
        final captureTitle = l10n?.txtcaptureViewOfVehicle(labels[i]) ??
            'Capture ${labels[i]} of Vehicle';

        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(24.0),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(
                  Icons.camera_alt,
                  size: 48,
                  color: AppColors.primary,
                ),
                const SizedBox(height: 16),
                Text(
                  stepText,
                  style: AppTypography.labelMedium
                      .copyWith(color: AppColors.primary),
                ),
                const SizedBox(height: 8),
                Text(
                  captureTitle,
                  style: AppTypography.titleMedium
                      .copyWith(color: colors.onSurface),
                ),
                const SizedBox(height: 8),
                Text(
                  l10n?.txtensureClearPhotoPrompt ??
                      'Ensure the photo is clear and well-lit for faster approval.',
                  textAlign: TextAlign.center,
                  style: GoogleFonts.plusJakartaSans(
                      fontSize: 14,
                      color: colors.onSurfaceVariant),
                ),
                const SizedBox(height: 24),
                FilledButton.icon(
                  key: const Key('captureReturnPhotoButton'),
                  onPressed: () async {
                    HapticService.light();
                    try {
                      final photo = await picker.pickImage(
                        source: ImageSource.camera,
                        maxWidth: 1600,
                        maxHeight: 1600,
                        imageQuality: 85,
                        requestFullMetadata: false,
                      );
                      if (context.mounted) Navigator.pop(context, photo);
                    } catch (e) {
                      if (context.mounted) Navigator.pop(context);
                    }
                  },
                  icon: const Icon(Icons.photo_camera),
                  label: Text(l10n?.txtcapturePhotoBtn ?? 'Capture Photo'),
                  style: FilledButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    minimumSize: const Size(double.infinity, 54),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(AppRadius.md),
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                TextButton(
                  key: const Key('cancelReturnProcessButton'),
                  onPressed: () {
                    HapticService.light();
                    Navigator.pop(context);
                  },
                  child: Text(
                    l10n?.txtcancelReturnProcessBtn ?? 'Cancel Return Process',
                    style: GoogleFonts.plusJakartaSans(
                        color: colors.onSurfaceVariant),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );

    if (image == null) return;
    photos.add(File(image.path));
  }

  if (context.mounted) {
    final colors = AppColors.of(context);
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => AlertDialog(
        backgroundColor: colors.card,
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const CircularProgressIndicator(color: AppColors.primary),
            const SizedBox(height: 16),
            Text(
              l10n?.txtuploadingPhotosSubmitting ??
                  'Uploading photos & submitting request...',
              style: GoogleFonts.plusJakartaSans(
                  fontWeight: FontWeight.bold, color: colors.onSurface),
            ),
            const SizedBox(height: 8),
            Text(
              l10n?.txtdoNotCloseApp ?? 'Please do not close the app.',
              style: GoogleFonts.plusJakartaSans(
                  fontSize: 12, color: colors.onSurfaceVariant),
            ),
          ],
        ),
      ),
    );

    final success = await ProviderScope.containerOf(context)
        .read(riderProvider.notifier)
        .submitVehicleReturn(
          photos: photos,
          reason: 'Rental Term Completed',
        );

    if (context.mounted) {
      Navigator.pop(context);

      if (success) {
        showDialog(
          context: context,
          builder: (context) => AlertDialog(
            backgroundColor: colors.card,
            icon: const Icon(
              Icons.check_circle,
              size: 48,
              color: AppColors.success,
            ),
            title: Text(
              l10n?.txtreturnRequestSubmittedTitle ??
                  'Return Request Submitted',
              style: TextStyle(color: colors.onSurface),
            ),
            content: Text(
              l10n?.txtreturnRequestSubmittedBody ??
                  'Your vehicle return request is pending approval. Our hub manager will verify your submission soon.',
              style: TextStyle(color: colors.onSurfaceVariant),
            ),
            actions: [
              TextButton(
                onPressed: () {
                  HapticService.light();
                  Navigator.pop(context);
                },
                child: Text(l10n?.txtgreatBtn ?? 'Great!'),
              ),
            ],
          ),
        );
      } else {
        Toast.error(
          context,
          l10n?.txtfailedToSubmitReturn ??
              'Failed to submit return request. Please try again.',
        );
      }
    }
  }
}

/// Intent of Use dialog
void showIntentDialog(BuildContext context, RiderModel rider) {
  final l10n = AppLocalizations.of(context);
  final colors = AppColors.of(context);

  showDialog(
    context: context,
    builder: (context) {
      return AlertDialog(
        backgroundColor: colors.card,
        title: Text(
          l10n?.txtintentOfUse ?? 'Intent of Use',
          style: TextStyle(color: colors.onSurface),
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            _IntentOption(
              label: l10n?.txtpersonalUse ?? 'Personal Use',
              isSelected: rider.intent == 'Personal Use',
              onTap: () => _updateIntent(context, rider, 'Personal Use'),
            ),
            _IntentOption(
              label: l10n?.txtecommerceDelivery ?? 'E-commerce Delivery',
              isSelected: rider.intent == 'E-commerce Delivery',
              onTap: () => _updateIntent(context, rider, 'E-commerce Delivery'),
            ),
            _IntentOption(
              label: l10n?.txtfoodDelivery ?? 'Food Delivery',
              isSelected: rider.intent == 'Food Delivery',
              onTap: () => _updateIntent(context, rider, 'Food Delivery'),
            ),
            _IntentOption(
              label: l10n?.txtother ?? 'Other',
              isSelected: rider.intent == 'Other',
              onTap: () => _updateIntent(context, rider, 'Other'),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () {
              HapticService.light();
              Navigator.pop(context);
            },
            child: Text(l10n?.txtcancel ?? 'Cancel'),
          ),
        ],
      );
    },
  );
}

Future<void> _updateIntent(
    BuildContext context, RiderModel rider, String newIntent) async {
  HapticService.light();
  final provider =
      ProviderScope.containerOf(context).read(riderProvider.notifier);
  final l10n = AppLocalizations.of(context);

  try {
    await ApiClient().put('/api/rider/profile', body: {'intent': newIntent});
    final updated = rider.copyWith(intent: newIntent);
    provider.updateRider(updated);
    if (context.mounted) {
      Navigator.pop(context);
      Toast.success(
        context,
        l10n?.txtintentUpdatedSuccess ?? 'Intent updated successfully',
      );
    }
  } catch (e) {
    if (context.mounted) {
      Toast.error(
        context,
        l10n?.txtfailedToUpdateIntent(e.toString()) ??
            'Failed to update intent: ${e.toString()}',
      );
    }
  }
}

class _IntentOption extends ConsumerWidget {
  final String label;
  final bool isSelected;
  final VoidCallback onTap;

  const _IntentOption({
    required this.label,
    required this.isSelected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = AppColors.of(context);
    return ListTile(
      title: Text(label, style: TextStyle(color: colors.onSurface)),
      leading: Icon(
        isSelected ? Icons.radio_button_checked : Icons.radio_button_unchecked,
        color: isSelected ? AppColors.primary : colors.onSurfaceMuted,
      ),
      onTap: onTap,
    );
  }
}
