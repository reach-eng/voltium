import 'package:flutter/material.dart';
import '../models/hub_model.dart';
import '../services/api_service.dart';
import '../theme/app_theme.dart';

class PickupHubScreen extends StatefulWidget {
  final VoidCallback onNext;

  const PickupHubScreen({super.key, required this.onNext});

  @override
  State<PickupHubScreen> createState() => _PickupHubScreenState();
}

class _PickupHubScreenState extends State<PickupHubScreen> {
  List<HubModel> _hubs = [];
  bool _isLoading = true;
  String? _error;
  String? _selectedHubId;

  @override
  void initState() {
    super.initState();
    _fetchHubs();
  }

  Future<void> _fetchHubs() async {
    try {
      final response = await ApiService().fetchHubs();
      if (response['success'] == true) {
        final List<dynamic> data = response['data'] ?? [];
        setState(() {
          _hubs = data.map((e) => HubModel.fromJson(e as Map<String, dynamic>)).toList();
          _isLoading = false;
        });
      } else {
        setState(() {
          _error = response['message'] ?? 'Failed to load hubs';
          _isLoading = false;
        });
      }
    } catch (e) {
      setState(() {
        _error = 'Connection error. Please try again.';
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.surface,
      appBar: AppBar(
        title: const Text('Select Pickup Hub'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => Navigator.of(context).pop(),
        ),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(_error!, style: const TextStyle(color: AppColors.error)),
                      const SizedBox(height: 16),
                      ElevatedButton(onPressed: _fetchHubs, child: const Text('Retry')),
                    ],
                  ),
                )
              : SafeArea(
                  child: Column(
                    children: [
                      Expanded(
                        child: ListView.builder(
                          padding: const EdgeInsets.all(Spacing.lg),
                          itemCount: _hubs.length,
                          itemBuilder: (context, index) {
                            final hub = _hubs[index];
                            final isSelected = _selectedHubId == hub.id;

                            return GestureDetector(
                              key: const Key('hubCard'),
                              onTap: () => setState(() => _selectedHubId = hub.id),
                              child: AnimatedContainer(
                                duration: const Duration(milliseconds: 200),
                                margin: const EdgeInsets.only(bottom: 12),
                                padding: const EdgeInsets.all(Spacing.md),
                                decoration: BoxDecoration(
                                  color: Colors.white,
                                  borderRadius: BorderRadius.circular(AppRadius.lg),
                                  border: Border.all(
                                    color: isSelected ? AppColors.primary : AppColors.outlineVariant,
                                    width: isSelected ? 2 : 1,
                                  ),
                                ),
                                child: Row(
                                  children: [
                                    Container(
                                      width: 48,
                                      height: 48,
                                      decoration: BoxDecoration(
                                        color: isSelected ? AppColors.primaryLight : AppColors.surface,
                                        shape: BoxShape.circle,
                                      ),
                                      child: Icon(
                                        Icons.location_on,
                                        color: isSelected ? AppColors.primary : AppColors.onSurfaceVariant,
                                      ),
                                    ),
                                    const SizedBox(width: 16),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            hub.name,
                                            style: const TextStyle(
                                              fontWeight: FontWeight.bold,
                                              fontSize: 16,
                                              color: AppColors.onSurface,
                                            ),
                                          ),
                                          Text(
                                            hub.address,
                                            style: const TextStyle(
                                              fontSize: 13,
                                              color: AppColors.onSurfaceVariant,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                    Radio<String>(
                                      value: hub.id,
                                      groupValue: _selectedHubId,
                                      onChanged: (val) => setState(() => _selectedHubId = val),
                                      activeColor: AppColors.primary,
                                    ),
                                  ],
                                ),
                              ),
                            );
                          },
                        ),
                      ),
                      Padding(
                        padding: const EdgeInsets.all(Spacing.lg),
                        child: ElevatedButton(
                          key: const Key('confirmHubButton'),
                          onPressed: _selectedHubId == null ? null : widget.onNext,
                          child: const Text('Confirm Hub'),
                        ),
                      ),
                    ],
                  ),
                ),
    );
  }
}
