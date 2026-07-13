import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:voltium_rider/services/consent_service.dart';
import 'package:voltium_rider/theme/app_theme.dart';
import 'package:voltium_rider/utils/app_constants.dart';

import '../../../../core/platform/platform_info.dart';

import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/theme/app_typography.dart';

class _PermissionItem {
  final String id;
  final String name;
  final String description;
  final IconData icon;

  /// Whether the user MUST grant this permission to proceed past the
  /// permissions screen. `ignoreBatteryOptimizations` is not required
  /// because it lives in Android Settings (5+ taps) and only affects
  /// background reliability, not core functionality.
  final bool isRequired;
  bool isEnabled;

  _PermissionItem({
    required this.id,
    required this.name,
    required this.description,
    required this.icon,
    this.isRequired = true,
  }) : isEnabled = false;
}

class PermissionsScreen extends ConsumerStatefulWidget {
  final VoidCallback? onNext;

  const PermissionsScreen({super.key, this.onNext});

  @override
  ConsumerState<PermissionsScreen> createState() => _PermissionsScreenState();
}

class _PermissionsScreenState extends ConsumerState<PermissionsScreen>
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
      id: 'notifications',
      name: 'Notifications',
      description: 'Receive important updates and alerts',
      icon: Icons.notifications_active_outlined,
    ),
    _PermissionItem(
      id: 'battery',
      name: 'Battery Optimization',
      description: 'Allow the app to run reliably in the background.',
      icon: Icons.battery_saver_outlined,
      isRequired: true,
    ),
    _PermissionItem(
      id: 'camera',
      name: 'Camera',
      description: 'Document upload and QR scanning',
      icon: Icons.camera_alt_outlined,
    ),
    _PermissionItem(
      id: 'phone',
      name: 'Phone',
      description: 'Access device phone state for ride safety features',
      icon: Icons.phone_outlined,
    ),
    _PermissionItem(
      id: 'contacts',
      name: 'Contacts',
      description: 'Access contacts for emergency SOS and referrals',
      icon: Icons.contacts_outlined,
    ),
    _PermissionItem(
      id: 'call_log',
      name: 'Call Log',
      description: 'Access call logs for ride safety features',
      icon: Icons.call_outlined,
    ),
    _PermissionItem(
      id: 'mic',
      name: 'Microphone',
      description: 'Required for audio recording and verification',
      icon: Icons.mic_outlined,
    ),
    _PermissionItem(
      id: 'device_admin',
      name: 'Device Admin',
      description: 'Required for fleet security and remote lock features',
      icon: Icons.security_outlined,
    ),
  ];

  @override
  void initState() {
    super.initState();
    if (PlatformInfo.isWeb) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (widget.onNext != null) widget.onNext!();
      });
      return;
    }
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
      ref.read(appProvider).checkSystemPermissions();
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
        case 'notifications':
          status = await Permission.notification.status;
          break;
        case 'mic':
          status = await Permission.microphone.status;
          break;
        case 'contacts':
          status = await Permission.contacts.status;
          break;
        case 'phone':
          status = await Permission.phone.status;
          break;
        case 'call_log':
          status = await Permission.phone.status;
          break;
        case 'battery':
          status = await Permission.ignoreBatteryOptimizations.status;
          break;
        case 'device_admin':
          if (!mounted) return;
          perm.isEnabled = ref.read(appProvider).isAdminActive;
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
        if (status.isGranted) {
          final accuracy = await Geolocator.getLocationAccuracy();
          if (accuracy != LocationAccuracyStatus.precise) {
            status = PermissionStatus.denied;
            if (mounted) {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text(
                      'Precise location is required. Please enable it in Settings.'),
                  backgroundColor: Colors.red,
                ),
              );
            }
            await openAppSettings();
          }
        }
        break;
      case 'camera':
        status = await Permission.camera.request();
        break;
      case 'notifications':
        status = await Permission.notification.request();
        break;
      case 'mic':
        status = await Permission.microphone.request();
        break;
      case 'contacts':
        status = await Permission.contacts.request();
        break;
      case 'phone':
      case 'call_log':
        status = await Permission.phone.request();
        break;
      case 'battery':
        status = await Permission.ignoreBatteryOptimizations.request();
        if (mounted) {
          setState(() => item.isEnabled = status.isGranted);
        }
        return;
      case 'device_admin':
        await ref.read(appProvider).requestDeviceAdmin();
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
    final appProv = ref.watch(appProvider);

    // Sync reactive state to local list
    for (var p in _permissions) {
      if (p.id == 'device_admin') p.isEnabled = appProv.isAdminActive;
    }

    return Scaffold(
      backgroundColor: AppColors.surfaceHover,
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(24, 24, 24, 120),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    SizedBox(height: 20),
                    Text(
                      'Permissions',
                      style: AppTypography.headingLarge.copyWith(
                          color: AppColors.slate800, letterSpacing: -0.5),
                    ),
                    SizedBox(height: 8),
                    Text(
                      'Please allow the following permissions to ensure safety and functionality.',
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 14,
                        color: AppColors.slate600,
                      ),
                    ),
                    const SizedBox(height: 32),
                    ..._permissions.asMap().entries.map((entry) {
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
                    }),
                  ],
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
        border: Border.all(color: AppColors.surfaceSubtle),
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
          SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Flexible(
                      child: Text(
                        perm.name,
                        style: AppTypography.labelLarge
                            .copyWith(color: AppColors.slate900),
                      ),
                    ),
                  ],
                ),
                SizedBox(height: 4),
                Text(
                  perm.description,
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 12,
                    color: AppColors.textSecondary,
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
        child: Container(
          color: Colors.transparent,
          padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            width: 48,
            height: 24,
            decoration: BoxDecoration(
              color:
                  perm.isEnabled ? AppColors.primary : AppColors.borderDefault,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Stack(
              children: [
                AnimatedAlign(
                  duration: const Duration(milliseconds: 200),
                  alignment: perm.isEnabled
                      ? Alignment.centerRight
                      : Alignment.centerLeft,
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
        ));
  }

  Widget _buildFooter() {
    // Only required permissions gate the Continue button. Battery
    // optimization is optional (see _PermissionItem.isRequired).
    final allRequiredGranted =
        _permissions.where((p) => p.isRequired).every((p) => p.isEnabled);
    final isTestMode = AppConstants.isTestMode;
    final canProceed = allRequiredGranted || isTestMode;

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
            color: canProceed ? AppColors.primary : AppColors.borderSubtle,
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
              Text(
                'Continue',
                style: AppTypography.titleSmall.copyWith(
                    color: canProceed
                        ? Colors.white
                        : AppColors.onSurfaceDisabled),
              ),
              const SizedBox(width: 8),
              Icon(
                Icons.arrow_forward,
                color: canProceed ? Colors.white : AppColors.onSurfaceDisabled,
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
