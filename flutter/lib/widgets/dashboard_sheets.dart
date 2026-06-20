import 'dart:io';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';

import '../models/rider_model.dart';
import '../providers/app_provider.dart';
import '../theme/app_theme.dart';

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
                    borderRadius: BorderRadius.circular(2),),
              ),
            ),
            const SizedBox(height: 24),
            const CircleAvatar(
              radius: 48,
              backgroundColor: AppColors.iconBackground,
              child: Icon(Icons.person, size: 48, color: AppColors.slate400),
            ),
            const SizedBox(height: 16),
            Text(
              (rider.teamLeader == null ||
                      rider.teamLeader!.isEmpty ||
                      rider.teamLeader == 'Not Assigned')
                  ? 'Amit Sharma'
                  : rider.teamLeader!,
              style: const TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFF1E293B),),
            ),
            const SizedBox(height: 4),
            const Text('Assigned Team Leader',
              style: TextStyle(
                  fontSize: 13,
                  color: AppColors.slate500,
                  fontWeight: FontWeight.w500,),
            ),
            const SizedBox(height: 24),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                  color: const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(16),),
              child: Row(
                children: [
                  const Icon(Icons.phone_outlined,
                      color: Color(0xFF2563EB), size: 20,),
                  const SizedBox(width: 16),
                  Text(
                      (rider.emergencyContact == null ||
                              rider.emergencyContact!.isEmpty)
                          ? '+91 98765 12345'
                          : rider.emergencyContact!,
                      style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF1E293B),),),
                  const Spacer(),
                  IconButton(
                      key: const Key('callTeamLeaderButton'),
                      onPressed: () {},
                      icon: const Icon(Icons.call, color: Color(0xFF16A34A)),),
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
                      Navigator.pop(context);
                      showChangeTLReasonSheet(context);
                    },
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      side: const BorderSide(color: AppColors.outlineVariant),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16),),
                    ),
                    child: const Text('Change TL',
                        style: TextStyle(
                            color: Color(0xFFDC2626),
                            fontWeight: FontWeight.bold,),),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: ElevatedButton(
                    onPressed: () => Navigator.pop(context),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16),),
                    ),
                    child: const Text('Close',
                        style: TextStyle(fontWeight: FontWeight.bold),),
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
                      borderRadius: BorderRadius.circular(2),),
                ),
              ),
              const SizedBox(height: 24),
              const Text('Change Team Leader',
                style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF1E293B),),
              ),
              const SizedBox(height: 8),
              const Text('Please provide a reason for changing your assigned Team Leader. This will be reviewed by the support team.',
                style: TextStyle(fontSize: 14, color: AppColors.slate500),
              ),
              const SizedBox(height: 20),
              TextFormField(
                controller: reasonController,
                maxLines: 3,
                decoration: InputDecoration(
                  hintText: 'Enter your reason here...',
                  filled: true,
                  fillColor: const Color(0xFFF8FAFC),
                  border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(16),
                      borderSide: BorderSide.none,),
                ),
              ),
              const SizedBox(height: 24),
              ElevatedButton(
                onPressed: () {
                  Navigator.pop(context);
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content:
                          Text('Your request has been submitted for approval'),
                      backgroundColor: AppColors.success,
                    ),
                  );
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFDC2626),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),),
                ),
                child: const Text('Submit Request',
                    style: TextStyle(fontWeight: FontWeight.bold),),
              ),
            ],
          ),
        ),
      );
    },
  ).whenComplete(() => reasonController.dispose());
}

