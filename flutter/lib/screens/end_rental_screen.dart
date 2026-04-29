import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../providers/app_provider.dart';
import '../services/api_service.dart';
import '../theme/app_theme.dart';

/// Matches web EndRentalScreen.tsx exactly:
/// - Light bg, glass back btn + "End Rental" header
/// - Red warning card "Are you sure?"
/// - 2×2 photo grid (tap to mark taken — green check / camera icon)
/// - Odometer reading pill input
/// - Battery bar (static 72%)
/// - Confirmation checkbox
/// - "Confirm Return" red pill CTA (disabled until all photos + checkbox)
/// - Success state: green check circle + "Request Submitted!"

class EndRentalScreen extends StatefulWidget {
  final VoidCallback? onBack;
  final VoidCallback? onSuccess;

  const EndRentalScreen({super.key, this.onBack, this.onSuccess});

  @override
  State<EndRentalScreen> createState() => _EndRentalScreenState();
}

class _EndRentalScreenState extends State<EndRentalScreen>
    with SingleTickerProviderStateMixin {
  final _odometerCtrl = TextEditingController();
  final Map<String, bool> _photos = {
    'front': false,
    'rear': false,
    'left': false,
    'right': false,
  };
  bool _confirmed = false;
  bool _submitting = false;
  bool _submitted = false;

  late final AnimationController _entryCtrl;

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
    _odometerCtrl.dispose();
    _entryCtrl.dispose();
    super.dispose();
  }

  bool get _allPhotosTaken => _photos.values.every((v) => v);
  bool get _canSubmit => _allPhotosTaken && _confirmed && !_submitting;

  Future<void> _handleReturn() async {
    if (!_canSubmit) return;
    setState(() => _submitting = true);

    try {
      final rider = context.read<AppProvider>().rider;
      final riderId = rider?.riderId ?? '';
      final photoList = _photos.keys.where((k) => _photos[k] == true).toList();
      await ApiService().submitVehicleReturn(
        riderId: riderId,
        photoUrls: photoList,
        reason: 'End of rental – odometer: ${_odometerCtrl.text}',
      );

      if (mounted) {
        setState(() {
          _submitting = false;
          _submitted = true;
        });
        await Future.delayed(const Duration(seconds: 2));
        widget.onSuccess?.call();
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
    if (_submitted) {
      return Scaffold(
        backgroundColor: AppColors.surface,
        body: SafeArea(
          child: Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Container(
                  width: 80,
                  height: 80,
                  decoration: BoxDecoration(
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
                  style: GoogleFonts.inter(
                    fontSize: 24,
                    fontWeight: FontWeight.w700,
                    color: AppColors.onSurface,
                  ),
                ),
                const SizedBox(height: 12),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 48),
                  child: Text(
                    'Your vehicle return request has been sent for approval.',
                    textAlign: TextAlign.center,
                    style: GoogleFonts.inter(
                      fontSize: 15,
                      color: AppColors.onSurfaceVariant,
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
      backgroundColor: AppColors.surface,
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
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(
                        color: Colors.white,
                        shape: BoxShape.circle,
                        boxShadow: AppShadows.glass,
                      ),
                      child: const Icon(Icons.arrow_back,
                          size: 18, color: AppColors.onSurface),
                    ),
                  ),
                  const SizedBox(width: 16),
                  Text(
                    'End Rental',
                    style: GoogleFonts.inter(
                      fontSize: 21,
                      fontWeight: FontWeight.w700,
                      color: AppColors.onSurface,
                    ),
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
                    _buildWarningCard(),
                    const SizedBox(height: 20),

                    // Photo grid
                    _buildPhotoGrid(),
                    const SizedBox(height: 20),

                    // Odometer
                    _buildOdometer(),
                    const SizedBox(height: 16),

                    // Battery
                    _buildBattery(),
                    const SizedBox(height: 16),

                    // Checkbox
                    _buildCheckbox(),
                    const SizedBox(height: 24),

                    // Confirm button
                    _buildConfirmButton(),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildWarningCard() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.errorLight,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        border: Border.all(color: const Color(0xFFFECACA), width: 2),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: const Color(0xFFFEE2E2),
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.warning_amber_rounded,
                color: Color(0xFFBA1A1A), size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Are you sure?',
                  style: GoogleFonts.inter(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: const Color(0xFFBA1A1A),
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'Returning your vehicle will end your current rental period. Make sure to complete all inspection steps.',
                  style: GoogleFonts.inter(
                    fontSize: 12,
                    color: AppColors.error.withOpacity(0.8),
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

  Widget _buildPhotoGrid() {
    final slots = [
      {'key': 'front', 'label': 'Front'},
      {'key': 'rear', 'label': 'Rear'},
      {'key': 'left', 'label': 'Left'},
      {'key': 'right', 'label': 'Right'},
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'RETURN INSPECTION',
          style: GoogleFonts.inter(
            fontSize: 11,
            fontWeight: FontWeight.w800,
            color: AppColors.onSurface,
            letterSpacing: 1.2,
          ),
        ),
        const SizedBox(height: 6),
        Text(
          'Take return photos of your vehicle',
          style: GoogleFonts.inter(
              fontSize: 12, color: AppColors.onSurfaceVariant),
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
            final taken = _photos[key] ?? false;
            return GestureDetector(
              onTap: () => setState(() => _photos[key] = !(_photos[key] ?? false)),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                decoration: BoxDecoration(
                  color: taken ? AppColors.successLight : Colors.white,
                  borderRadius: BorderRadius.circular(AppRadius.lg),
                  border: Border.all(
                    color: taken
                        ? const Color(0xFF86EFAC)
                        : AppColors.divider,
                    width: taken ? 2 : 1,
                    style: taken ? BorderStyle.solid : BorderStyle.solid,
                  ),
                ),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(
                      taken ? Icons.check : Icons.camera_alt_outlined,
                      size: 24,
                      color: taken
                          ? AppColors.successDark
                          : AppColors.onSurfaceVariant,
                    ),
                    const SizedBox(height: 8),
                    Text(
                      slot['label']!,
                      style: GoogleFonts.inter(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: taken
                            ? AppColors.successText
                            : AppColors.onSurfaceVariant,
                      ),
                    ),
                  ],
                ),
              ),
            );
          }).toList(),
        ),
      ],
    );
  }

  Widget _buildOdometer() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        boxShadow: AppShadows.card,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'ODOMETER READING',
            style: GoogleFonts.inter(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: AppColors.onSurfaceVariant,
              letterSpacing: 1.2,
            ),
          ),
          const SizedBox(height: 8),
          TextField(
            controller: _odometerCtrl,
            keyboardType: TextInputType.number,
            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
            style: GoogleFonts.inter(
              fontSize: 14,
              fontWeight: FontWeight.w600,
              color: AppColors.onSurface,
            ),
            decoration: InputDecoration(
              hintText: 'Enter current odometer reading',
              hintStyle: GoogleFonts.inter(
                  fontSize: 14, color: AppColors.onSurfaceDisabled),
              filled: true,
              fillColor: AppColors.inputBackground,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(AppRadius.md),
                borderSide: BorderSide.none,
              ),
              contentPadding: const EdgeInsets.symmetric(
                  horizontal: 16, vertical: 12),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBattery() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
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
            child: const Icon(Icons.battery_5_bar,
                color: AppColors.successDark, size: 18),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Battery Level',
                  style: GoogleFonts.inter(
                      fontSize: 12, color: AppColors.onSurfaceVariant),
                ),
                Text(
                  'Current battery: 72%',
                  style: GoogleFonts.inter(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: AppColors.onSurface,
                  ),
                ),
              ],
            ),
          ),
          SizedBox(
            width: 80,
            child: ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: LinearProgressIndicator(
                value: 0.72,
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

  Widget _buildCheckbox() {
    return GestureDetector(
      onTap: () => setState(() => _confirmed = !_confirmed),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
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
                borderRadius: BorderRadius.circular(4),
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
                style: GoogleFonts.inter(
                  fontSize: 12,
                  color: AppColors.onSurface,
                  height: 1.6,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildConfirmButton() {
    return Column(
      children: [
        GestureDetector(
          onTap: _canSubmit ? _handleReturn : null,
          child: Container(
            width: double.infinity,
            height: 56,
            decoration: BoxDecoration(
              color: _canSubmit
                  ? const Color(0xFFBA1A1A)
                  : AppColors.divider,
              borderRadius: BorderRadius.circular(999),
              boxShadow: _canSubmit
                  ? const [
                      BoxShadow(
                        color: Color(0x40BA1A1A),
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
                          color: Colors.white, strokeWidth: 2),
                    )
                  : Text(
                      'Confirm Return',
                      style: GoogleFonts.inter(
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        color: _canSubmit
                            ? Colors.white
                            : AppColors.onSurfaceDisabled,
                      ),
                    ),
            ),
          ),
        ),
        if (!_allPhotosTaken) ...[
          const SizedBox(height: 8),
          Text(
            'Please take all inspection photos to continue',
            style: GoogleFonts.inter(
              fontSize: 11,
              color: AppColors.error,
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ],
    );
  }
}
