import 'package:universal_io/io.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:voltium_rider/services/photo_upload_service.dart';
import 'package:voltium_rider/widgets/photo_upload_sheet.dart';
import 'package:voltium_rider/widgets/pending_uploads_pill.dart';

void main() {
  group('PendingUploadsPill Widget', () {
    testWidgets('renders nothing when no tasks exist', (tester) async {
      await tester.pumpWidget(
        const ProviderScope(
          child: MaterialApp(
            home: Scaffold(
              body: PendingUploadsPill(),
            ),
          ),
        ),
      );

      expect(find.byType(PendingUploadsPill), findsOneWidget);
      expect(find.textContaining('pending'), findsNothing);
    });

    testWidgets('renders pill when queued upload exists', (tester) async {
      final container = ProviderContainer();
      final notifier = container.read(photoUploadProvider.notifier);

      notifier.enqueueUploads([
        PhotoUploadTask(
          id: 'test-p1',
          category: 'test',
          label: 'Test Photo',
          file: File('/tmp/test.png'),
        ),
      ]);

      await tester.pumpWidget(
        UncontrolledProviderScope(
          container: container,
          child: const MaterialApp(
            home: Scaffold(
              body: PendingUploadsPill(),
            ),
          ),
        ),
      );

      expect(find.textContaining('pending'), findsOneWidget);
    });
  });

  group('PhotoUploadSheet Widget', () {
    testWidgets('renders sheet header and task tiles', (tester) async {
      final container = ProviderContainer();
      final notifier = container.read(photoUploadProvider.notifier);

      notifier.enqueueUploads([
        PhotoUploadTask(
          id: 'sheet-task-1',
          category: 'test',
          label: 'Front View',
          file: File('/tmp/front.png'),
        ),
      ]);

      await tester.pumpWidget(
        UncontrolledProviderScope(
          container: container,
          child: const MaterialApp(
            home: Scaffold(
              body: PhotoUploadSheet(),
            ),
          ),
        ),
      );

      expect(find.text('PHOTO UPLOADS'), findsOneWidget);
      expect(find.text('Front View'), findsOneWidget);
      expect(find.text('Dismiss to Background'), findsOneWidget);
    });
  });
}
