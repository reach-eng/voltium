import 'package:flutter/material.dart';
import 'package:voltium_rider/theme/app_theme.dart';
import 'package:voltium_rider/theme/app_typography.dart';
import 'package:voltium_rider/utils/accessibility.dart';
import 'dart:ui' as ui;

/// Floating footer for [LoginScreen]. Renders the "By signing in, you
/// agree to our Terms of Service and Privacy Policy" line as a
/// backdrop-blurred glass strip pinned to the bottom safe area.
///
/// The footer fades in last in the entry sequence (interval 0.5-1.0 of
/// the parent's [AnimationController]). All links open via the
/// platform's default external browser.
class LoginFooter extends StatelessWidget {
  /// AnimationController from the parent, used to drive the fade-in.
  final AnimationController entryController;

  /// Called when the user taps a link. The parent resolves the URL
  /// (e.g. to support deep-link overrides) and launches it.
  final Future<void> Function(String url) onLaunchUrl;

  const LoginFooter({
    super.key,
    required this.entryController,
    required this.onLaunchUrl,
  });

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      child: BackdropFilter(
        filter: ui.ImageFilter.blur(sigmaX: 16, sigmaY: 16),
        child: Container(
          padding: EdgeInsets.fromLTRB(
              20, 20, 20, MediaQuery.of(context).padding.bottom + 20),
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.7),
            border: Border(
              top: BorderSide(
                color: Colors.white.withValues(alpha: 0.2),
                width: 1,
              ),
            ),
          ),
          child: Center(
            child: FadeTransition(
              opacity: CurvedAnimation(
                parent: entryController,
                curve: const Interval(0.5, 1.0),
              ),
              child: RichText(
                textAlign: TextAlign.center,
                text: TextSpan(
                  style: AppTypography.bodySmall.copyWith(
                    color: AppColors.onSurfaceVariant,
                    height: 1.6,
                  ),
                  children: [
                    TextSpan(
                        text: a11yLabel('By signing in, you agree to our\n')),
                    WidgetSpan(
                      child: Semantics(
                        button: true,
                        label: a11yButton('Terms of Service'),
                        child: GestureDetector(
                          onTap: () => onLaunchUrl('https://voltium.app/terms'),
                          child: Text(
                            'Terms of Service',
                            style: AppTypography.labelMedium
                                .copyWith(color: AppColors.primary),
                          ),
                        ),
                      ),
                    ),
                    const TextSpan(
                      text: ' and ',
                    ),
                    WidgetSpan(
                      child: Semantics(
                        button: true,
                        label: a11yButton('Privacy Policy'),
                        child: GestureDetector(
                          onTap: () =>
                              onLaunchUrl('https://voltium.app/privacy'),
                          child: Text(
                            'Privacy Policy',
                            style: AppTypography.labelMedium
                                .copyWith(color: AppColors.primary),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
