import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:permission_handler/permission_handler.dart';
import '../theme/app_theme.dart';

/// Matches web PermissionScreen.tsx exactly:
/// - bg #f7f9fb mesh-gradient
/// - Shield header card (64×64, white, rounded-2xl, rotate 3°, shadow-xl)
/// - "App Permissions" title (24px black, #191c1e)
/// - Subtitle (#424653)
/// - Permission items: white cards, left icon in slate-100 container, right "Allow" pill button
///   - GRANTED: emerald border, emerald bg icon, "Allowed" green button
///   - LOADING: slate button "Wait..."
///   - PROMPT: blue #0053c1 "Allow" button
/// - REQUIRED badge on required permissions
/// - Amber warning row at bottom of list
/// - Gradient "Continue" / "Grant Required Permissions" pill CTA

const _kRequired = ['location', 'battery', 'contacts'];

class _PermissionItem {
  final String id;
  final String name;
  final String description;
  final IconData icon;
  _PermState state;

  _PermissionItem({
    required this.id,
    required this.name,
    required this.description,
    required this.icon,
    this.state = _PermState.prompt,
  });
}

enum _PermState { prompt, loading, granted, denied }

class PermissionsScreen extends StatefulWidget {
  final VoidCallback? onNext;

  const PermissionsScreen({super.key, this.onNext});

  @override
  State<PermissionsScreen> createState() => _PermissionsScreenState();
}