/// Subscription management bottom sheet
void showSubscriptionSheet(BuildContext context, RiderModel rider,
    {VoidCallback? onRequestPlanChange,}) {
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
            const SizedBox(height: 24),
            const Text('Manage Subscription',
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.bold,
                color: Color(0xFF1E293B),
              ),
            ),
            const SizedBox(height: 8),
            const Text('View your current active plan details below. To change or upgrade your plan, please submit a request to your hub manager.',
              style: TextStyle(
                fontSize: 14,
                color: AppColors.slate500,
              ),
            ),
            const SizedBox(height: 24),
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: const Color(0xFFF8FAFC),
                borderRadius: BorderRadius.circular(16),
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
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF0F172A),
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 10, vertical: 4,),
                        decoration: BoxDecoration(
                          color: const Color(0xFFDCFCE7),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: const Text('Active',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.bold,
                            color: Color(0xFF16A34A),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      const Icon(Icons.currency_rupee,
                          size: 16, color: AppColors.slate500,),
                      Text(
                        '${rider.activeRentalPlanPrice.toInt()} / week',
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: AppColors.slate500,
                        ),
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
                Navigator.pop(context);
                onRequestPlanChange?.call();
              },
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.white,
                minimumSize: const Size(double.infinity, 54),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(27),
                ),
              ),
              child: const Text('Request Plan Change',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
              ),
            ),
            const SizedBox(height: 12),
            OutlinedButton(
              key: const Key('endRentalButton'),
              onPressed: () {
                Navigator.pop(context);
              },
              style: OutlinedButton.styleFrom(
                foregroundColor: const Color(0xFFDC2626),
                side: const BorderSide(color: Color(0xFFFECACA)),
                minimumSize: const Size(double.infinity, 54),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(27),
                ),
              ),
              child: const Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.assignment_return_outlined, size: 20),
                  SizedBox(width: 8),
                  Text('End Rental',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            OutlinedButton(
              key: const Key('changeIntentButton'),
              onPressed: () {
                Navigator.pop(context);
                showIntentDialog(context, rider);
              },
              style: OutlinedButton.styleFrom(
                foregroundColor: const Color(0xFF475569),
                side: const BorderSide(color: AppColors.outlineVariant),
                minimumSize: const Size(double.infinity, 54),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(27),
                ),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.work_outline, size: 20),
                  const SizedBox(width: 8),
                  Text(
                    rider.intent != null
                        ? 'Change Intent: ${rider.intent}'
                        : 'Change Intent of Use',
                    style: const TextStyle(
                        fontSize: 16, fontWeight: FontWeight.bold,),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            OutlinedButton(
              onPressed: () => Navigator.pop(context),
              style: OutlinedButton.styleFrom(
                foregroundColor: AppColors.slate500,
                side: const BorderSide(color: Color(0xFFCBD5E1)),
                minimumSize: const Size(double.infinity, 54),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(27),
                ),
              ),
              child: const Text('Close',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
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
    BuildContext context, RiderModel rider,) async {
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
                const Icon(Icons.camera_alt,
                    size: 48, color: AppColors.primary,),
                const SizedBox(height: 16),
                Text(
                  'Step ${i + 1} of 4',
                  style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                      color: AppColors.primary,),
                ),
                const SizedBox(height: 8),
                Text(
                  'Capture ${labels[i]} of Vehicle',
                  style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF1E293B),),
                ),
                const SizedBox(height: 8),
                const Text(
                  'Ensure the photo is clear and well-lit for faster approval.',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 14, color: AppColors.slate500),
                ),
                const SizedBox(height: 24),
                FilledButton.icon(
                  key: const Key('captureReturnPhotoButton'),
                  onPressed: () async {
                    try {
                      final photo =
                          await picker.pickImage(source: ImageSource.camera);
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
                        borderRadius: BorderRadius.circular(12),),
                  ),
                ),
                const SizedBox(height: 12),
                TextButton(
                  key: const Key('cancelReturnProcessButton'),
                  onPressed: () => Navigator.pop(context),
                  child: const Text('Cancel Return Process',
                      style: TextStyle(color: AppColors.slate500),),
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
      builder: (context) => const AlertDialog(
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            CircularProgressIndicator(color: AppColors.primary),
            SizedBox(height: 16),
            Text('Uploading photos & submitting request...',
                style: TextStyle(fontWeight: FontWeight.bold),),
            SizedBox(height: 8),
            Text('Please do not close the app.',
                style: TextStyle(fontSize: 12, color: Colors.grey),),
          ],
        ),
      ),
    );

    final success = await context.read<AppProvider>().submitVehicleReturn(
          photos: photos,
          reason: 'Rental Term Completed',
        );

    if (context.mounted) {
      Navigator.pop(context);

      if (success) {
        showDialog(
          context: context,
          builder: (context) => AlertDialog(
            icon: const Icon(Icons.check_circle,
                size: 48, color: Color(0xFF16A34A),),
            title: const Text('Return Request Submitted'),
            content: const Text('Your vehicle return request is pending approval. Our hub manager will verify your submission soon.',),
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
            backgroundColor: Color(0xFFDC2626),
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

void _updateIntent(BuildContext context, RiderModel rider, String newIntent) {
  final updated = rider.copyWith(intent: newIntent);
  context.read<AppProvider>().updateRider(updated);
  Navigator.pop(context);
  ScaffoldMessenger.of(context).showSnackBar(
    const SnackBar(
      content: Text('Intent updated successfully'),
      backgroundColor: AppColors.success,
    ),
  );
}

class _IntentOption extends StatelessWidget {
  final String label;
  final bool isSelected;
  final VoidCallback onTap;

  const _IntentOption({
    required this.label,
    required this.isSelected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
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
