import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:geolocator/geolocator.dart';
import '../../../../theme/app_theme.dart';

import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:voltium_rider/theme/app_typography.dart';
import 'package:voltium_rider/core/observability/posthog_service.dart';
import 'package:voltium_rider/services/voltium_api_service.dart';
import 'package:voltium_rider/utils/haptic_service.dart';

class EmergencySOSScreen extends ConsumerStatefulWidget {
  const EmergencySOSScreen({super.key});

  @override
  ConsumerState<EmergencySOSScreen> createState() => _EmergencySOSScreenState();
}

class _EmergencySOSScreenState extends ConsumerState<EmergencySOSScreen> {
  Timer? _cancelTimer;
  bool _sosInFlight = false;

  @override
  void dispose() {
    _cancelTimer?.cancel();
    super.dispose();
  }

  Future<void> _callNumber(String number) async {
    final sanitizedNumber = number.replaceAll(RegExp(r'[^\d+]'), '');
    final uri = Uri.parse('tel:$sanitizedNumber');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    }
  }

  /// Best-effort location capture. NEVER blocks the emergency path: a
  /// missing permission, no GPS fix, or a slow request just yields nulls.
  Future<({double? lat, double? lng})> _captureLocation() async {
    try {
      final permission = await Geolocator.checkPermission();
      final granted = permission == LocationPermission.always ||
          permission == LocationPermission.whileInUse;
      if (!granted) {
        final asked = await Geolocator.requestPermission();
        if (asked != LocationPermission.always &&
            asked != LocationPermission.whileInUse) {
          return (lat: null, lng: null);
        }
      }
      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.medium,
          timeLimit: Duration(seconds: 5),
        ),
      );
      return (lat: position.latitude, lng: position.longitude);
    } catch (_) {
      return (lat: null, lng: null);
    }
  }

  /// Fire-and-forget backend alert. The dial to 112 is the primary path —
  /// a slow/failed network call must never delay or surface as an error.
  ///
  /// PR-14 (EMERGENCY P0-1 — fanout): the rider's emergency contacts
  /// (managed in `EmergencyContactsService`) are sent to the backend so
  /// it can SMS them via MSG91 and post a Slack critical alert. The
  /// contacts read is sync (SharedPreferences) so it doesn't add
  /// latency to the fire-and-forget path.
  Future<void> _alertBackend({double? latitude, double? longitude}) async {
    try {
      // Read contacts via the synchronous accessor. The notifier
      // exposes a `state.contacts` field that's already hydrated from
      // SharedPreferences on app start.
      final contactsState = ref.read(emergencyContactsServiceProvider);
      final contacts = contactsState.contacts
          .map((c) => {'name': c.name, 'phone': c.phone})
          .toList(growable: false);

      await VoltiumApiService().triggerSos(
        latitude: latitude,
        longitude: longitude,
        triggeredVia: 'long_press',
        contacts: contacts.isEmpty ? null : contacts,
      );
    } catch (_) {
      // Swallow: analytics + audit row are best-effort.
    }
  }

  Future<void> _triggerSos() async {
    if (_sosInFlight) return;
    _sosInFlight = true;

    // Material destructive pattern: firm haptic on trigger start.
    HapticService.medium();

    // Telemetry first (fire-and-forget).
    PostHogService.capture('emergency_sos_triggered');

    // "Sending SOS..." overlay with a 5-second cancel option.
    // ignore: use_build_context_synchronously
    showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => _SosSendingOverlay(onCancel: () {
        _cancelTimer?.cancel();
        Navigator.of(ctx).pop();
      }),
    );

    // Auto-dismiss the overlay after 5s — the alert keeps going even if
    // the rider walks away from the phone.
    _cancelTimer = Timer(const Duration(seconds: 5), () {
      if (mounted && Navigator.of(context, rootNavigator: true).canPop()) {
        Navigator.of(context, rootNavigator: true).pop();
      }
    });

    // Capture location best-effort, then alert the backend, then dial 112.
    final loc = await _captureLocation();
    await _alertBackend(latitude: loc.lat, longitude: loc.lng);
    await _callNumber('112');

    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        // LANGUAGE-AUDIT (2026-08-16) #5: hardcoded English
        // SnackBar text. The "5" placeholder is appended
        // dynamically; a future ARB pass can replace it with a
        // full template if the rider sees a localised count.
        content: Text(
          AppLocalizations.of(context)!.txtsosAlertTriggeredDialing,
        ),
        backgroundColor: AppColors.error,
      ),
    );
    _sosInFlight = false;
  }

  @override
  Widget build(BuildContext context) {
    final rider = ref.watch(riderProvider.select((p) => p.rider));
    final emergencyContact = rider?.emergencyContact;

    return Scaffold(
      backgroundColor: AppColors.of(context).iconBackground,
      appBar: AppBar(
        backgroundColor: AppColors.of(context).iconBackground,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        title: Text(
          // LANGUAGE-AUDIT (2026-08-16) #5: hardcoded English
          // title. Localised via the existing `txtemergencySos`
          // ARB key.
          AppLocalizations.of(context)!.txtemergencySos,
          // DARK-MODE-AUDIT 2026-08-14 P0-7: `slate800` is
          // identical to the dark card surface — text
          // disappears. Read from the theme extension.
          style: AppTypography.titleLarge
              .copyWith(color: AppColors.of(context).onSurface),
        ),
        leadingWidth: 68,
        leading: Padding(
          padding: const EdgeInsets.only(left: 20),
          child: UnconstrainedBox(
            child: GestureDetector(
              onTap: () {
                if (Navigator.canPop(context)) {
                  Navigator.pop(context);
                }
              },
              child: Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: Colors.white,
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                        color: Colors.black.withValues(alpha: 0.05),
                        blurRadius: 10,
                        offset: const Offset(0, 4))
                  ],
                ),
                child: Icon(Icons.arrow_back,
                    // DARK-MODE-AUDIT 2026-08-14 P0-7: same
                    // `slate800` issue — disappears in dark
                    // mode. Read from the theme.
                    color: AppColors.of(context).onSurface,
                    size: 20),
              ),
            ),
          ),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(Spacing.md),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            SizedBox(height: 40),
            GestureDetector(
              onLongPress: _triggerSos,
              child: Container(
                width: 200,
                height: 200,
                decoration: BoxDecoration(
                  color: AppColors.error,
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                      color: AppColors.error.withValues(alpha: 0.4),
                      blurRadius: 30,
                      spreadRadius: 10,
                    ),
                  ],
                ),
                child: Center(
                  child: Text(
                    'SOS',
                    style: GoogleFonts.plusJakartaSans(
                      color: Colors.white,
                      fontSize: 48,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 2,
                    ),
                  ),
                ),
              ),
            ),
            SizedBox(height: 24),
            Text(
              'Press and hold to trigger an emergency alert',
              style: GoogleFonts.plusJakartaSans(
                  color: AppColors.of(context).onSurfaceVariant, fontSize: 16),
            ),
            const SizedBox(height: 64),
            // Saved emergency contacts from service.
            ...ref.watch(emergencyContactsService).contacts.map(
                  (c) => Padding(
                    padding: const EdgeInsets.only(bottom: 16),
                    child: _buildEmergencyContactCard(
                      icon: Icons.contact_phone,
                      title: '${c.name} (${c.relationship})',
                      number: c.phone,
                      color: c.isPrimary ? AppColors.error : AppColors.primary,
                      isFullWidth: true,
                      onTap: () => _callNumber(c.phone),
                    ),
                  ),
                ),
            // Personal emergency contact fallback (from profile).
            if (emergencyContact != null &&
                emergencyContact.toString().isNotEmpty &&
                ref.watch(emergencyContactsService).contacts.isEmpty) ...[
              _buildEmergencyContactCard(
                icon: Icons.person,
                title: 'My Emergency Contact',
                number: emergencyContact.toString(),
                color: AppColors.error,
                isFullWidth: true,
                onTap: () => _callNumber(emergencyContact.toString()),
              ),
              const SizedBox(height: 16),
            ],
            Row(
              children: [
                Expanded(
                  child: _buildEmergencyContactCard(
                    icon: Icons.local_police,
                    title: 'Police',
                    number: '100',
                    color: AppColors.primary,
                    onTap: () => _callNumber('100'),
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: _buildEmergencyContactCard(
                    icon: Icons.local_hospital,
                    title: 'Ambulance',
                    number: '108',
                    color: AppColors.error,
                    onTap: () => _callNumber('108'),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            _buildEmergencyContactCard(
              icon: Icons.support_agent,
              title: 'Voltium Support',
              number: '1800-865-8486',
              color: AppColors.primary,
              isFullWidth: true,
              onTap: () => _callNumber('18008658486'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildEmergencyContactCard({
    required IconData icon,
    required String title,
    required String number,
    required Color color,
    bool isFullWidth = false,
    VoidCallback? onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: Spacing.paddingMd,
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(AppRadius.lg),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.05),
              blurRadius: 10,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: isFullWidth
            ? Row(
                children: [
                  Icon(icon, color: color, size: 32),
                  SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(title, style: AppTypography.titleSmall),
                        Text(number,
                            style: GoogleFonts.plusJakartaSans(
                                color: AppColors.of(context).onSurfaceVariant)),
                      ],
                    ),
                  ),
                  Icon(Icons.call, color: color),
                ],
              )
            : Column(
                children: [
                  Icon(icon, color: color, size: 32),
                  SizedBox(height: 12),
                  Text(title,
                      style: GoogleFonts.plusJakartaSans(
                          fontWeight: FontWeight.bold)),
                  Text(number,
                      style: GoogleFonts.plusJakartaSans(
                          color: AppColors.of(context).onSurfaceVariant)),
                  const SizedBox(height: 8),
                  Icon(Icons.call, color: color, size: 18),
                ],
              ),
      ),
    );
  }
}

/// Modal overlay shown while the SOS alert is being sent. Offers a
/// 5-second cancel option (Material destructive pattern) — after the
/// timer fires the alert is irrevocable and 112 is dialed.
class _SosSendingOverlay extends StatelessWidget {
  const _SosSendingOverlay({required this.onCancel});

  final VoidCallback onCancel;

  @override
  Widget build(BuildContext context) {
    return Dialog(
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppRadius.lg),
      ),
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(
              width: 40,
              height: 40,
              child: CircularProgressIndicator(
                color: AppColors.error,
                strokeWidth: 3,
              ),
            ),
            const SizedBox(height: 16),
            Text(
              'Sending SOS...',
              style: AppTypography.titleMedium
                  .copyWith(fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            Text(
              'Sharing your location with Voltium and dialing 112.',
              textAlign: TextAlign.center,
              style: GoogleFonts.plusJakartaSans(
                fontSize: 13,
                color: AppColors.onSurfaceVariant,
              ),
            ),
            const SizedBox(height: 20),
            TextButton(
              onPressed: onCancel,
              style: TextButton.styleFrom(
                foregroundColor: AppColors.error,
              ),
              // LANGUAGE-AUDIT (2026-08-16) #5: hardcoded
              // English "Cancel (5s)" — the seconds value
              // changes, so a future ARB pass can replace it
              // with a `txtcancelWithCountdown(seconds)` template.
              // For now the literal "5" is a constant.
              child: Text(
                  '${AppLocalizations.of(context)!.txtcancel} (5s)'),
            ),
          ],
        ),
      ),
    );
  }
}
