import 'package:flutter/material.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:provider/provider.dart';
import 'package:voltium_rider/providers/app_provider.dart';
import 'package:voltium_rider/services/consent_service.dart';
import 'package:voltium_rider/theme/app_theme.dart';
import 'package:voltium_rider/utils/app_constants.dart';

class _PermissionItem {
  final String id;
  final String name;
  final String description;
  final IconData icon;
  bool isEnabled;

  _PermissionItem({
    required this.id,
    required this.name,
    required this.description,
    required this.icon,
  }) : isEnabled = false;
}

class PermissionsScreen extends StatefulWidget {
  final VoidCallback? onNext;

  const PermissionsScreen({super.key, this.onNext});

  @override
  State<PermissionsScreen> createState() => _PermissionsScreenState();
}

class _PermissionsScreenState extends State<PermissionsScreen>
    with SingleTickerProviderStateMixin, WidgetsBindingObserver {
  late AnimationController _entryCtrl;

  final List<_PermissionItem> _permissions = [
    _PermissionItem(
      id: 'location',
      name: 'Location',
      description: 'Track rides and find nearby vehicles',
      icon: Icons.location_on_outlined,
    ),
    _PermissionItem(
      id: 'battery',
      name: 'Opt out of Battery Optimization',
      description: 'Ensure app runs reliably in the background',
      icon: Icons.battery_saver_outlined,
    ),
    _PermissionItem(
      id: 'camera',
      name: 'Camera',
      description: 'Document upload and QR scanning',
      icon: Icons.camera_alt_outlined,
    ),
  ];

  @override
  void initState() {
    super.initState();
    _entryCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    )..forward();

    _checkInitialStatuses();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      // Re-check permissions when user returns to app
      _checkInitialStatuses();
      context.read<AppProvider>().checkSystemPermissions();
    }
  }

  Future<void> _checkInitialStatuses() async {
    for (var perm in _permissions) {
      if (!mounted) return;
      PermissionStatus status;
      switch (perm.id) {
        case 'location':
          status = await Permission.location.status;
          break;
        case 'camera':
          status = await Permission.camera.status;
          break;
        case 'mic':
          status = await Permission.microphone.status;
          break;
        case 'contacts':
          status = await Permission.contacts.status;
          break;
        case 'call_log':
          status = await Permission.phone.status;
          break;
        case 'phone':
          status = await Permission.phone.status;
          break;
        case 'battery':
          status = await Permission.ignoreBatteryOptimizations.status;
          break;
        case 'device_admin':
          if (!mounted) return;
          perm.isEnabled = context.read<AppProvider>().isAdminActive;
          continue;
        default:
          status = PermissionStatus.denied;
      }

      if (status.isGranted && mounted) {
        setState(() => perm.isEnabled = true);
        if (perm.id == 'location') {
          await ConsentService()
              .setConsent(ConsentType.location, granted: true);
        }
      }
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _entryCtrl.dispose();
    super.dispose();
  }

  Future<void> _togglePermission(_PermissionItem item) async {
    if (item.isEnabled) {
      return;
    }

    PermissionStatus status;
    switch (item.id) {
      case 'location':
        status = await Permission.location.request();
        break;
      case 'camera':
        status = await Permission.camera.request();
        break;
      case 'mic':
        status = await Permission.microphone.request();
        break;
      case 'contacts':
        status = await Permission.contacts.request();
        break;
      case 'call_log':
        status = await Permission.phone.request();
        break;
      case 'phone':
        status = await Permission.phone.request();
        break;
      case 'battery':
        status = await Permission.ignoreBatteryOptimizations.request();
        if (mounted) {
          setState(() => item.isEnabled = status.isGranted);
        }
        if (!status.isGranted) {
          openAppSettings();
        }
        return;
      case 'device_admin':
        await context.read<AppProvider>().requestDeviceAdmin();
        return;
      default:
        status = PermissionStatus.granted;
    }

    if (mounted) {
      setState(() => item.isEnabled = status.isGranted);
    }

    if (item.id == 'location') {
      await ConsentService().setConsent(
        ConsentType.location,
        granted: status.isGranted,
      );
    }

    if (status.isPermanentlyDenied) {
      openAppSettings();
    }
  }

  @override
  Widget build(BuildContext context) {
    final appProvider = context.watch<AppProvider>();

    // Sync reactive state to local list
    for (var p in _permissions) {
      if (p.id == 'device_admin') p.isEnabled = appProvider.isAdminActive;
    }

    return Scaffold(
      backgroundColor: const Color(0xFFF9F9FF),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(24, 24, 24, 120),
                child: Column(
                  children: _permissions.asMap().entries.map((entry) {
                    final delay = 0.1 + entry.key * 0.06;
                    final animation = CurvedAnimation(
                      parent: _entryCtrl,
                      curve: Interval(
                        delay.clamp(0.0, 0.9),
                        (delay + 0.3).clamp(0.0, 1.0),
                        curve: Curves.easeOutCubic,
                      ),
                    );

                    return FadeTransition(
                      opacity: animation,
                      child: SlideTransition(
                        position: Tween<Offset>(
                          begin: const Offset(0, 0.15),
                          end: Offset.zero,
                        ).animate(animation),
                        child: _buildPermissionCard(entry.value),
                      ),
                    );
                  }).toList(),
                ),
              ),
            ),
            _buildFooter(),
          ],
        ),
      ),
    );
  }

  Widget _buildPermissionCard(_PermissionItem perm) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFF3F4F6)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 10,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: AppColors.primary.withValues(alpha: 0.1),
              shape: BoxShape.circle,
            ),
            child: Icon(
              perm.icon,
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
                  perm.name,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF141B2B),
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  perm.description,
                  style: const TextStyle(
                    fontSize: 12,
                    color: Color(0xFF4B5563),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          _buildToggle(perm),
        ],
      ),
    );
  }

  Widget _buildToggle(_PermissionItem perm) {
    return GestureDetector(
      key: Key('allow${perm.id.capitalize()}Button'),
      onTap: () => _togglePermission(perm),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        width: 48,
        height: 24,
        decoration: BoxDecoration(
          color: perm.isEnabled ? AppColors.primary : const Color(0xFFD1D5DB),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Stack(
          children: [
            AnimatedAlign(
              duration: const Duration(milliseconds: 200),
              alignment:
                  perm.isEnabled ? Alignment.centerRight : Alignment.centerLeft,
              child: Container(
                margin: const EdgeInsets.all(2),
                width: 20,
                height: 20,
                decoration: const BoxDecoration(
                  color: Colors.white,
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black12,
                      blurRadius: 2,
                      offset: Offset(0, 1),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFooter() {
    final allGranted = _permissions.every((p) => p.isEnabled);
    final isTestMode = AppConstants.isTestMode;
    final canProceed = allGranted || isTestMode;

    return Container(
      padding: const EdgeInsets.fromLTRB(24, 16, 24, 32),
      decoration: BoxDecoration(
        color: Colors.white,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 20,
            offset: const Offset(0, -4),
          ),
        ],
      ),
      child: GestureDetector(
        key: const Key('continuePermissionsButton'),
        behavior: HitTestBehavior.opaque,
        onTap: canProceed
            ? () {
                if (widget.onNext != null) widget.onNext!();
              }
            : null,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          height: 56,
          decoration: BoxDecoration(
            color: canProceed ? AppColors.primary : const Color(0xFFE5E7EB),
            borderRadius: BorderRadius.circular(12),
            boxShadow: canProceed
                ? [
                    BoxShadow(
                      color: AppColors.primary.withValues(alpha: 0.3),
                      blurRadius: 12,
                      offset: const Offset(0, 4),
                    ),
                  ]
                : null,
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text('Continue',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                  color: canProceed ? Colors.white : const Color(0xFF9CA3AF),
                ),
              ),
              const SizedBox(width: 8),
              Icon(
                Icons.arrow_forward,
                color: canProceed ? Colors.white : const Color(0xFF9CA3AF),
                size: 20,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

extension on String {
  String capitalize() =>
      isEmpty ? this : '${this[0].toUpperCase()}${substring(1)}';
}
