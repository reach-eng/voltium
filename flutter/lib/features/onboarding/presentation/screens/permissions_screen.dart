import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:voltium_rider/services/consent_service.dart';
import 'package:voltium_rider/theme/app_theme.dart';
import 'package:voltium_rider/utils/app_constants.dart';
import 'package:voltium_rider/utils/toast.dart';

import '../../../../core/platform/platform_info.dart';

import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/theme/app_typography.dart';

class _PermissionItem {
  final String id;
  final IconData icon;
  final bool isRequired;
  bool isEnabled;

  _PermissionItem({
    required this.id,
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
      icon: Icons.location_on_outlined,
    ),
    _PermissionItem(
      id: 'notifications',
      icon: Icons.notifications_active_outlined,
    ),
    _PermissionItem(
      id: 'battery',
      icon: Icons.battery_saver_outlined,
      isRequired: false,
    ),
    _PermissionItem(
      id: 'camera',
      icon: Icons.camera_alt_outlined,
    ),
    _PermissionItem(
      id: 'phone',
      icon: Icons.phone_outlined,
      isRequired: false,
    ),
    _PermissionItem(
      id: 'contacts',
      icon: Icons.contacts_outlined,
      isRequired: false,
    ),
    _PermissionItem(
      id: 'mic',
      icon: Icons.mic_outlined,
      isRequired: false,
    ),
    _PermissionItem(
      id: 'device_admin',
      icon: Icons.security_outlined,
      isRequired: false,
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
      ref.read(devicePolicyProvider.notifier).checkSystemPermissions();
    }
  }

  /// Maps an onboarding permission tile to its backend consent type so the
  /// grant is recorded for EVERY requested permission (PR-VER-2026-08-07
  /// FLUTTER_CONSENT P1-1) — previously only location/contacts synced.
  ConsentType? _consentTypeFor(String permissionId) {
    switch (permissionId) {
      case 'location':
        return ConsentType.location;
      case 'contacts':
        return ConsentType.contacts;
      case 'camera':
        return ConsentType.camera;
      case 'phone':
        return ConsentType.phone;
      case 'mic':
        return ConsentType.mic;
      case 'battery':
        return ConsentType.battery;
      case 'notifications':
        return ConsentType.notifications;
      case 'device_admin':
        return ConsentType.deviceAdmin;
      default:
        return null;
    }
  }

  String _getPermName(BuildContext context, String id) {
    final l10n = AppLocalizations.of(context)!;
    switch (id) {
      case 'location':
        return l10n.txtlocationPermName;
      case 'notifications':
        return l10n.txtnotificationsPermName;
      case 'battery':
        return l10n.txtbatteryPermName;
      case 'camera':
        return l10n.txtcameraPermName;
      case 'phone':
        return l10n.txtphonePermName;
      case 'contacts':
        return l10n.txtcontactsPermName;
      case 'mic':
        return l10n.txtmicPermName;
      case 'device_admin':
        return l10n.txtdeviceAdminPermName;
      default:
        return id;
    }
  }

  String _getPermDesc(BuildContext context, String id) {
    final l10n = AppLocalizations.of(context)!;
    switch (id) {
      case 'location':
        return l10n.txtlocationPermDesc;
      case 'notifications':
        return l10n.txtnotificationsPermDesc;
      case 'battery':
        return l10n.txtbatteryPermDesc;
      case 'camera':
        return l10n.txtcameraPermDesc;
      case 'phone':
        return l10n.txtphonePermDesc;
      case 'contacts':
        return l10n.txtcontactsPermDesc;
      case 'mic':
        return l10n.txtmicPermDesc;
      case 'device_admin':
        return l10n.txtdeviceAdminPermDesc;
      default:
        return '';
    }
  }

  String? _getPermTooltip(BuildContext context, String id) {
    if (id == 'phone') {
      return AppLocalizations.of(context)!.txtphonePermTooltip;
    }
    return null;
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
        case 'battery':
          status = await Permission.ignoreBatteryOptimizations.status;
          break;
        case 'device_admin':
          if (!mounted) return;
          perm.isEnabled = ref.read(devicePolicyProvider).isAdminActive;
          continue;
        default:
          status = PermissionStatus.denied;
      }

