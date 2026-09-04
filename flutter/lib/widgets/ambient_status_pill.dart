import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:voltium_rider/services/connectivity_service.dart';
import 'package:voltium_rider/theme/app_theme.dart';

/// Ambient non-intrusive floating status pill for low-connectivity & offline states.
///
/// Designed for outdoor EV delivery riders:
/// - Floating capsule layout prevents content jump/shove
/// - Subtle pulse indicator
/// - One-tap connectivity recheck with haptic feedback
class AmbientStatusPill extends ConsumerStatefulWidget {
  final Alignment alignment;
  final EdgeInsetsGeometry padding;

  const AmbientStatusPill({
    super.key,
    this.alignment = Alignment.topCenter,
    this.padding = const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
  });

  @override
  ConsumerState<AmbientStatusPill> createState() => _AmbientStatusPillState();
}

class _AmbientStatusPillState extends ConsumerState<AmbientStatusPill>
    with SingleTickerProviderStateMixin {
  late AnimationController _pulseController;
  bool _isChecking = false;

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1400),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _pulseController.dispose();
    super.dispose();
  }

  Future<void> _handleRetry() async {
    if (_isChecking) return;
    setState(() => _isChecking = true);
    HapticFeedback.lightImpact();
    await ConnectivityService().checkConnection();
    if (mounted) {
      setState(() => _isChecking = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final connectivity = ref.watch(connectivityProvider);
    final isOnline = connectivity.isOnline;
    final pendingCount = connectivity.pendingSyncCount;
    final l10n = AppLocalizations.of(context);
    final colors = AppColors.of(context);
    final isDark = Theme.of(context).brightness == Brightness.dark;

    final shouldShow = !isOnline || pendingCount > 0 || _isChecking;

    return AnimatedSlide(
      duration: const Duration(milliseconds: 350),
      curve: Curves.easeOutCubic,
      offset: shouldShow ? Offset.zero : const Offset(0, -1.2),
      child: AnimatedOpacity(
        duration: const Duration(milliseconds: 300),
        opacity: shouldShow ? 1.0 : 0.0,
        child: Align(
          alignment: widget.alignment,
          child: Padding(
            padding: widget.padding,
            child: Material(
              color: Colors.transparent,
              child: InkWell(
                onTap: _handleRetry,
                borderRadius: BorderRadius.circular(20),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(20),
                  child: BackdropFilter(
                    filter: ImageFilter.blur(sigmaX: 12, sigmaY: 12),
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 14,
                        vertical: 6,
                      ),
                      decoration: BoxDecoration(
                        color: isDark
                            ? colors.card.withValues(alpha: 0.90)
                            : colors.card.withValues(alpha: 0.95),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(
                          color: !isOnline
                              ? colors.warning.withValues(alpha: 0.45)
                              : colors.outlineVariant.withValues(alpha: 0.5),
                          width: 1,
                        ),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black
                                .withValues(alpha: isDark ? 0.35 : 0.08),
                            blurRadius: 10,
                            offset: const Offset(0, 3),
                          ),
                        ],
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          AnimatedBuilder(
                            animation: _pulseController,
                            builder: (context, _) {
                              final alpha =
                                  0.5 + (_pulseController.value * 0.5);
                              return Container(
                                width: 8,
                                height: 8,
                                decoration: BoxDecoration(
                                  shape: BoxShape.circle,
                                  color: !isOnline
                                      ? colors.warning.withValues(alpha: alpha)
                                      : colors.success.withValues(alpha: alpha),
                                ),
                              );
                            },
                          ),
                          const SizedBox(width: 8),
                          Icon(
                            !isOnline
                                ? Icons.wifi_off_rounded
                                : Icons.sync_rounded,
                            size: 14,
                            color: !isOnline
                                ? colors.warningForeground
                                : colors.success,
                          ),
                          const SizedBox(width: 6),
                          Text(
                            !isOnline
                                ? (l10n?.txtyouAreOffline ?? 'You are offline')
                                : (pendingCount > 0
                                    ? 'Syncing $pendingCount item${pendingCount > 1 ? "s" : ""}...'
                                    : 'Connected'),
                            style: GoogleFonts.plusJakartaSans(
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              color: colors.onSurface,
                            ),
                          ),
                          if (!isOnline) ...[
                            const SizedBox(width: 6),
                            Text(
                              '· Tap to retry',
                              style: GoogleFonts.plusJakartaSans(
                                fontSize: 11,
                                fontWeight: FontWeight.w500,
                                color: colors.onSurfaceMuted,
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
