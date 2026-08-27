import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/core/network/api_client.dart';
import 'package:voltium_rider/features/onboarding/presentation/screens/legal_screen.dart';
import 'package:voltium_rider/gen/app_localizations.dart';

/// 2026-08-05 legal/device audit P0-3: the legal screen must render documents
/// served by the admin-managed legal module, with the bundled JSON fallback
/// kept only as an offline fallback so the legal gate never hard-blocks
/// onboarding.
///
/// PR-1 (2026-08-07 master fix plan): the 5 inline `const _k*Content` strings
/// were moved to `assets/json/legal_fallback.json`; the asset cannot be read
/// through `rootBundle` inside the widget-test bundle, so the fallback test
/// (a) asserts the fallback *titles* render in-widget and (b) verifies the
/// bundled asset on disk still carries the offline legal copy.
///
/// PR-13 (2026-08-22): the legal screen now calls `ApiClient().getWithSWR`
/// directly (the `VoltiumApiService` wrapper is gone). Tests inject the
/// response via the `ApiClient.instanceForTest` seam by extending the class
/// and overriding `getWithSWR`.

class _FakeApiClient extends ApiClient {
  _FakeApiClient({this.docs}) : super.testOverride(baseUrl: 'http://test.invalid');

  final Map<String, dynamic>? docs;

  @override
  Future<Map<String, dynamic>> getWithSWR(
    String path, {
    Map<String, String>? queryParams,
    Future<void>? cancelSignal,
  }) async {
    if (docs == null) throw Exception('offline');
    return docs!;
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
    return const MaterialApp(localizationsDelegates: [
      AppLocalizations.delegate,
      GlobalMaterialLocalizations.delegate,
      GlobalWidgetsLocalizations.delegate,
      GlobalCupertinoLocalizations.delegate
    ], supportedLocales: [
      Locale('en'),
      Locale('hi')
    ], home: LegalScreen(onNext: null, onBack: null));
  }

  testWidgets('renders API-served documents over the fallback copy',
      (tester) async {
    ApiClient.instanceForTest = _FakeApiClient(docs: {
      'success': true,
      'data': [
        {
          'type': 'terms',
          'title': 'Terms of Service',
          'content': 'SERVER-MANAGED TERMS TEXT',
          'updatedAt': '2026-08-05T10:00:00.000Z',
        },
        {
          'type': 'lease',
          'title': 'Lease Agreement',
          'content': 'LEASE CONTENT FROM API',
          'updatedAt': '2026-08-05T10:00:00.000Z',
        },
      ],
    });

    await tester.pumpWidget(buildScreen());
    // Let the async fetch resolve.
    await tester.pumpAndSettle();

    // API-served title present; the extra API-only type (lease) is appended.
    expect(find.text('Lease Agreement'), findsOneWidget);

    // Expanding the API-overridden section shows the server content, not the
    // hardcoded fallback text.
    await tester.tap(find.byKey(const Key('termsExpand')));
    await tester.pumpAndSettle();
    expect(find.textContaining('SERVER-MANAGED TERMS TEXT'), findsOneWidget);
  });

  testWidgets('falls back to the bundled fallback when the API is unreachable',
      (tester) async {
    ApiClient.instanceForTest = _FakeApiClient();

    await tester.pumpWidget(buildScreen());
    await tester.pumpAndSettle();

    // Fallback sections still render (titles are the hardcoded last-resort).
    expect(find.text('Terms of Service'), findsOneWidget);
    expect(find.text("Guarantor's Agreement"), findsOneWidget);

    // Expanding the fallback section renders the section (content is
    // asset-backed and covered by the disk assertion below).
    await tester.tap(find.byKey(const Key('termsExpand')));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('termsExpand')), findsOneWidget);
    expect(tester.takeException(), isNull,
        reason: 'expanding a fallback section must not throw');
  });

  test('bundled legal fallback asset still carries the offline copy', () {
    // The JSON asset can't be read via rootBundle in the widget-test bundle,
    // so verify the shipping artifact directly from disk — this guards the
    // PR-1 move (inline consts → asset) from silently stripping the offline
    // legal gate.
    final file = File('assets/json/legal_fallback.json');
    expect(file.existsSync(), isTrue,
        reason: 'legal_fallback.json must ship in the APK');
    final json = jsonDecode(file.readAsStringSync()) as Map<String, dynamic>;
    final documents = json['documents'] as Map<String, dynamic>;

    final terms = documents['terms'] as Map<String, dynamic>;
    expect(terms['title'], 'Terms of Service');
    expect(terms['content'], contains('Voltium Mobility Private Limited'));
    expect(terms['content'], contains('1. SERVICE DESCRIPTION'));

    // All fallback keys referenced by LegalScreen._buildSections() exist.
    for (final key in [
      'terms',
      'privacy',
      'rentalSafety',
      'refund',
      'guarantor'
    ]) {
      expect(documents.containsKey(key), isTrue,
          reason: 'fallback section \'$key\' missing from legal_fallback.json');
      expect((documents[key] as Map<String, dynamic>)['content'], isNotEmpty);
    }
  });
}
