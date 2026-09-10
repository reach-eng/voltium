// LEGAL-AUDIT-P0-1-2026-09-08: when the rider taps Continue on the
// legal wall, _handleContinue must POST one server consent row per
// legal type (TERMS, PRIVACY, RENTAL_SAFETY, REFUND, GUARANTOR,
// LEASE) — the audit's missing server-side proof of acceptance.
// Previously the screen only flipped a local bool; a dispute
// could not show which terms version the rider had accepted.
//
// Test scope: a fake ApiClient captures every post() call; we
// pump the screen, tick the accept checkbox, tap Continue, then
// assert the captured payloads. We don't assert on the local bool
// (existing legal_screen_api_test.dart covers the rendering path).

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:voltium_rider/core/network/api_client.dart';
import 'package:voltium_rider/features/onboarding/presentation/screens/legal_screen.dart';
import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:voltium_rider/services/consent_service.dart';

class _CapturingApiClient extends ApiClient {
  _CapturingApiClient({this.docs}) : super.testOverride(baseUrl: 'http://test.invalid');

  final Map<String, dynamic>? docs;
  final List<({String path, Map<String, dynamic> body})> posts = [];

  @override
  Future<Map<String, dynamic>> getWithSWR(
    String path, {
    Map<String, String>? queryParams,
    Future<void>? cancelSignal,
  }) async {
    if (docs == null) throw Exception('offline');
    return docs!;
  }

  @override
  Future<Map<String, dynamic>> post(
    String path, {
    Map<String, dynamic>? body,
    String? idempotencyKey,
    Future<void>? cancelSignal,
  }) async {
    posts.add((path: path, body: body ?? const {}));
    return {'success': true, 'id': 'mock-${posts.length}'};
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    ApiClient.instanceForTest = null;
  });

  tearDown(() {
    ApiClient.instanceForTest = null;
  });

  Widget buildScreen() {
    return const ProviderScope(
      child: MaterialApp(localizationsDelegates: [
        AppLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ], supportedLocales: [Locale('en'), Locale('hi')],
      home: LegalScreen(onNext: null, onBack: null)),
    );
  }

  Map<String, dynamic> apiDocs() => {
        'success': true,
        'data': [
          {
            'type': 'terms',
            'title': 'Terms of Service',
            'content': 'TERMS',
            'updatedAt': '2026-09-08T10:00:00.000Z',
          },
          {
            'type': 'privacy',
            'title': 'Privacy Policy',
            'content': 'PRIVACY',
            'updatedAt': '2026-09-08T10:00:00.000Z',
          },
        ],
      };

  /// The list mirrors the legal types emitted by _handleContinue. Kept
  /// in sync with `consent_service.dart`'s `ConsentType` enum.
  const expectedLegalTypes = <ConsentType>[
    ConsentType.terms,
    ConsentType.privacy,
    ConsentType.rentalSafety,
    ConsentType.refund,
    ConsentType.guarantor,
    ConsentType.lease,
  ];

  testWidgets('Continue on the legal wall POSTs a consent row for every legal type',
      (tester) async {
    final fake = _CapturingApiClient(docs: apiDocs());
    ApiClient.instanceForTest = fake;

    await tester.pumpWidget(buildScreen());
    // Wait for the API doc fetch to resolve (LegalScreen's _loadDocs).
    await tester.pumpAndSettle();

    // Tick the "I have read and accept" row. The legal screen uses
    // a custom GestureDetector with `Key('acceptCheckbox')` rather
    // than the material Checkbox widget — see legal_screen.dart:617.
    // Fall back to tap-by-text in case a future refactor drops the key.
    final acceptByKey = find.byKey(const Key('acceptCheckbox'));
    if (acceptByKey.evaluate().isNotEmpty) {
      await tester.tap(acceptByKey);
      await tester.pumpAndSettle();
    } else {
      final acceptText = find.textContaining(
        'accept',
        findRichText: true,
      );
      expect(acceptText, findsAtLeastNWidgets(1),
          reason: 'no accept control found on the legal wall');
      await tester.tap(acceptText.first);
      await tester.pumpAndSettle();
    }

    // Tap the Continue button. The widget has a `continueLegalButton`
    // key (legal_screen.dart:682).
    final continueBtn = find.byKey(const Key('continueLegalButton'));
    expect(continueBtn, findsOneWidget);
    await tester.ensureVisible(continueBtn);
    await tester.tap(continueBtn);

    // The setConsent fire-and-forget call returns immediately
    // (unawaited). Pump a few frames to let the posted callbacks
    // reach the fake transport.
    for (var i = 0; i < 10; i++) {
      await tester.pump(const Duration(milliseconds: 20));
    }

    // The captured POSTs should include one per legal type to
    // /api/rider/consent with `granted: true` and the right type.
    final consentPosts = fake.posts
        .where((p) => p.path == '/api/rider/consent')
        .toList();
    expect(consentPosts, hasLength(expectedLegalTypes.length),
        reason:
            'expected one POST per legal type; got ${consentPosts.length}');
    final postedTypes = consentPosts
        .map((p) => p.body['consentType'] as String)
        .toSet();
    for (final t in expectedLegalTypes) {
      expect(postedTypes.contains(t.apiValue), isTrue,
          reason: 'missing POST for ${t.apiValue}');
    }
    for (final p in consentPosts) {
      expect(p.body['granted'], isTrue);
      // Flutter sends `public-beta-v1` explicitly (ConsentService's
      // default). The server's zod schema has the same default, so
      // omitting would behave identically — but the existing service
      // always populates the field, and the test pins that contract.
      expect(p.body['policyVersion'], 'public-beta-v1');
    }
  });
}
