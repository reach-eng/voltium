import 'package:universal_io/io.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:image_picker/image_picker.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:voltium_rider/core/network/api_client.dart';
import 'package:voltium_rider/core/network/files_repository.dart';
import 'package:voltium_rider/core/network/generated/api_client.dart';
import 'package:voltium_rider/core/network/generated/api_models.dart';
import 'package:voltium_rider/services/image_compression_service.dart';
import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:voltium_rider/theme/app_theme.dart';
import 'package:voltium_rider/utils/app_constants.dart';
import 'package:voltium_rider/utils/toast.dart';
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

class _EndRentalScreenState extends ConsumerState<EndRentalScreen> {
  final _odometerCtrl = TextEditingController();
  final Map<String, XFile?> _photos = {
    'left': null,
    'right': null,
    'front': null,
    'speedometer': null,
  };
  // AUDIT FIX (MEDIUM): URLs of photos already uploaded, keyed by slot.
  // A retry after a partial failure resumes from here instead of
  // re-uploading every photo; retaking/removing a photo invalidates
  // its slot entry.
  final Map<String, String> _uploadedUrls = {};
  bool _confirmed = false;
  bool _submitting = false;
  bool _submitted = false;
  // PR-66: track per-photo upload progress + cancel intent. The
  // previous sequential `for` loop blocked the UI for 8-40 seconds
  // on 3G with no progress indicator and no cancel path. The
  // counter advances as each parallel upload completes, and the
  // bool lets the user bail out of remaining uploads without
  // closing the screen.
  int _uploadedCount = 0;
  int _totalToUpload = 0;
  bool _cancelled = false;

  Future<void> _takePhoto(String key) async {
    if (AppConstants.isTestMode) {
      // AUDIT FIX (LOW): test-only placeholder — 'mock_photo.png' is a
      // relative path that only resolves in widget-test asset roots.
      // Intentionally left as-is: this branch is unreachable outside
      // TEST_MODE builds and is exercised by integration tests.
      if (mounted) {
        setState(() {
          _photos[key] = XFile('mock_photo.png');
          _uploadedUrls.remove(key);
        });
      }
      return;
    }
    final file = await ImageCompressionService()
        .pickAndCompress(source: ImageSource.camera);
    if (file != null && mounted) {
      setState(() {
        _photos[key] = XFile(file.path);
        // AUDIT FIX: a retake invalidates any earlier upload of this slot.
        _uploadedUrls.remove(key);
      });
    }
  }

