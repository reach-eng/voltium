import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

class PickupVehicleScreen extends StatefulWidget {
  final VoidCallback onNext;

  const PickupVehicleScreen({super.key, required this.onNext});

  @override
  State<PickupVehicleScreen> createState() => _PickupVehicleScreenState();
}

class _PickupVehicleScreenState extends State<PickupVehicleScreen> {
  final TextEditingController _vehicleIdController = TextEditingController();
  final _formKey = GlobalKey<FormState>();

  @override
  void dispose() {
    _vehicleIdController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.surface,
      appBar: AppBar(
        title: const Text('Connect Vehicle'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => Navigator.of(context).pop(),
        ),
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(Spacing.lg),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Enter Vehicle ID',
                  style: TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.w900,
                    color: AppColors.onSurface,
                  ),
                ),
                const SizedBox(height: 8),
                const Text(
                  'Locate the ID on the moped frame or QR code provided at the hub.',
                  style: TextStyle(
                    fontSize: 15,
                    color: AppColors.onSurfaceVariant,
                    height: 1.4,
                  ),
                ),
                const SizedBox(height: 32),
                
                TextFormField(
                  key: const Key('vehicleIdField'),
                  controller: _vehicleIdController,
                  decoration: const InputDecoration(
                    labelText: 'Vehicle ID (e.g. VF-001)',
                    hintText: 'Enter ID',
                    prefixIcon: Icon(Icons.electric_moped),
                  ),
                  textCapitalization: TextCapitalization.characters,
                  validator: (val) {
                    if (val == null || val.isEmpty) return 'Please enter vehicle ID';
                    return null;
                  },
                ),
                const Spacer(),
                ElevatedButton(
                  key: const Key('verifyVehicleButton'),
                  onPressed: () {
                    if (_formKey.currentState?.validate() ?? false) {
                      widget.onNext();
                    }
                  },
                  child: const Text('Verify Vehicle'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
