import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../gen/app_localizations.dart';
import '../providers/locale_provider.dart';
import '../theme/app_theme.dart';

/// A reusable animated segmented control for toggling between English and Hindi.
///
/// Displays two options with an animated selection indicator themed with the
/// Voltium brand colour (`#0053c1`). When the user taps an option the
/// [LocaleProvider] is updated and [onLocaleChanged] is invoked so the parent
/// can react (e.g. show a snackbar).
class LanguageToggle extends StatefulWidget {
  const LanguageToggle({super.key, this.onLocaleChanged});

  /// Optional callback invoked after the locale has been changed.
  final ValueChanged<Locale>? onLocaleChanged;

  @override
  State<LanguageToggle> createState() => _LanguageToggleState();
}

class _LanguageToggleState extends State<LanguageToggle>
    with SingleTickerProviderStateMixin {
  /// Controls the animated position of the selection indicator.
  late final AnimationController _controller;
  late final Animation<Offset> _animation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 250),
    );
    _animation = Tween<Offset>(
      begin: Offset.zero,
      end: const Offset(1, 0),
    ).animate(CurvedAnimation(parent: _controller, curve: Curves.easeInOut));

    // Start in the correct position based on current locale.
    final localeProvider = context.read<LocaleProvider>();
    if (localeProvider.isHindi) {
      _controller.value = 1.0;
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  /// Returns the translated label for each segment.
  String _labelFor(int index, AppLocalizations l10n) {
    return index == 0 ? l10n.settings_english : l10n.settings_hindi;
  }

  Future<void> _onTap(int index) async {
    final localeProvider = context.read<LocaleProvider>();

    if (index == 0 && !localeProvider.isEnglish) {
      await localeProvider.setEnglish();
      _controller.reverse();
      widget.onLocaleChanged?.call(const Locale('en'));
    } else if (index == 1 && !localeProvider.isHindi) {
      await localeProvider.setHindi();
      _controller.forward();
      widget.onLocaleChanged?.call(const Locale('hi'));
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final l10n = AppLocalizations.of(context)!;

    const vfBlue = AppColors.primary;
    const vfBlueLight = Color(0xFFD6E4FF);

    return LayoutBuilder(
      builder: (context, constraints) {
        final segmentWidth =
            (constraints.maxWidth - 4) / 2; // 4 = inner padding

        return AnimatedBuilder(
          animation: _animation,
          builder: (context, child) {
            return Container(
              height: 48,
              decoration: BoxDecoration(
                color: vfBlueLight.withValues(alpha: 0.35),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Stack(
                children: [
                  // Animated selection indicator.
                  Positioned(
                    left: 2 + (_animation.value.dx * segmentWidth),
                    top: 2,
                    child: Container(
                      width: segmentWidth,
                      height: 44,
                      decoration: BoxDecoration(
                        color: vfBlue,
                        borderRadius: BorderRadius.circular(10),
                        boxShadow: [
                          BoxShadow(
                            color: vfBlue.withValues(alpha: 0.35),
                            blurRadius: 8,
                            offset: const Offset(0, 2),
                          ),
                        ],
                      ),
                    ),
                  ),
                  // Segment labels.
                  Row(
                    children: List.generate(2, (index) {
                      final isSelected =
                          (index == 0 && _animation.value.dx < 0.5) ||
                              (index == 1 && _animation.value.dx >= 0.5);
                      final textColor =
                          isSelected ? Colors.white : vfBlue.withValues(alpha: 0.8);

                      return Expanded(
                        child: GestureDetector(
                          onTap: () => _onTap(index),
                          child: Center(
                            child: Text(
                              _labelFor(index, l10n),
                              style: theme.textTheme.labelLarge?.copyWith(
                                color: textColor,
                                fontWeight: isSelected
                                    ? FontWeight.w700
                                    : FontWeight.w500,
                              ),
                            ),
                          ),
                        ),
                      );
                    }),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }
}
