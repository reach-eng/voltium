import 'package:universal_io/io.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:image_picker/image_picker.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:voltium_rider/services/voltium_api_service.dart';
import 'package:voltium_rider/services/image_compression_service.dart';
import 'package:voltium_rider/theme/app_theme.dart';
import 'package:voltium_rider/utils/app_constants.dart';

import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/theme/app_typography.dart';
import 'package:voltium_rider/core/observability/posthog_service.dart';

class EndRentalScreen extends ConsumerStatefulWidget {
  final VoidCallback? onBack;
  final VoidCallback? onSuccess;

  const EndRentalScreen({super.key, this.onBack, this.onSuccess});

  @override
  ConsumerState<EndRentalScreen> createState() => _EndRentalScreenState();
}

class _EndRentalScreenState extends ConsumerState<EndRentalScreen>
    with SingleTickerProviderStateMixin {
  final _odometerCtrl = TextEditingController();
  final Map<String, XFile?> _photos = {
    'left': null,
    'right': null,
    'front': null,
    'speedometer': null,
  };
  bool _confirmed = false;
  bool _submitting = false;
  bool _submitted = false;

  Future<void> _takePhoto(String key) async {
    if (AppConstants.isTestMode) {
      setState(() => _photos[key] = XFile('mock_photo.png'));
      return;
    }
    final file = await ImageCompressionService()
        .pickAndCompress(source: ImageSource.camera);
    if (file != null && mounted) {
      setState(() => _photos[key] = XFile(file.path));
    }
  }

  void _showPhotoOptionsDialog(String key, String label) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: Theme.of(ctx).colorScheme.surface,
        title: Text(
          '$label Photo',
          style: AppTypography.titleMedium
              .copyWith(color: Theme.of(ctx).colorScheme.onSurface),
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: Icon(Icons.refresh_rounded,
                  color: Theme.of(ctx).colorScheme.primary),
              title: Text('Retake Photo',
                  style: TextStyle(color: Theme.of(ctx).colorScheme.onSurface)),
              onTap: () {
                Navigator.pop(ctx);
                _takePhoto(key);
              },
            ),
            ListTile(
              leading: const Icon(Icons.delete_outline, color: AppColors.error),
              title: const Text('Remove Photo',
                  style: TextStyle(color: AppColors.error)),
              onTap: () {
                Navigator.pop(ctx);
                setState(() => _photos[key] = null);
              },
            ),
            ListTile(
              leading: Icon(Icons.close,
                  color: Theme.of(ctx).colorScheme.onSurfaceVariant),
              title: Text('Cancel',
                  style: TextStyle(
                      color: Theme.of(ctx).colorScheme.onSurfaceVariant)),
              onTap: () => Navigator.pop(ctx),
            ),
          ],
        ),
      ),
    );
  }

  late final AnimationController _entryCtrl;

  @override
  void initState() {
    super.initState();
    _entryCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    )..forward();
    _odometerCtrl.addListener(() {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _odometerCtrl.dispose();
    _entryCtrl.dispose();
    super.dispose();
  }

  bool get _allPhotosTaken => _photos.values.every((v) => v != null);
  bool get _canSubmit =>
      _allPhotosTaken &&
      _odometerCtrl.text.trim().isNotEmpty &&
      _confirmed &&
      !_submitting;

  Future<void> _handleReturn() async {
    if (!_canSubmit) return;
    setState(() => _submitting = true);

    try {
      final rider = ref.read(riderProvider).rider;
      final riderId = rider?.riderId ?? '';
      final List<String> photoUrls = [];
      for (final entry in _photos.entries) {
        if (entry.value != null) {
          final url = await VoltiumApiService()
              .uploadFile(File(entry.value!.path), 'RETURN_PHOTO');
          photoUrls.add(url);
        }
      }
      if (!mounted) return;
      await VoltiumApiService().submitVehicleReturn(
        riderId: riderId,
        photoUrls: photoUrls,
        reason: 'End of rental – odometer: ${_odometerCtrl.text.trim()}',
      );

      PostHogService.capture('rental_ended', properties: {
        'photo_count': photoUrls.length.toString(),
      });
      if (mounted) {
        setState(() {
          _submitting = false;
          _submitted = true;
        });
        await Future.delayed(const Duration(seconds: 2));
        if (mounted) widget.onSuccess?.call();
      }
    } catch (e) {
      if (mounted) {
        setState(() => _submitting = false);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Error submitting return. Please try again.'),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    final colors = AppColors.of(context);

    if (_submitted) {
      return Scaffold(
        backgroundColor: colorScheme.surface,
        body: SafeArea(
          child: Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Container(
                  width: 80,
                  height: 80,
                  decoration: const BoxDecoration(
                    color: AppColors.successLight,
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.check,
                    color: AppColors.successDark,
                    size: 40,
                  ),
                ),
                const SizedBox(height: 24),
                Text(
                  'Request Submitted!',
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 24,
                    fontWeight: FontWeight.w700,
                    color: colorScheme.onSurface,
                  ),
                ),
                const SizedBox(height: 12),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 48),
                  child: Text(
                    'Your vehicle return request has been sent for approval.',
                    textAlign: TextAlign.center,
                    style: GoogleFonts.plusJakartaSans(
                      fontSize: 15,
                      color: colorScheme.onSurfaceVariant,
                      height: 1.6,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      );
    }

    return Scaffold(
      backgroundColor: colorScheme.surface,
      body: SafeArea(
        child: Column(
          children: [
            // Header
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
              child: Row(
                children: [
                  GestureDetector(
                    onTap: widget.onBack ?? () => Navigator.maybePop(context),
                    child: Container(
                      width: 44,
                      height: 44,
                      decoration: BoxDecoration(
                        color: colors.card,
                        shape: BoxShape.circle,
                        boxShadow: AppShadows.glass,
                      ),
                      child: Icon(
                        Icons.arrow_back,
                        size: 18,
                        color: colorScheme.onSurface,
                      ),
                    ),
                  ),
                  const SizedBox(width: 16),
                  Text(
                    'End Rental',
                    style: AppTypography.titleLarge
                        .copyWith(fontSize: 21)
                        .copyWith(color: colorScheme.onSurface),
                  ),
                ],
              ),
            ),

            // Content
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
                child: Column(
                  children: [
                    // Warning card
                    _buildWarningCard(colorScheme),
                    const SizedBox(height: 20),

                    // Photo grid
                    _buildPhotoGrid(colorScheme, colors),
                    const SizedBox(height: 20),

                    // Odometer
                    _buildOdometer(colorScheme, colors),
                    const SizedBox(height: 16),

                    // Battery
                    _buildBattery(colorScheme, colors),
                    const SizedBox(height: 16),

                    // Checkbox
                    _buildCheckbox(colorScheme, colors),
                    const SizedBox(height: 24),

                    // Confirm button
                    _buildConfirmButton(colorScheme),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildWarningCard(ColorScheme colorScheme) {
    return Container(
      padding: Spacing.paddingMd,
      decoration: BoxDecoration(
        color: AppColors.errorLight,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        border: Border.all(color: AppColors.errorBorder, width: 2),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: const BoxDecoration(
              color: AppColors.errorLight,
              shape: BoxShape.circle,
            ),
            child: const Icon(
              Icons.warning_amber_rounded,
              color: AppColors.errorDark,
              size: 20,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Are you sure?',
                  style: AppTypography.labelLarge
                      .copyWith(color: AppColors.errorDark),
                ),
                const SizedBox(height: 4),
                Text(
                  'Returning your vehicle will end your current rental period. Make sure to complete all inspection steps.',
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 12,
                    color: AppColors.error.withValues(alpha: 0.8),
                    height: 1.6,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPhotoGrid(ColorScheme colorScheme, ThemeColors colors) {
    final slots = [
      {
        'key': 'left',
        'label': 'Left Side',
        'hint': 'Full side view of vehicle'
      },
      {
        'key': 'right',
        'label': 'Right Side',
        'hint': 'Full side view of vehicle'
      },
      {
        'key': 'front',
        'label': 'Front View',
        'hint': 'Stand 2m back, include full front'
      },
      {
        'key': 'speedometer',
        'label': 'Speedometer',
        'hint': 'Clear photo of odometer reading'
      },
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'RETURN INSPECTION',
          style: AppTypography.bodySmall
              .copyWith(fontWeight: FontWeight.w800)
              .copyWith(color: colorScheme.onSurface, letterSpacing: 1.2),
        ),
        const SizedBox(height: 6),
        Text(
          'Take return photos of your vehicle',
          style: GoogleFonts.plusJakartaSans(
            fontSize: 12,
            color: colorScheme.onSurfaceVariant,
          ),
        ),
        const SizedBox(height: 12),
        GridView.count(
          crossAxisCount: 2,
          crossAxisSpacing: 12,
          mainAxisSpacing: 12,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          children: slots.map((slot) {
            final key = slot['key']!;
            final photo = _photos[key];
            final taken = photo != null;
            return GestureDetector(
              key: Key('photoSlot_$key'),
              onTap: () => taken
                  ? _showPhotoOptionsDialog(key, slot['label']!)
                  : _takePhoto(key),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                decoration: BoxDecoration(
                  color: taken ? AppColors.successLight : colors.card,
                  borderRadius: BorderRadius.circular(AppRadius.lg),
                  border: Border.all(
                    color: taken ? AppColors.greenFill : AppColors.divider,
                    width: taken ? 2 : 1,
                  ),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(8.0),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      taken
                          ? ClipRRect(
                              borderRadius: BorderRadius.circular(AppRadius.sm),
                              child: Image.file(
                                File(photo.path),
                                width: 100,
                                height: 100,
                                fit: BoxFit.cover,
                              ),
                            )
                          : Icon(
                              Icons.camera_alt_outlined,
                              size: 24,
                              color: colorScheme.onSurfaceVariant,
                            ),
                      const SizedBox(height: 6),
                      Text(
                        slot['label']!,
                        style: AppTypography.bodySmall
                            .copyWith(fontWeight: FontWeight.w600)
                            .copyWith(
                                color: taken
                                    ? AppColors.onSurface
                                    : colorScheme.onSurfaceVariant),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        slot['hint']!,
                        textAlign: TextAlign.center,
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 9,
                          color: colorScheme.onSurfaceVariant
                              .withValues(alpha: 0.7),
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
              ),
            );
          }).toList(),
        ),
      ],
    );
  }

  Widget _buildOdometer(ColorScheme colorScheme, ThemeColors colors) {
    return Container(
      padding: Spacing.paddingMd,
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        boxShadow: AppShadows.card,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'ODOMETER READING *',
            style: AppTypography.labelMedium.copyWith(
                color: colorScheme.onSurfaceVariant, letterSpacing: 1.2),
          ),
          const SizedBox(height: 8),
          TextFormField(
            key: const Key('odometerField'),
            controller: _odometerCtrl,
            keyboardType: TextInputType.number,
            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
            style: AppTypography.bodyMedium
                .copyWith(fontWeight: FontWeight.w600)
                .copyWith(color: colorScheme.onSurface),
            decoration: InputDecoration(
              hintText: 'Enter current odometer reading',
              hintStyle: GoogleFonts.plusJakartaSans(
                fontSize: 14,
                color: AppColors.onSurfaceDisabled,
              ),
              filled: true,
              fillColor: AppColors.inputBackground,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(AppRadius.md),
                borderSide: BorderSide.none,
              ),
              contentPadding:
                  const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBattery(ColorScheme colorScheme, ThemeColors colors) {
    final rider = ref.watch(riderProvider).rider;
    final double? batteryVal = rider?.batteryPercent;
    final String batteryText = batteryVal != null
        ? 'Current battery: ${batteryVal.toInt()}%'
        : 'Battery level: Unavailable';

    return Container(
      padding: Spacing.paddingMd,
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        boxShadow: AppShadows.card,
      ),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: AppColors.successLight,
              borderRadius: BorderRadius.circular(AppRadius.md),
            ),
            child: const Icon(
              Icons.battery_5_bar,
              color: AppColors.successDark,
              size: 18,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Battery Level',
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 12,
                    color: colorScheme.onSurfaceVariant,
                  ),
                ),
                Text(
                  batteryText,
                  style: AppTypography.labelLarge
                      .copyWith(color: colorScheme.onSurface),
                ),
              ],
            ),
          ),
          SizedBox(
            width: 80,
            child: ClipRRect(
              borderRadius: BorderRadius.circular(AppRadius.xs),
              child: LinearProgressIndicator(
                value: batteryVal != null
                    ? (batteryVal / 100.0).clamp(0.0, 1.0)
                    : 0.0,
                backgroundColor: AppColors.divider,
                valueColor: const AlwaysStoppedAnimation(AppColors.success),
                minHeight: 8,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCheckbox(ColorScheme colorScheme, ThemeColors colors) {
    return GestureDetector(
      key: const Key('confirmCheckbox'),
      onTap: () => setState(() => _confirmed = !_confirmed),
      child: Container(
        padding: Spacing.paddingMd,
        decoration: BoxDecoration(
          color: colors.card,
          borderRadius: BorderRadius.circular(AppRadius.lg),
          boxShadow: AppShadows.card,
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              width: 20,
              height: 20,
              margin: const EdgeInsets.only(top: 2),
              decoration: BoxDecoration(
                color: _confirmed ? AppColors.primary : Colors.transparent,
                borderRadius: BorderRadius.circular(AppRadius.xs),
                border: Border.all(
                  color: _confirmed ? AppColors.primary : AppColors.divider,
                  width: 2,
                ),
              ),
              child: _confirmed
                  ? const Icon(Icons.check, color: Colors.white, size: 14)
                  : null,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                'I confirm the vehicle is returned in good condition with all accessories intact.',
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 12,
                  color: colorScheme.onSurface,
                  height: 1.6,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildConfirmButton(ColorScheme colorScheme) {
    return Column(
      children: [
        GestureDetector(
          key: const Key('submitReturnButton'),
          onTap: _canSubmit ? _handleReturn : null,
          child: Container(
            width: double.infinity,
            height: 56,
            decoration: BoxDecoration(
              color: _canSubmit ? AppColors.errorDark : AppColors.divider,
              borderRadius: BorderRadius.circular(AppRadius.full),
              boxShadow: _canSubmit
                  ? const [
                      BoxShadow(
                        color: AppColors.dangerShadow,
                        blurRadius: 24,
                        offset: Offset(0, 8),
                      ),
                    ]
                  : null,
            ),
            child: Center(
              child: _submitting
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                        color: Colors.white,
                        strokeWidth: 2,
                      ),
                    )
                  : Text(
                      'Confirm Return',
                      style: AppTypography.labelLarge
                          .copyWith(fontWeight: FontWeight.w700)
                          .copyWith(
                              color: _canSubmit
                                  ? colorScheme.onPrimary
                                  : AppColors.onSurfaceDisabled),
                    ),
            ),
          ),
        ),
        if (!_canSubmit && !_allPhotosTaken) ...[
          const SizedBox(height: 8),
          Text(
            'Please take all inspection photos and enter odometer reading to continue',
            style: GoogleFonts.plusJakartaSans(
              fontSize: 12,
              color: AppColors.error,
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ],
    );
  }
}