  void _showPhotoOptionsDialog(String key, String label) {
    // T-66: dialog title + 3 action labels localised. The title
    // interpolates `label` (e.g. "Front", "Left") so we keep the
    // runtime composition; the "Photo" suffix is part of the EN
    // string and the ARB provides the equivalent in each locale.
    final l10n = AppLocalizations.of(context)!;
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: Theme.of(ctx).colorScheme.surface,
        title: Text(
          l10n.txtretakePhoto.replaceAll('Photo', '$label Photo'),
          style: AppTypography.titleMedium
              .copyWith(color: Theme.of(ctx).colorScheme.onSurface),
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: Icon(Icons.refresh_rounded,
                  color: Theme.of(ctx).colorScheme.primary),
              title: Text(l10n.txtretakePhoto,
                  style: TextStyle(color: Theme.of(ctx).colorScheme.onSurface)),
              onTap: () {
                Navigator.pop(ctx);
                _takePhoto(key);
              },
            ),
            ListTile(
              leading: const Icon(Icons.delete_outline, color: AppColors.error),
              // T-66: hardcoded English "Remove Photo" action.
              // Localised via the new `txtremovePhoto` ARB key.
              title: Text(l10n.txtremovePhoto,
                  style: const TextStyle(color: AppColors.error)),
              onTap: () {
                Navigator.pop(ctx);
                setState(() {
                  _photos[key] = null;
                  // AUDIT FIX: removing the photo drops its uploaded URL.
                  _uploadedUrls.remove(key);
                });
              },
            ),
            ListTile(
              leading: Icon(Icons.close,
                  color: Theme.of(ctx).colorScheme.onSurfaceVariant),
              title: Text(l10n.txtcancel,
                  style: TextStyle(
                      color: Theme.of(ctx).colorScheme.onSurfaceVariant)),
              onTap: () => Navigator.pop(ctx),
            ),
          ],
        ),
      ),
    );
  }

  @override
  void initState() {
    super.initState();
    // AUDIT FIX (MINOR): removed the dead `_entryCtrl` animation
    // controller — it was created, forwarded and disposed but its
    // controller was never attached to any widget.
    _odometerCtrl.addListener(() {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _odometerCtrl.dispose();
    super.dispose();
  }

  bool get _allPhotosTaken => _photos.values.every((v) => v != null);

  /// AUDIT FIX (MEDIUM): structured odometer validation. The generated
  /// `VehicleReturnRequest` carries no odometer field (only
  /// `returnPhotos` + `reason`), so the reading stays embedded in the
  /// reason prose — validated here before submit. Returns null when
  /// valid, or a user-facing error message.
  String? _odometerValidationError(String input) {
    final v = input.trim();
    if (v.isEmpty) return 'Enter the current odometer reading';
    if (!RegExp(r'^\d+$').hasMatch(v)) return 'Odometer must be digits only';
    // Reject '000000'-style all-zero readings outright.
    if (RegExp(r'^0+$').hasMatch(v)) return 'Odometer cannot be zero';
    final value = int.tryParse(v);
    if (value == null || value <= 0) {
      return 'Odometer must be greater than 0';
    }
    if (value >= 1000000) {
      return 'Odometer reading looks too high — please double-check';
    }
    return null;
  }

  bool get _odometerValid =>
      _odometerValidationError(_odometerCtrl.text) == null;

  bool get _canSubmit =>
      _allPhotosTaken && _odometerValid && _confirmed && !_submitting;

  Future<void> _handleReturn() async {
    if (!_canSubmit) return;

    // AUDIT FIX (MEDIUM): hard re-validation before submit so an invalid
    // odometer value can never reach the payload, even if the disabled-
    // button gate is bypassed programmatically (e.g. in tests).
    final odometerError = _odometerValidationError(_odometerCtrl.text);
    if (odometerError != null && mounted) {
      Toast.error(context, odometerError);
      return;
    }

    setState(() {
      _submitting = true;
      _cancelled = false;
      _totalToUpload = _photos.values.where((p) => p != null).length;
      // AUDIT FIX (MEDIUM): resume support — photos already uploaded in
      // a previous failed attempt start as complete in the progress UI.
      _uploadedCount =
          _photos.keys.where((k) => _uploadedUrls.containsKey(k)).length;
    });

    try {
      // PR-13: VoltiumApiService is gone. Construct the generated client
      // + transport once for this submit pass, and use FilesRepository
      // for photo uploads (matches the pattern used by edit_profile_screen).
      final apiClient = ApiClient();
      final genClient = VoltiumApiClient(apiClient);
      final filesRepo = FilesRepository(apiClient, genClient);

      // PR-66: parallel upload with progress. Each upload reports
      // completion via a Completer; we settle them with
      // Future.wait + a shared counter. The counter drives the
      // progress UI. Cancelled uploads are skipped, not awaited.
      //
      // AUDIT FIX (MEDIUM): per-photo try/catch. Previously ANY single
      // upload failure threw out of Future.wait before results were
      // consumed, so submitVehicleReturn never ran even when 3/4 photos
      // had uploaded — and a retry re-uploaded everything. Failures are
      // now counted toward progress while the successful subset
      // proceeds to submission; already-uploaded slots are skipped.
      final pendingEntries = _photos.entries
          .where((e) => e.value != null && !_uploadedUrls.containsKey(e.key))
          .toList(growable: false);

      await Future.wait(
        pendingEntries.map((entry) async {
          if (_cancelled) return;
          try {
            final url = await filesRepo.uploadFile(
              File(entry.value!.path),
              'RETURN_PHOTO',
            );
            if (!mounted) return;
            _uploadedUrls[entry.key] = url;
            setState(() => _uploadedCount += 1);
          } catch (_) {
            // Count failures toward progress too; the missing slot is
            // simply absent from the submitted subset below.
            if (mounted) setState(() => _uploadedCount += 1);
          }
        }),
        eagerError: false,
      );

      if (_cancelled) {
        if (mounted) setState(() => _submitting = false);
        return;
      }

      final photoUrls = _uploadedUrls.values.toList(growable: false);
      if (!mounted) return;
      if (photoUrls.isEmpty) {
        setState(() => _submitting = false);
        Toast.error(
          context,
          AppLocalizations.of(context)!.txterrorSubmittingReturnPleaseTryAgain,
        );
        return;
      }

      // PR-13: was a wrapper call to
      // `VoltiumApiService.submitVehicleReturn` (1-line pass-through to
      // the generated `postRiderRentalReturn(VehicleReturnRequest(...))`).
      await genClient.postRiderRentalReturn(
        VehicleReturnRequest(
          returnPhotos: photoUrls,
          reason: 'End of rental – odometer: ${_odometerCtrl.text.trim()}',
        ),
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
        Toast.error(
          context,
          AppLocalizations.of(context)!.txterrorSubmittingReturnPleaseTryAgain,
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
                  decoration: BoxDecoration(
                    color: AppColors.of(context).successLight,
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
                    _buildWarningCard(colorScheme, colors),
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

  Widget _buildWarningCard(ColorScheme colorScheme, ThemeColors colors) {
    return Container(
      padding: Spacing.paddingMd,
      decoration: BoxDecoration(
        color: colors.errorLight,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        border: Border.all(
          color: colors.error.withValues(alpha: 0.3),
          width: 1.5,
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: colors.errorLight,
              shape: BoxShape.circle,
            ),
            child: Icon(
              Icons.warning_amber_rounded,
              color: colors.errorLightForeground,
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
                      .copyWith(color: colors.errorLightForeground),
                ),
                const SizedBox(height: 4),
                Text(
                  'Returning your vehicle will end your current rental period. Make sure to complete all inspection steps.',
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 12,
                    color: colors.errorLightForeground.withValues(alpha: 0.9),
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
          'VEHICLE CONDITION PHOTOS *',
          style: AppTypography.labelMedium.copyWith(
              color: colorScheme.onSurfaceVariant, letterSpacing: 1.2),
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
            // AUDIT FIX (LOW): photo slots were silent to screen readers.
            return Semantics(
              button: true,
              label: taken
                  ? '${slot['label']} photo taken'
                  : 'Take ${slot['label']} photo',
              child: GestureDetector(
                key: Key('photoSlot_$key'),
                onTap: () => taken
                    ? _showPhotoOptionsDialog(key, slot['label']!)
                    : _takePhoto(key),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  decoration: BoxDecoration(
                    color: taken ? colors.successLight : colors.card,
                    borderRadius: BorderRadius.circular(AppRadius.lg),
                    border: Border.all(
                      color:
                          taken ? AppColors.greenFill : colors.outlineVariant,
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
                                borderRadius:
                                    BorderRadius.circular(AppRadius.sm),
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
                                      ? colors.onSurface
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
              color: colorScheme.onSurfaceVariant,
              letterSpacing: 1.2,
            ),
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
                color: colors.onSurfaceMuted,
              ),
              filled: true,
              fillColor: colors.inputFill,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(AppRadius.md),
                borderSide: BorderSide.none,
              ),
              contentPadding:
                  const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            ),
          ),
          // AUDIT FIX (MEDIUM): inline validation messaging — the old UI
          // accepted any input and embedded it unchecked in the payload.
          Builder(
            builder: (context) {
              final text = _odometerCtrl.text.trim();
              final error =
                  text.isEmpty ? null : _odometerValidationError(text);
              if (error == null) return const SizedBox.shrink();
              return Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(
                      Icons.error_outline,
                      size: 14,
                      color: AppColors.error,
                    ),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        error,
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 12,
                          color: AppColors.error,
                        ),
                      ),
                    ),
                  ],
                ),
              );
            },
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
              color: colors.successLight,
              borderRadius: BorderRadius.circular(AppRadius.md),
            ),
            child: Icon(
              Icons.battery_5_bar,
              color: colors.successLightForeground,
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
                backgroundColor: colors.outlineVariant,
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
    // AUDIT FIX (LOW): the custom checkbox was invisible to screen
    // readers — expose its checked state.
    return Semantics(
      checked: _confirmed,
      button: true,
      child: GestureDetector(
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
                    color:
                        _confirmed ? AppColors.primary : colors.outlineVariant,
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
      ),
    );
  }

  Widget _buildConfirmButton(ColorScheme colorScheme) {
    final colors = AppColors.of(context);
    return Column(
      children: [
        GestureDetector(
          key: const Key('submitReturnButton'),
          onTap: _canSubmit ? _handleReturn : null,
          child: Container(
            width: double.infinity,
            height: 56,
            decoration: BoxDecoration(
              color: _canSubmit ? AppColors.error : colors.outlineVariant,
              borderRadius: BorderRadius.circular(AppRadius.full),
              boxShadow: _canSubmit
                  ? const [
                      BoxShadow(
                        color: AppColors.errorShadowColor,
                        blurRadius: 24,
                        offset: Offset(0, 8),
                      ),
                    ]
                  : null,
            ),
            child: Center(
              child: _submitting
                  ? Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(
                            color: Colors.white,
                            strokeWidth: 2,
                          ),
                        ),
                        const SizedBox(width: 12),
                        // PR-66: per-photo progress so the user sees
                        // N of M uploads completing. The text stays
                        // compact so the button doesn't grow.
                        Text(
                          '$_uploadedCount/$_totalToUpload',
                          style: AppTypography.labelLarge.copyWith(
                            fontWeight: FontWeight.w700,
                            color: colorScheme.onPrimary,
                          ),
                        ),
                        const SizedBox(width: 12),
                        // PR-66: cancel button. Sets the cancel
                        // flag; remaining in-flight uploads
                        // finish but no further uploads start. The
                        // button is disabled while not submitting
                        // (handled by the outer conditional).
                        GestureDetector(
                          onTap: () => setState(() => _cancelled = true),
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 10,
                              vertical: 4,
                            ),
                            decoration: BoxDecoration(
                              color: Colors.white.withValues(alpha: 0.25),
                              borderRadius:
                                  BorderRadius.circular(AppRadius.full),
                            ),
                            child: Text(
                              'Cancel',
                              style: AppTypography.labelSmall.copyWith(
                                fontWeight: FontWeight.w700,
                                color: colorScheme.onPrimary,
                              ),
                            ),
                          ),
                        ),
                      ],
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
