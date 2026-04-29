import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

class PickupInspectionScreen extends StatefulWidget {
  final VoidCallback onNext;

  const PickupInspectionScreen({super.key, required this.onNext});

  @override
  State<PickupInspectionScreen> createState() => _PickupInspectionScreenState();
}

class _PickupInspectionScreenState extends State<PickupInspectionScreen> {
  final List<Map<String, dynamic>> _checklist = [
    {'title': 'Battery level check', 'done': false},
    {'title': 'Tire pressure & condition', 'done': false},
    {'title': 'Brake functionality', 'done': false},
    {'title': 'Lights & indicators', 'done': false},
    {'title': 'Side stand / Center stand', 'done': false},
    {'title': 'Overall frame condition', 'done': false},
    {'title': 'Helmet provided', 'done': false},
  ];

  bool get _allDone => _checklist.every((item) => item['done'] == true);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.surface,
      appBar: AppBar(
        title: const Text('Vehicle Inspection'),
      ),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: ListView.builder(
                padding: const EdgeInsets.all(Spacing.lg),
                itemCount: _checklist.length,
                itemBuilder: (context, index) {
                  final item = _checklist[index];
                  return CheckboxListTile(
                    key: Key('inspectionItem${index + 1}'),
                    title: Text(item['title'], style: const TextStyle(fontWeight: FontWeight.w600)),
                    value: item['done'],
                    onChanged: (val) {
                      setState(() {
                        _checklist[index]['done'] = val;
                      });
                    },
                    controlAffinity: ListTileControlAffinity.trailing,
                    activeColor: AppColors.success,
                    checkboxShape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
                  );
                },
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(Spacing.lg),
              child: ElevatedButton(
                key: const Key('capturePickupPhotoButton'),
                onPressed: _allDone ? widget.onNext : null,
                child: const Text('Capture Pickup Photo'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
