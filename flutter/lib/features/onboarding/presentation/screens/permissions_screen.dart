import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:voltium_rider/services/consent_service.dart';
import 'package:voltium_rider/features/device_compliance/presentation/providers/device_policy_provider.dart'
    show DevicePolicyState;
import 'package:voltium_rider/theme/app_theme.dart';
import 'package:voltium_rider/utils/app_logger.dart';
import 'package:voltium_rider/utils/toast.dart';

import '../../../../core/platform/platform_info.dart';

import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/theme/app_typography.dart';

class _PermissionItem {
  final String id;
  final IconData icon;
  bool isEnabled;

  _PermissionItem({
    required this.id,
    required this.icon,
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
      id: 'background_location',
      icon: Icons.my_location_outlined,
    ),
    _PermissionItem(
      id: 'notifications',
      icon: Icons.notifications_active_outlined,
    ),
    _PermissionItem(
      id: 'battery',
      icon: Icons.battery_saver_outlined,
    ),
    _PermissionItem(
      id: 'camera',
      icon: Icons.camera_alt_outlined,
    ),
    _PermissionItem(
      id: 'phone',
      icon: Icons.phone_outlined,
    ),
    // PR-A §6.4: READ_CALL_LOG was removed from the onboarding list —
    // it was never used for functionality and violates least privilege.
    // `phone` already rides on the same runtime permission.
    _PermissionItem(
      id: 'contacts',
      icon: Icons.contacts_outlined,
    ),
    _PermissionItem(
      id: 'mic',
      icon: Icons.mic_outlined,
    ),
    _PermissionItem(
      id: 'device_admin',
      icon: Icons.security_outlined,
    ),
  ];

  @override
  void initState() {
    super.initState();
    // AUDIT FIX: the controller MUST be created before the web early-return.
    // Previously `build()` (`parent: _entryCtrl`) and `dispose()` threw a
    // LateInitializationError on web because the controller was never
    // created on that path.
    _entryCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    )..forward();

