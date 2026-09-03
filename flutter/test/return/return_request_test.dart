import 'package:universal_io/io.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/features/rentals/presentation/screens/end_rental_screen.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/core/localization/locale_provider.dart';
import 'package:voltium_rider/theme/theme_provider.dart';
import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:voltium_rider/core/network/files_repository.dart';
import 'package:voltium_rider/core/network/api_client.dart';
import 'package:voltium_rider/core/network/generated/api_client.dart';
import 'package:voltium_rider/core/network/generated/api_models.dart';
import 'package:voltium_rider/utils/app_constants.dart';

class _MockFilesRepo extends FilesRepository {
  _MockFilesRepo() : super(ApiClient(), VoltiumApiClient(ApiClient()));
  final List<String> uploadedPaths = [];
  bool failRightPhoto = false;

  @override
  Future<String> uploadFile(File file, dynamic category) async {
    if (failRightPhoto && file.path.contains('right')) {
      throw Exception('Upload failed for right photo');
    }
    uploadedPaths.add(file.path);
    return 'https://storage.voltium.in/${file.path.split(Platform.pathSeparator).last}';
  }
}

class _MockVoltiumApiClient extends VoltiumApiClient {
  _MockVoltiumApiClient() : super(ApiClient());
  VehicleReturnRequest? submittedRequest;

  @override
  Future<Map<String, dynamic>> postRiderRentalReturn(
      VehicleReturnRequest request) async {
    submittedRequest = request;
    return {'success': true, 'returnId': 'ret-123'};
  }
}

/// Return Request Screen Widget Tests
void main() {
  Widget buildTestApp({required Widget child}) {
    return ProviderScope(
      overrides: [
        localeProviderRef.overrideWith(() => LocaleProvider()),
        themeProviderRef.overrideWith(() => ThemeProvider()),
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

  group('End Rental (Return Request) Screen', () {
    testWidgets('end rental screen renders without error', (tester) async {
      await tester.pumpWidget(buildTestApp(child: const EndRentalScreen()));
      await tester.pump(const Duration(seconds: 1));
      expect(find.byType(EndRentalScreen), findsOneWidget);
    });

    testWidgets('end rental screen shows return form or instructions',
        (tester) async {
      await tester.pumpWidget(buildTestApp(child: const EndRentalScreen()));
      await tester.pump(const Duration(seconds: 1));

      // Should show return-related UI
      final hasText = find.byType(Text).evaluate().isNotEmpty;
      final hasButton = find.byType(ElevatedButton).evaluate().isNotEmpty ||
          find.byType(FilledButton).evaluate().isNotEmpty ||
          find.byType(TextButton).evaluate().isNotEmpty;

      expect(hasText || hasButton, isTrue);
    });

    testWidgets('end rental screen does not overflow', (tester) async {
      await tester.pumpWidget(buildTestApp(child: const EndRentalScreen()));
      await tester.pump(const Duration(seconds: 1));
      expect(tester.takeException(), isNull);
    });

    testWidgets(
        'F-19: upload failure aborts return submission and does not send <4 photos',
        (tester) async {
      AppConstants.isTestModeOverride = true;
      tester.view.physicalSize = const Size(800, 1600);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        AppConstants.isTestModeOverride = false;
        tester.view.resetPhysicalSize();
      });

      final mockFilesRepo = _MockFilesRepo();
      final mockApiClient = _MockVoltiumApiClient();
      mockFilesRepo.failRightPhoto = true;

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            localeProviderRef.overrideWith(() => LocaleProvider()),
            themeProviderRef.overrideWith(() => ThemeProvider()),
            filesRepositoryProvider.overrideWithValue(mockFilesRepo),
            voltiumApiClientProvider.overrideWithValue(mockApiClient),
          ],
          child: const MaterialApp(
            localizationsDelegates: [
              AppLocalizations.delegate,
              GlobalMaterialLocalizations.delegate,
              GlobalWidgetsLocalizations.delegate,
              GlobalCupertinoLocalizations.delegate,
            ],
            home: EndRentalScreen(),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Tap 4 photo slots (in TEST_MODE, this creates temp mock files)
      await tester.tap(find.byKey(const Key('photoSlot_left')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('photoSlot_right')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('photoSlot_front')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('photoSlot_speedometer')));
      await tester.pumpAndSettle();

      // Enter odometer
      await tester.enterText(find.byKey(const Key('odometerField')), '15200');
      await tester.pumpAndSettle();

      // Check confirm
      await tester.tap(find.byKey(const Key('confirmCheckbox')));
      await tester.pumpAndSettle();

      // Tap submit return
      await tester.tap(find.byKey(const Key('submitReturnButton')));
      await tester.pumpAndSettle();

      // Because right photo failed, postRiderRentalReturn should NOT have been called!
      expect(mockApiClient.submittedRequest, isNull);

      // Now resolve the failure and retry
      mockFilesRepo.failRightPhoto = false;
      await tester.tap(find.byKey(const Key('submitReturnButton')));
      await tester.pumpAndSettle();

      // Now all 4 photos succeed, postRiderRentalReturn IS called with 4 photos!
      expect(mockApiClient.submittedRequest, isNotNull);
      expect(mockApiClient.submittedRequest!.returnPhotos.length, equals(4));

      // Advance past the 2-second success delay timer
      await tester.pump(const Duration(seconds: 3));
    });
  });
}
