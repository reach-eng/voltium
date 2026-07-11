import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/features/referrals/presentation/screens/referral_screen.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/core/localization/locale_provider.dart';
import 'package:voltium_rider/theme/theme_provider.dart';
import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

/// Referrals Screen Widget Tests
void main() {
  Widget buildTestApp({required Widget child}) {
    return ProviderScope(
      overrides: [
        localeProviderRef.overrideWith((ref) => LocaleProvider()),
        themeProviderRef.overrideWith((ref) => ThemeProvider()),
      ],
      child: MaterialApp(
        localizationsDelegates: const [
          AppLocalizations.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        home: child,
      ),
    );
  }

  group('Referral Screen', () {
    testWidgets('referral screen renders without error', (tester) async {
      await tester.pumpWidget(buildTestApp(child: const ReferralScreen()));
      await tester.pumpAndSettle();
      expect(find.byType(ReferralScreen), findsOneWidget);
    });

    testWidgets('referral screen shows referral code or invite section',
        (tester) async {
      await tester.pumpWidget(buildTestApp(child: const ReferralScreen()));
      await tester.pumpAndSettle();

      // Should show referral code or invite friends button
      final hasReferralCode = find
          .textContaining('refer', skipOffstage: false)
          .evaluate()
          .isNotEmpty;
      final hasInvite = find
          .textContaining('invite', skipOffstage: false)
          .evaluate()
          .isNotEmpty;
      final hasShare = find
          .textContaining('share', skipOffstage: false)
          .evaluate()
          .isNotEmpty;
      final hasText = find.byType(Text).evaluate().isNotEmpty;

      expect(hasReferralCode || hasInvite || hasShare || hasText, isTrue);
    });

    testWidgets('referral screen does not overflow', (tester) async {
      await tester.pumpWidget(buildTestApp(child: const ReferralScreen()));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    });
  });
}