    if (PlatformInfo.isWeb) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (widget.onNext != null) widget.onNext!();
      });
      return;
    }

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
      case 'background_location':
        return ConsentType.location;
      case 'contacts':
        return ConsentType.contacts;
      case 'call_log':
        return ConsentType.callLogs;
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
      case 'background_location':
        return l10n.txtbackgroundLocationPermName;
      case 'notifications':
        return l10n.txtnotificationsPermName;
      case 'battery':
        return l10n.txtbatteryPermName;
      case 'camera':
        return l10n.txtcameraPermName;
      case 'phone':
        return l10n.txtphonePermName;
      case 'call_log':
        return l10n.txtcallLogPermName;
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
      case 'background_location':
        return l10n.txtbackgroundLocationPermDesc;
      case 'notifications':
        return l10n.txtnotificationsPermDesc;
      case 'battery':
        return l10n.txtbatteryPermDesc;
      case 'camera':
        return l10n.txtcameraPermDesc;
      case 'phone':
        return l10n.txtphonePermDesc;
      case 'call_log':
        return l10n.txtcallLogPermDesc;
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

  /// Records a consent grant/revocation. `ConsentService.setConsent` writes
  /// to secure storage OUTSIDE its internal try/catch — a storage failure
  /// must not crash the permission flow, so every call site goes through
  /// this guarded wrapper.
  Future<void> _recordConsent(ConsentType? type, bool granted) async {
    if (type == null) return;
    try {
      await ConsentService().setConsent(type, granted: granted);
    } catch (e) {
      appDebug('Failed to record consent for $type: $e', tag: 'PERMISSIONS');
    }
  }

  Future<void> _checkInitialStatuses() async {
    for (var perm in _permissions) {
      if (!mounted) return;
      PermissionStatus status;
      switch (perm.id) {
        case 'location':
          status = await Permission.locationWhenInUse.status;
          break;
        case 'background_location':
          status = await Permission.locationAlways.status;
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
          final wasAdminActive = perm.isEnabled;
          final adminActive = ref.read(devicePolicyProvider).isAdminActive;
          if (adminActive != wasAdminActive) {
            setState(() => perm.isEnabled = adminActive);
            // AUDIT FIX: record the consent transition (grant or revoke)
            // instead of silently ignoring device_admin.
            await _recordConsent(_consentTypeFor(perm.id), adminActive);
          }
          continue;
        default:
          status = PermissionStatus.denied;
      }

      // AUDIT FIX (revoke detection): this previously only ever set
      // `isEnabled = true` with no else-branch — a rider who revoked a
      // permission in OS Settings and returned still saw the tile green,
      // keeping `allRequiredGranted` true and bypassing the compulsory
      // permissions gate. Assign the real status and record consent only
      // on state transitions.
      final wasEnabled = perm.isEnabled;
      final isGranted = status.isGranted;
      if (!mounted) return;
      if (isGranted != wasEnabled) {
        setState(() => perm.isEnabled = isGranted);
        await _recordConsent(_consentTypeFor(perm.id), isGranted);
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
      // PR-10 (F-077 — 2026-08-22 deep audit): the previous
      // tile was a no-op once the permission was already
      // granted — tapping it did nothing. A rider who
      // accidentally granted the wrong permission (e.g.
      // location "always" instead of "while using") had no
      // path to revoke it from the onboarding screen. Now
      // open the OS app settings page so the rider can
      // toggle it off.
      await openAppSettings();
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
      case 'background_location':
        status = await Permission.locationAlways.request();
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
        // AUDIT FIX: battery previously `return`ed before the consent
        // block, so its grant was never recorded even though it maps to
        // ConsentType.battery.
        await _recordConsent(_consentTypeFor(item.id), status.isGranted);
        return;
      case 'device_admin':
        await ref.read(devicePolicyProvider.notifier).requestDeviceAdmin();
        if (mounted) {
          final adminActive = ref.read(devicePolicyProvider).isAdminActive;
          setState(() => item.isEnabled = adminActive);
          // AUDIT FIX: same consent gap as battery.
          await _recordConsent(_consentTypeFor(item.id), adminActive);
        }
        return;
      default:
        status = PermissionStatus.granted;
    }

    if (mounted) {
      setState(() => item.isEnabled = status.isGranted);
    }

    await _recordConsent(_consentTypeFor(item.id), status.isGranted);

    if (status.isPermanentlyDenied) {
      openAppSettings();
    }
  }

  @override
  Widget build(BuildContext context) {
    final devPolicy = ref.watch(devicePolicyProvider);
    final colors = AppColors.of(context);
    final l10n = AppLocalizations.of(context)!;

    // AUDIT FIX: removed the side-effectful `_permissions` mutation that
    // used to run during build. Device-admin state is now read from the
    // provider at the point of use (see `_effectiveEnabled` / footer).

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
                          child: _buildPermissionCard(
                            entry.value,
                            devPolicy: devPolicy,
                          ),
                        ),
                      );
                    }),
                  ],
                ),
              ),
            ),
            _buildFooter(devPolicy: devPolicy),
          ],
        ),
      ),
    );
  }

  /// Device-admin state lives in the provider, not the local list — read
  /// it at the point of use instead of mutating during build.
  bool _effectiveEnabled(_PermissionItem perm, DevicePolicyState devPolicy) {
    return perm.id == 'device_admin' ? devPolicy.isAdminActive : perm.isEnabled;
  }

  Widget _buildPermissionCard(
    _PermissionItem perm, {
    required DevicePolicyState devPolicy,
  }) {
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
          _buildToggle(perm, devPolicy: devPolicy),
        ],
      ),
    );
  }

  Widget _buildToggle(
    _PermissionItem perm, {
    required DevicePolicyState devPolicy,
  }) {
    final colors = AppColors.of(context);
    final isEnabled = _effectiveEnabled(perm, devPolicy);
    return Semantics(
        toggled: isEnabled,
        button: true,
        label: '${_getPermName(context, perm.id)} permission',
        child: GestureDetector(
            key: Key('allow${perm.id.capitalize()}Button'),
            onTap: () => _togglePermission(perm),
            child: Container(
              color: Colors.transparent,
              // AUDIT FIX: 12px vertical padding + 24px track = 48dp
              // minimum touch target (was 44dp).
              padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                width: 48,
                height: 24,
                decoration: BoxDecoration(
                  color: isEnabled
                      ? AppColors.primary
                      : colors.outline.withValues(alpha: 0.3),
                  borderRadius: BorderRadius.circular(AppRadius.md),
                ),
                child: Stack(
                  children: [
                    AnimatedAlign(
                      duration: const Duration(milliseconds: 200),
                      alignment: isEnabled
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
            )));
  }

  Widget _buildFooter({required DevicePolicyState devPolicy}) {
    final colors = AppColors.of(context);
    final l10n = AppLocalizations.of(context)!;

    // Every permission on this screen is now compulsory (PR-6
    // 2026-08-21). The Continue button stays disabled until all tiles
    // are green; the router's `_areAllRequiredPermissionsGranted`
    // enforces the same set on the way out.
    //
    // PR-9 (F-070 — 2026-08-22 deep audit): `background_location`
    // (Android `ACCESS_BACKGROUND_LOCATION`) is NOT required
    // for the core rider flow — `locationWhenInUse` covers the
    // "rider is on the dashboard" case. The previous
    // implementation blocked onboarding on always-on location,
    // which is a Play Store policy violation (Google requires
    // a clear in-context trigger before requesting it). Now
    // the tile is shown but excluded from the required set;
    // the rider can grant it later from a settings tile if
    // they want background trip-tracking.
    final requiredPermissions =
        _permissions.where((p) => p.id != 'background_location').toList();
    final allRequiredGranted =
        requiredPermissions.every((p) => _effectiveEnabled(p, devPolicy));
    // PR-1 (F-001): the `|| isTestMode` short-circuit was removed. The
    // Continue button is now enabled only when every required permission
    // (foreground_location, notifications, contacts) is granted. The
    // integration-test harness grants permissions via
    // `Permission.locationWhenInUse.request()` / `mock` shims in test
    // setup; the screen no longer lies about the user's actual grants.
    final canProceed = allRequiredGranted;

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
