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

/// TL Details bottom sheet
void showTLDetailsSheet(BuildContext context, RiderModel rider) {
  showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (context) {
      return Container(
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.only(
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
                  color: AppColors.outlineVariant,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 24),
            const CircleAvatar(
              radius: 48,
              backgroundColor: AppColors.iconBackground,
              child: Icon(Icons.person, size: 48, color: AppColors.slate400),
            ),
            SizedBox(height: 16),
            Text(
              (rider.teamLeader == null ||
                      rider.teamLeader!.isEmpty ||
                      rider.teamLeader == 'Not Assigned')
                  ? 'Not assigned'
                  : rider.teamLeader!,
              style: AppTypography.headingSmall
                  .copyWith(color: AppColors.slate800),
            ),
            SizedBox(height: 4),
            Text(
              'Assigned Team Leader',
              style: AppTypography.bodyMedium
                  .copyWith(fontSize: 13)
                  .copyWith(color: AppColors.slate500),
            ),
            SizedBox(height: 24),
            Container(
              padding: Spacing.paddingMd,
              decoration: BoxDecoration(
                color: AppColors.surfaceBright,
                borderRadius: BorderRadius.circular(AppRadius.lg),
              ),
              child: Row(
                children: [
                  const Icon(
                    Icons.phone_outlined,
                    color: AppColors.primary,
                    size: 20,
                  ),
                  SizedBox(width: 16),
                  Text(
                    (rider.emergencyContact == null ||
                            rider.emergencyContact!.isEmpty)
                        ? ''
                        : rider.emergencyContact!,
                    style: AppTypography.bodyLarge
                        .copyWith(color: AppColors.slate800),
                  ),
                  const Spacer(),
                  IconButton(
                    key: const Key('callTeamLeaderButton'),
                    onPressed: () async {
                      final phone = (rider.emergencyContact == null ||
                              rider.emergencyContact!.isEmpty)
                          ? ''
                          : rider.emergencyContact!;
                      final sanitized = phone.replaceAll(RegExp(r'[^\d+]'), '');
                      final uri = Uri.parse('tel:$sanitized');

                      try {
                        if (!await launchUrl(uri)) {
                          throw Exception('Could not launch dialer');
                        }
                      } catch (e) {
                        if (context.mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text(
                                  'Could not open the phone dialer. Please try again.'),
                              backgroundColor: AppColors.error,
                            ),
                          );
                        }
                      }
                    },
                    icon: const Icon(Icons.call, color: AppColors.success),
                  ),
                ],
              ),
            ),
            SizedBox(height: 32),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    key: const Key('changeTeamLeaderButton'),
                    onPressed: () {
                      Navigator.pop(context);
                      showChangeTLReasonSheet(context);
                    },
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      side: const BorderSide(color: AppColors.outlineVariant),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(AppRadius.lg),
                      ),
                    ),
                    child: Text(
                      'Change TL',
                      style: GoogleFonts.plusJakartaSans(
                        color: AppColors.error,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ),
                SizedBox(width: 12),
                Expanded(
                  child: ElevatedButton(
                    onPressed: () => Navigator.pop(context),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(AppRadius.lg),
                      ),
                    ),
                    child: Text(
                      'Close',
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
  showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (context) {
      return Padding(
        padding:
            EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
        child: Container(
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.only(
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
                    color: AppColors.outlineVariant,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              SizedBox(height: 24),
              Text(
                'Change Team Leader',
                style: AppTypography.titleLarge
                    .copyWith(color: AppColors.slate800),
              ),
              SizedBox(height: 8),
              Text(
                'Please provide a reason for changing your assigned Team Leader. This will be reviewed by the support team.',
                style: GoogleFonts.plusJakartaSans(
                    fontSize: 14, color: AppColors.slate500),
              ),
              const SizedBox(height: 20),
              TextFormField(
                controller: reasonController,
                maxLines: 3,
                decoration: InputDecoration(
                  hintText: 'Enter your reason here...',
                  filled: true,
                  fillColor: AppColors.surfaceBright,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(AppRadius.lg),
                    borderSide: BorderSide.none,
                  ),
                ),
              ),
              SizedBox(height: 24),
              ElevatedButton(
                onPressed: () async {
                  final reason = reasonController.text.trim();
                  if (reason.length < 5) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text(
                            'Please provide a detailed reason (at least 5 characters)'),
                        backgroundColor: AppColors.error,
                      ),
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
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text(
                              'Your TL change request has been submitted for approval'),
                          backgroundColor: AppColors.success,
                        ),
                      );
                    }
                  } catch (e) {
                    if (context.mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content:
                              Text('Failed to submit request: ${e.toString()}'),
                          backgroundColor: AppColors.error,
                        ),
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
                  'Submit Request',
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
  showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (context) {
      return Container(
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.only(
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
                  color: AppColors.outlineVariant,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            SizedBox(height: 24),
            Text(
              'Manage Subscription',
              style:
                  AppTypography.titleLarge.copyWith(color: AppColors.slate800),
            ),
            SizedBox(height: 8),
            Text(
              'View your current active plan details below. To change or upgrade your plan, please submit a request to your hub manager.',
              style: GoogleFonts.plusJakartaSans(
                fontSize: 14,
                color: AppColors.slate500,
              ),
            ),
            SizedBox(height: 24),
            Container(
              padding: const EdgeInsets.all(Spacing.md),
              decoration: BoxDecoration(
                color: AppColors.surfaceBright,
                borderRadius: BorderRadius.circular(AppRadius.lg),
                border: Border.all(color: AppColors.outlineVariant),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        rider.currentPlan?.replaceAll('_', ' ').toUpperCase() ??
                            'NO PLAN',
                        style: AppTypography.titleSmall
                            .copyWith(color: AppColors.slate900),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 4,
                        ),
                        decoration: BoxDecoration(
                          color: AppColors.successLight,
                          borderRadius: BorderRadius.circular(AppRadius.md),
                        ),
                        child: Text(
                          'Active',
                          style: AppTypography.labelMedium
                              .copyWith(color: AppColors.success),
                        ),
                      ),
                    ],
                  ),
                  SizedBox(height: 12),
                  Row(
                    children: [
                      const Icon(
                        Icons.currency_rupee,
                        size: 16,
                        color: AppColors.slate500,
                      ),
                      Text(
                        '${rider.activeRentalPlanPrice.toInt()} / week',
                        style: AppTypography.bodyMedium
                            .copyWith(fontWeight: FontWeight.w600)
                            .copyWith(color: AppColors.slate500),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            SizedBox(height: 24),
            FilledButton(
              key: const Key('requestPlanChangeButton'),
              onPressed: () {
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
                'Request Plan Change',
                style: AppTypography.titleSmall,
              ),
            ),
            SizedBox(height: 12),
            OutlinedButton(
              key: const Key('endRentalButton'),
              onPressed: () {
                Navigator.pop(context);
                startVehicleReturnWorkflow(context, rider);
              },
              style: OutlinedButton.styleFrom(
                foregroundColor: AppColors.error,
                side: const BorderSide(color: AppColors.errorBorder),
                minimumSize: const Size(double.infinity, 54),
                shape: const StadiumBorder(),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.assignment_return_outlined, size: 20),
                  SizedBox(width: 8),
                  Text(
                    'End Rental',
                    style: AppTypography.titleSmall,
                  ),
                ],
              ),
            ),
            SizedBox(height: 12),
            OutlinedButton(
              key: const Key('changeIntentButton'),
              onPressed: () {
                Navigator.pop(context);
                showIntentDialog(context, rider);
              },
              style: OutlinedButton.styleFrom(
                foregroundColor: AppColors.slate600,
                side: const BorderSide(color: AppColors.outlineVariant),
                minimumSize: const Size(double.infinity, 54),
                shape: const StadiumBorder(),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.work_outline, size: 20),
                  SizedBox(width: 8),
                  Text(
                    rider.intent != null
                        ? 'Change Intent: ${rider.intent}'
                        : 'Change Intent of Use',
                    style: AppTypography.titleSmall,
                  ),
                ],
              ),
            ),
            SizedBox(height: 16),
            OutlinedButton(
              onPressed: () => Navigator.pop(context),
              style: OutlinedButton.styleFrom(
                foregroundColor: AppColors.slate500,
                side: const BorderSide(color: AppColors.borderMedium),
                minimumSize: const Size(double.infinity, 54),
                shape: const StadiumBorder(),
              ),
              child: Text(
                'Close',
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
  const List<String> labels = [
    'Left Side',
    'Right Side',
    'Front View',
    'Speedometer',
  ];

  for (int i = 0; i < labels.length; i++) {
    final XFile? image = await showModalBottomSheet<XFile?>(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) {
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
                SizedBox(height: 16),
                Text(
                  'Step ${i + 1} of 4',
                  style: AppTypography.labelMedium
                      .copyWith(color: AppColors.primary),
                ),
                SizedBox(height: 8),
                Text(
                  'Capture ${labels[i]} of Vehicle',
                  style: AppTypography.titleMedium
                      .copyWith(color: AppColors.slate800),
                ),
                SizedBox(height: 8),
                Text(
                  'Ensure the photo is clear and well-lit for faster approval.',
                  textAlign: TextAlign.center,
                  style: GoogleFonts.plusJakartaSans(
                      fontSize: 14, color: AppColors.slate500),
                ),
                const SizedBox(height: 24),
                FilledButton.icon(
                  key: const Key('captureReturnPhotoButton'),
                  onPressed: () async {
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
                  label: const Text('Capture Photo'),
                  style: FilledButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    minimumSize: const Size(double.infinity, 54),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(AppRadius.md),
                    ),
                  ),
                ),
                SizedBox(height: 12),
                TextButton(
                  key: const Key('cancelReturnProcessButton'),
                  onPressed: () => Navigator.pop(context),
                  child: Text(
                    'Cancel Return Process',
                    style:
                        GoogleFonts.plusJakartaSans(color: AppColors.slate500),
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
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => AlertDialog(
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const CircularProgressIndicator(color: AppColors.primary),
            const SizedBox(height: 16),
            Text(
              'Uploading photos & submitting request...',
              style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            Text(
              'Please do not close the app.',
              style: GoogleFonts.plusJakartaSans(
                  fontSize: 12, color: AppColors.onSurfaceVariant),
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
            icon: const Icon(
              Icons.check_circle,
              size: 48,
              color: AppColors.success,
            ),
            title: const Text('Return Request Submitted'),
            content: const Text(
              'Your vehicle return request is pending approval. Our hub manager will verify your submission soon.',
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('Great!'),
              ),
            ],
          ),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Failed to submit return request. Please try again.'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    }
  }
}

/// Intent of Use dialog
void showIntentDialog(BuildContext context, RiderModel rider) {
  showDialog(
    context: context,
    builder: (context) {
      return AlertDialog(
        title: const Text('Intent of Use'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            _IntentOption(
              label: 'Personal Use',
              isSelected: rider.intent == 'Personal Use',
              onTap: () => _updateIntent(context, rider, 'Personal Use'),
            ),
            _IntentOption(
              label: 'E-commerce Delivery',
              isSelected: rider.intent == 'E-commerce Delivery',
              onTap: () => _updateIntent(context, rider, 'E-commerce Delivery'),
            ),
            _IntentOption(
              label: 'Food Delivery',
              isSelected: rider.intent == 'Food Delivery',
              onTap: () => _updateIntent(context, rider, 'Food Delivery'),
            ),
            _IntentOption(
              label: 'Other',
              isSelected: rider.intent == 'Other',
              onTap: () => _updateIntent(context, rider, 'Other'),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
        ],
      );
    },
  );
}

Future<void> _updateIntent(
    BuildContext context, RiderModel rider, String newIntent) async {
  final provider =
      ProviderScope.containerOf(context).read(riderProvider.notifier);
  try {
    await ApiClient().put('/api/rider/profile', body: {'intent': newIntent});
    final updated = rider.copyWith(intent: newIntent);
    provider.updateRider(updated);
    if (context.mounted) {
      Navigator.pop(context);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Intent updated successfully'),
          backgroundColor: AppColors.success,
        ),
      );
    }
  } catch (e) {
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Failed to update intent: ${e.toString()}'),
          backgroundColor: AppColors.error,
        ),
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
    return ListTile(
      title: Text(label),
      leading: Icon(
        isSelected ? Icons.radio_button_checked : Icons.radio_button_unchecked,
        color: isSelected ? AppColors.primary : null,
      ),
      onTap: onTap,
    );
  }
}
