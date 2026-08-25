// T-113 (PR-3): the Support Center used to always show the Call/Email
// contact cards, falling back to a hardcoded `+919876543210` and
// `support@voltium.app` if the server hadn't published real contact
// info. Tapping those dialled a fake number. The fix hides the
// cards when the corresponding field is null and shows a single
// "Support is being configured" info card as a fallback.
//
// The FAQ screen's _callSupport / _emailSupport helpers got the same
// treatment: if the config field is null, they show a toast and
// bail instead of dialling a hardcoded number.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/core/localization/locale_provider.dart';
import 'package:voltium_rider/core/state/rider_provider.dart';
import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/features/support/presentation/providers/support_provider.dart';
import 'package:voltium_rider/features/support/presentation/screens/faq_screen.dart';
import 'package:voltium_rider/features/support/presentation/screens/support_center_screen.dart';
import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:voltium_rider/models/rider_model.dart';
import 'package:voltium_rider/models/support_model.dart';
import 'package:voltium_rider/theme/theme_provider.dart';

/// Stub SupportNotifier that lets each test seed `supportConfig`.
class _StubSupportNotifier extends SupportNotifier {
  final SupportConfig? seed;
  _StubSupportNotifier(this.seed);

  @override
  SupportState build() => SupportState(supportConfig: seed);
}

/// Stub RiderNotifier that returns a ready state with a minimal rider.
/// The Support Center shows a skeleton until the rider provider has
/// hydrated, so this stub is needed to render the contact cards.
class _StubRiderNotifier extends RiderNotifier {
  @override
  RiderState build() => const RiderState().copyWith(
        rider: _stubRider,
        dataState: DataState.fresh,
      );
}

final RiderModel _stubRider = RiderModel(
  riderId: 'VF-RD-TEST',
  phone: '9876543210',
  name: 'Test Rider',
  pickupDone: true,
  registrationDone: true,
  kycDone: true,
  intent: 'personal',
  guarantorStatus: GuarantorStatus.approved,
  accountStatus: AccountStatus.active,
  lifecycleStatus: 'ACTIVE',
);

Widget _wrap({
  required Widget child,
  SupportConfig? supportConfig,
}) {
  return ProviderScope(
    overrides: [
      localeProviderRef.overrideWith(() => LocaleProvider()),
      themeProviderRef.overrideWith(() => ThemeProvider()),
      riderProvider.overrideWith(() => _StubRiderNotifier()),
      supportProvider.overrideWith(() => _StubSupportNotifier(supportConfig)),
    ],
    child: MaterialApp(
      theme: ThemeData.light(),
      // AppLocalizations.of(context) is null without delegates, and
      // the Support Center uses `l10n!.txtsupportCenter!` in places,
      // so a null l10n would throw.
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: child,
    ),
  );
}

void main() {
  group('Support Center — T-113 (hide Call/Email when supportConfig null)', () {
    testWidgets('hides both contact cards when supportConfig is null',
        (tester) async {
      // Use a tall viewport so the contact cards (anchored to the
      // bottom of the CustomScrollView) are in-frame without scrolling.
      tester.view.physicalSize = const Size(800, 2400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      await tester.pumpWidget(_wrap(
        child: const SupportCenterScreen(),
        supportConfig: null,
      ));
      // The Support Center's init calls /api/rider/support-config;
      // that fetch 500s under the offline harness and the screen
      // falls back to `supportConfig = null`. A few `pump` ticks is
      // enough to settle the build without hanging on animations.
      for (var i = 0; i < 8; i++) {
        await tester.pump(const Duration(milliseconds: 250));
      }

      // Neither card title should be present.
      expect(find.text('Email Us'), findsNothing);
      expect(find.text('Call Us'), findsNothing);

      // The "being configured" fallback card should be visible.
      expect(
        find.textContaining('Support contact is being configured'),
        findsAtLeastNWidgets(1),
      );
    });

    testWidgets('shows only the Email card when only email is set',
        (tester) async {
      tester.view.physicalSize = const Size(800, 2400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      await tester.pumpWidget(_wrap(
        child: const SupportCenterScreen(),
        supportConfig: const SupportConfig(
          supportEmail: 'real@voltium.app',
          supportPhone: '',
        ),
      ));
      for (var i = 0; i < 8; i++) {
        await tester.pump(const Duration(milliseconds: 250));
      }

      expect(find.text('Email Us'), findsOneWidget);
      expect(find.text('Call Us'), findsNothing);
    });

    testWidgets('shows only the Call card when only phone is set',
        (tester) async {
      tester.view.physicalSize = const Size(800, 2400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      await tester.pumpWidget(_wrap(
        child: const SupportCenterScreen(),
        supportConfig: const SupportConfig(
          supportEmail: '',
          supportPhone: '+919999999999',
        ),
      ));
      for (var i = 0; i < 8; i++) {
        await tester.pump(const Duration(milliseconds: 250));
      }

      expect(find.text('Call Us'), findsOneWidget);
      expect(find.text('Email Us'), findsNothing);
    });

    testWidgets('shows both cards when both are set', (tester) async {
      tester.view.physicalSize = const Size(800, 2400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      await tester.pumpWidget(_wrap(
        child: const SupportCenterScreen(),
        supportConfig: const SupportConfig(
          supportEmail: 'real@voltium.app',
          supportPhone: '+919999999999',
        ),
      ));
      for (var i = 0; i < 8; i++) {
        await tester.pump(const Duration(milliseconds: 250));
      }

      expect(find.text('Email Us'), findsOneWidget);
      expect(find.text('Call Us'), findsOneWidget);
      // No fallback info card.
      expect(
        find.textContaining('Support contact is being configured'),
        findsNothing,
      );
    });
  });

  group('FAQ screen — T-113 (no hardcoded phone/email fallbacks)', () {
    testWidgets('Call Support tap on empty config shows a toast, no dial',
        (tester) async {
      await tester.pumpWidget(_wrap(
        child: const FaqScreen(),
        supportConfig: const SupportConfig(
          supportEmail: '',
          supportPhone: '',
        ),
      ));
      for (var i = 0; i < 8; i++) {
        await tester.pump(const Duration(milliseconds: 250));
      }

      // Find the Call Support button. The FAQ screen renders it as an
      // icon + label; the test for the label is enough.
      final callBtn = find.text('Call Support');
      expect(callBtn, findsOneWidget,
          reason: 'FAQ must expose a Call Support button');
      await tester.tap(callBtn);
      for (var i = 0; i < 8; i++) {
        await tester.pump(const Duration(milliseconds: 250));
      }

      // The "being configured" toast must surface.
      expect(
        find.textContaining('Support contact is being configured'),
        findsAtLeastNWidgets(1),
      );
    });
  });
}