      if (status.isGranted && mounted) {
        setState(() => perm.isEnabled = true);
        final consent = _consentTypeFor(perm.id);
        if (consent != null) {
          await ConsentService().setConsent(consent, granted: true);
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
    await _requestPermission(item);
  }

  Future<void> _requestPermission(_PermissionItem item) async {
    PermissionStatus status;

    switch (item.id) {
      case 'location':
        status = await Permission.locationWhenInUse.request();
        if (status.isGranted) {
          final accuracy = await Geolocator.getLocationAccuracy();
          if (accuracy != LocationAccuracyStatus.precise) {
            status = PermissionStatus.denied;
            if (mounted) {
              Toast.error(
                context,
                AppLocalizations.of(context)!.txtpreciseLocationRequired,
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
        status = await Permission.phone.request();
        break;
      case 'battery':
        status = await Permission.ignoreBatteryOptimizations.request();
        if (mounted) {
          setState(() => item.isEnabled = status.isGranted);
        }
        return;
      case 'device_admin':
        await ref.read(devicePolicyProvider.notifier).requestDeviceAdmin();
        return;
      default:
        status = PermissionStatus.granted;
    }

    if (mounted) {
      setState(() => item.isEnabled = status.isGranted);
    }

    final consent = _consentTypeFor(item.id);
    if (consent != null) {
      await ConsentService().setConsent(consent, granted: status.isGranted);
    }

    if (status.isPermanentlyDenied) {
      openAppSettings();
    }
  }

  @override
  Widget build(BuildContext context) {
    final devPolicy = ref.watch(devicePolicyProvider);
    final colors = AppColors.of(context);
    final l10n = AppLocalizations.of(context)!;

    // Sync reactive state to local list
    for (var p in _permissions) {
      if (p.id == 'device_admin') p.isEnabled = devPolicy.isAdminActive;
    }

    return Scaffold(
      backgroundColor: colors.surface,
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(24, 24, 24, 120),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const SizedBox(height: 20),
                    Text(
                      l10n.txtpermissionsTitle,
                      style: AppTypography.headingLarge.copyWith(
                        color: colors.onSurface,
                        letterSpacing: -0.5,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      l10n.txtpermissionsSubtitle,
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 14,
                        color: colors.onSurfaceVariant,
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
    final colors = AppColors.of(context);
    final name = _getPermName(context, perm.id);
    final description = _getPermDesc(context, perm.id);
    final tooltip = _getPermTooltip(context, perm.id);

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: Spacing.paddingMd,
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        border: Border.all(color: colors.outline.withValues(alpha: 0.2)),
        boxShadow: AppShadows.card,
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
                Row(
                  children: [
                    Flexible(
                      child: Text(
                        name,
                        style: AppTypography.labelLarge
                            .copyWith(color: colors.onSurface),
                      ),
                    ),
                    if (tooltip != null) ...[
                      const SizedBox(width: 6),
                      Tooltip(
                        message: tooltip,
                        triggerMode: TooltipTriggerMode.tap,
                        child: Icon(
                          Icons.info_outline,
                          size: 16,
                          color: colors.onSurfaceVariant,
                        ),
                      ),
                    ],
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  description,
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 12,
                    color: colors.onSurfaceVariant,
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
    final colors = AppColors.of(context);
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
              color: perm.isEnabled
                  ? AppColors.primary
                  : colors.outline.withValues(alpha: 0.3),
              borderRadius: BorderRadius.circular(AppRadius.md),
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
    final colors = AppColors.of(context);
    final l10n = AppLocalizations.of(context)!;

    // Only required permissions gate the Continue button. Battery
    // optimization is optional (see _PermissionItem.isRequired).
    final allRequiredGranted =
        _permissions.where((p) => p.isRequired).every((p) => p.isEnabled);
    final isTestMode = AppConstants.isTestMode;
    final canProceed = allRequiredGranted || isTestMode;

    return Container(
      padding: const EdgeInsets.fromLTRB(24, 16, 24, 32),
      decoration: BoxDecoration(
        color: colors.card,
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
            color: canProceed
                ? AppColors.primary
                : colors.outline.withValues(alpha: 0.2),
            borderRadius: BorderRadius.circular(AppRadius.md),
            boxShadow: canProceed ? AppShadows.primaryButton : null,
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                l10n.txtcontinue,
                style: AppTypography.titleSmall.copyWith(
                    color: canProceed ? Colors.white : colors.onSurfaceMuted),
              ),
              const SizedBox(width: 8),
              Icon(
                Icons.arrow_forward,
                color: canProceed ? Colors.white : colors.onSurfaceMuted,
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