class _PermissionsScreenState extends State<PermissionsScreen>
    with SingleTickerProviderStateMixin {
  late AnimationController _entryCtrl;

  final List<_PermissionItem> _permissions = [
    _PermissionItem(
      id: 'location',
      name: 'Location Access',
      description: 'Needed for vehicle tracking and emergency SOS features.',
      icon: Icons.location_on_outlined,
    ),
    _PermissionItem(
      id: 'battery',
      name: 'Battery Optimization',
      description: 'Allow app to run in background for consistent telemetry.',
      icon: Icons.battery_charging_full_outlined,
    ),
    _PermissionItem(
      id: 'contacts',
      name: 'Contacts Access',
      description: 'Required for referral features and emergency contacts.',
      icon: Icons.people_outline,
    ),
    _PermissionItem(
      id: 'call_log',
      name: 'Call Register',
      description: 'Access call logs for automated support validation.',
      icon: Icons.history_outlined,
    ),
    _PermissionItem(
      id: 'phone',
      name: 'Phone Access',
      description: 'Make direct calls to support and emergency services.',
      icon: Icons.phone_outlined,
    ),
    _PermissionItem(
      id: 'mic',
      name: 'Microphone Access',
      description: 'Used for voice notes in support tickets and SOS.',
      icon: Icons.mic_none_outlined,
    ),
    _PermissionItem(
      id: 'camera',
      name: 'Camera Access',
      description: 'Required for KYC document uploads and vehicle inspection.',
      icon: Icons.camera_alt_outlined,
    ),
    _PermissionItem(
      id: 'notifications',
      name: 'Push Notifications',
      description: 'Stay updated on rental expiry, low balance, and offers.',
      icon: Icons.notifications_none_outlined,
    ),
  ];

  @override
  void initState() {
    super.initState();
    _entryCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    )..forward();
  }

  @override
  void dispose() {
    _entryCtrl.dispose();
    super.dispose();
  }

  Future<void> _requestPermission(_PermissionItem item) async {
    setState(() => item.state = _PermState.loading);

    try {
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
        case 'notifications':
          status = await Permission.notification.request();
          break;
        case 'contacts':
          status = await Permission.contacts.request();
          break;
        case 'phone':
          status = await Permission.phone.request();
          break;
        case 'call_log':
          status = await Permission.phone.request(); // closest equivalent
          break;
        case 'battery':
          status = await Permission.ignoreBatteryOptimizations.request();
          break;
        default:
          await Future.delayed(const Duration(milliseconds: 800));
          status = PermissionStatus.granted;
      }

      if (status.isPermanentlyDenied) {
        openAppSettings();
      }

      setState(() {
        item.state = status.isGranted ? _PermState.granted : _PermState.denied;
      });
    } catch (_) {
      setState(() => item.state = _PermState.denied);
    }
  }

  bool get _allGranted =>
      _permissions.every((p) => p.state == _PermState.granted);

  bool get _requiredGranted => _kRequired.every(
        (id) => _permissions.firstWhere((p) => p.id == id).state ==
            _PermState.granted,
      );

  void _handleContinue() {
    if (_requiredGranted && widget.onNext != null) {
      widget.onNext!();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.surface,
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(20, 48, 20, 8),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // Header: Shield icon in white card (64×64, rotate 3°)
                    _buildHeader(),
                    const SizedBox(height: 40),

                    // Permission items
                    ..._permissions.asMap().entries.map(
                          (entry) => _buildPermissionItem(entry.key, entry.value),
                        ),

                    // Amber warning if not all granted
                    if (!_allGranted)
                      Padding(
                        padding: const EdgeInsets.only(top: 8, left: 8),
                        child: Row(
                          children: [
                            const Icon(
                              Icons.warning_amber_rounded,
                              size: 14,
                              color: Color(0xFFF59E0B),
                            ),
                            const SizedBox(width: 6),
                            Text(
                              'SOME PERMISSIONS ARE OPTIONAL BUT RECOMMENDED',
                              style: GoogleFonts.inter(
                                fontSize: 10,
                                fontWeight: FontWeight.w800,
                                color: const Color(0xFF92400E),
                                letterSpacing: 1.0,
                              ),
                            ),
                          ],
                        ),
                      ),

                    const SizedBox(height: 32),
                  ],
                ),
              ),
            ),

            // Footer CTA
            _buildFooterCta(),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader() {
    return FadeTransition(
      opacity: CurvedAnimation(parent: _entryCtrl, curve: Curves.easeIn),
      child: SlideTransition(
        position: Tween<Offset>(begin: const Offset(0, 0.3), end: Offset.zero)
            .animate(CurvedAnimation(parent: _entryCtrl, curve: Curves.easeOutCubic)),
        child: Column(
          children: [
            // Shield icon card — w-16 h-16 rounded-2xl bg-white shadow-xl rotate-3
            Transform.rotate(
              angle: 0.052, // 3 degrees in radians
              child: Container(
                width: 64,
                height: 64,
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(AppRadius.xl),
                  boxShadow: const [
                    BoxShadow(
                      color: Color(0x200F172A),
                      blurRadius: 24,
                      offset: Offset(0, 8),
                    ),
                  ],
                ),
                child: Transform.rotate(
                  angle: -0.052, // counter-rotate the icon (-rotate-3)
                  child: const Icon(
                    Icons.shield_outlined,
                    size: 32,
                    color: AppColors.primary,
                  ),
                ),
              ),
            ),
            const SizedBox(height: 24),
            Text(
              'App Permissions',
              style: GoogleFonts.inter(
                fontSize: 24,
                fontWeight: FontWeight.w900,
                color: AppColors.onSurfaceAlt,
                letterSpacing: -0.5,
              ),
            ),
            const SizedBox(height: 8),
            SizedBox(
              width: 280,
              child: Text(
                'Voltium requires certain permissions to provide a secure and seamless experience.',
                textAlign: TextAlign.center,
                style: GoogleFonts.inter(
                  fontSize: 14,
                  color: AppColors.onSurfaceVariant,
                  height: 1.6,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPermissionItem(int index, _PermissionItem perm) {
    final isRequired = _kRequired.contains(perm.id);
    final actionKey = {
      'location': const Key('allowLocationButton'),
      'battery': const Key('allowBatteryButton'),
      'contacts': const Key('allowContactsButton'),
      'call_log': const Key('allowCallLogsButton'),
      'phone': const Key('allowPhoneButton'),
      'mic': const Key('allowMicButton'),
      'camera': const Key('allowCameraButton'),
      'notifications': const Key('allowNotificationsButton'),
    }[perm.id];
    final isGranted = perm.state == _PermState.granted;
    final isLoading = perm.state == _PermState.loading;

    // Stagger animation matching web `transition={{ delay: 0.1 + idx * 0.1 }}`
    final delay = 0.1 + index * 0.06;
    final animation = CurvedAnimation(
      parent: _entryCtrl,
      curve: Interval(delay.clamp(0.0, 0.9), (delay + 0.3).clamp(0.0, 1.0),
          curve: Curves.easeOutCubic),
    );

    return FadeTransition(
      opacity: animation,
      child: SlideTransition(
        position:
            Tween<Offset>(begin: const Offset(-0.2, 0), end: Offset.zero)
                .animate(animation),
        child: Container(
          margin: const EdgeInsets.only(bottom: 12),
          decoration: BoxDecoration(
            color: isGranted
                ? const Color(0xFFF0FDF4) // emerald-50/10 approximation
                : Colors.white,
            borderRadius: BorderRadius.circular(AppRadius.xl),
            border: isGranted
                ? Border.all(color: AppColors.success.withOpacity(0.2))
                : null,
            boxShadow: AppShadows.card,
          ),
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                // Icon container
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: isGranted
                        ? AppColors.successLight
                        : AppColors.iconBackground,
                    borderRadius: BorderRadius.circular(AppRadius.lg),
                  ),
                  child: Icon(
                    isGranted ? Icons.check : perm.icon,
                    size: 20,
                    color: isGranted
                        ? AppColors.successDark
                        : AppColors.onSurfaceVariant,
                  ),
                ),
                const SizedBox(width: 16),

                // Title + description
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Flexible(
                            child: Text(
                              perm.name,
                              style: GoogleFonts.inter(
                                fontSize: 14,
                                fontWeight: FontWeight.w700,
                                color: AppColors.onSurfaceAlt,
                              ),
                            ),
                          ),
                          if (isRequired) ...[
                            const SizedBox(width: 6),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(
                                color: AppColors.primary.withOpacity(0.05),
                                borderRadius: BorderRadius.circular(999),
                                border: Border.all(
                                    color: AppColors.primary.withOpacity(0.1)),
                              ),
                              child: Text(
                                'REQUIRED',
                                style: GoogleFonts.inter(
                                  fontSize: 8,
                                  fontWeight: FontWeight.w900,
                                  color: AppColors.primary,
                                  letterSpacing: 0.5,
                                ),
                              ),
                            ),
                          ],
                        ],
                      ),
                      const SizedBox(height: 2),
                      Text(
                        perm.description,
                        style: GoogleFonts.inter(
                          fontSize: 11,
                          color: AppColors.onSurfaceVariant.withOpacity(0.7),
                          height: 1.5,
                        ),
                      ),
                    ],
                  ),
                ),

                const SizedBox(width: 12),

                // Allow / Allowed / Wait button
                GestureDetector(
                  key: actionKey,
                  onTap:
                      isGranted || isLoading ? null : () => _requestPermission(perm),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 200),
                    height: 36,
                    padding:
                        const EdgeInsets.symmetric(horizontal: 16),
                    decoration: BoxDecoration(
                      color: isGranted
                          ? AppColors.success
                          : isLoading
                              ? AppColors.iconBackground
                              : AppColors.primary,
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Center(
                      child: isLoading
                          ? const SizedBox(
                              width: 14,
                              height: 14,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: AppColors.onSurfaceVariant,
                              ),
                            )
                          : Text(
                              isGranted ? 'Allowed' : 'Allow',
                              style: GoogleFonts.inter(
                                fontSize: 10,
                                fontWeight: FontWeight.w900,
                                color: isGranted
                                    ? Colors.white
                                    : isLoading
                                        ? AppColors.onSurfaceVariant
                                        : Colors.white,
                                letterSpacing: 1.0,
                              ),
                            ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildFooterCta() {
    final label = _requiredGranted
        ? (_allGranted ? 'Get Started' : 'Continue')
        : 'Grant Required Permissions';

    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          GestureDetector(
            key: const Key('continuePermissionsButton'),
            onTap: _requiredGranted ? _handleContinue : null,
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              height: 56,
              decoration: BoxDecoration(
                gradient: _requiredGranted ? AppGradients.primary : null,
                color: _requiredGranted ? null : AppColors.slate400,
                borderRadius: BorderRadius.circular(999),
                boxShadow: _requiredGranted ? AppShadows.primaryButton : null,
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    label.toUpperCase(),
                    style: GoogleFonts.inter(
                      fontSize: 14,
                      fontWeight: FontWeight.w900,
                      color: Colors.white,
                      letterSpacing: 2.0,
                    ),
                  ),
                  const SizedBox(width: 8),
                  const Icon(Icons.chevron_right, color: Colors.white, size: 20),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),
          Text(
            'REQUIRED PERMISSIONS ENSURE SYSTEM RELIABILITY',
            style: GoogleFonts.inter(
              fontSize: 10,
              fontWeight: FontWeight.w700,
              color: AppColors.slate400,
              letterSpacing: 1.0,
            ),
          ),
        ],
      ),
    );
  }
}
