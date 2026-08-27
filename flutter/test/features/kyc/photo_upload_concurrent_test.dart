import 'dart:async';
import 'dart:io';
import 'dart:ui' as ui;
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/core/network/api_client.dart';
import 'package:voltium_rider/core/network/files_repository.dart';
import 'package:voltium_rider/core/network/generated/api_client.dart';
import 'package:voltium_rider/services/photo_upload_service.dart';

/// Generates a real PNG via the engine so `decodeFileWithCap` succeeds in the
/// test environment (hand-rolled byte sequences are rejected by the codec).
Future<File> _makePngFile(String path) async {
  final recorder = ui.PictureRecorder();
  final canvas = ui.Canvas(recorder);
  canvas.drawRect(
    const ui.Rect.fromLTWH(0, 0, 4, 4),
    ui.Paint()..color = const ui.Color(0xFF336699),
  );
  final pic = recorder.endRecording();
  final img = await pic.toImage(4, 4);
  final data = await img.toByteData(format: ui.ImageByteFormat.png);
  final f = File(path);
  f.writeAsBytesSync(data!.buffer.asUint8List());
  return f;
}

/// Fake that holds uploads open so the test can observe in-flight
/// concurrency (the notifier caps it at [PhotoUploadNotifier.maxConcurrency]).
class _HoldingFilesRepository implements FilesRepository {
  final List<Completer<void>> _gates = [];
  int calls = 0;
  int active = 0;
  int maxActive = 0;

  void completeOne() {
    if (_gates.isEmpty) return;
    _gates.removeAt(0).complete();
  }

  void completeAll() {
    for (final g in _gates) {
      g.complete();
    }
    _gates.clear();
  }

  @override
  Future<String> uploadFile(File file, dynamic category) async {
    calls++;
    active++;
    if (active > maxActive) maxActive = active;
    final gate = Completer<void>();
    _gates.add(gate);
    await gate.future;
    active--;
    return 'https://cdn.voltium.in/$category/${file.path.split('/').last}';
  }

  @override
  ApiClient get apiClient => throw UnimplementedError();

  @override
  VoltiumApiClient get voltiumApiClient => throw UnimplementedError();

  @override
  Future<String> uploadProfileImage(File file) => throw UnimplementedError();
}

void main() {
  late File sampleImage;

  Future<void> pumpUntil(bool Function() condition,
      {int maxIterations = 200}) async {
    for (var i = 0; i < maxIterations && !condition(); i++) {
      await Future<void>.delayed(const Duration(milliseconds: 10));
    }
  }

  testWidgets('enqueues 5 uploads but never runs more than 3 at once',
      (tester) async {
    await tester.runAsync(() async {
      sampleImage =
          await _makePngFile('${Directory.systemTemp.path}/kyc_photo.png');
      final repo = _HoldingFilesRepository();
      final container = ProviderContainer(
        overrides: [filesRepositoryProvider.overrideWithValue(repo)],
      );
      addTearDown(container.dispose);

      final notifier = container.read(photoUploadProvider.notifier);
      PhotoUploadTask task(String id) => PhotoUploadTask(
            id: id,
            category: 'kyc_document',
            label: 'Doc $id',
            file: sampleImage,
          );

      notifier.enqueueUploads(
          [task('a'), task('b'), task('c'), task('d'), task('e')]);

      // Exactly maxConcurrency uploads start; the rest stay queued.
      await pumpUntil(() => repo.calls >= PhotoUploadNotifier.maxConcurrency);
      expect(repo.calls, PhotoUploadNotifier.maxConcurrency);
      expect(repo.active, PhotoUploadNotifier.maxConcurrency);
      expect(
        container
            .read(photoUploadProvider)
            .where((t) => t.status == PhotoUploadStatus.queued)
            .length,
        2,
      );

      // Freeing one slot starts the next queued upload — never exceeding 3.
      repo.completeOne();
      await pumpUntil(() => repo.calls >= 4);
      expect(repo.calls, 4);
      expect(repo.active, PhotoUploadNotifier.maxConcurrency);

      // Release the rest; all 5 finish with uploaded URLs. A new upload may
      // start after the current gates are released (concurrency slot frees up),
      // so keep releasing until every task has completed.
      for (var i = 0; i < 20 && !notifier.isAllCompleted; i++) {
        repo.completeAll();
        await Future<void>.delayed(const Duration(milliseconds: 20));
      }
      expect(notifier.isAllCompleted, isTrue,
          reason: 'all 5 uploads should complete once gates are released');
      expect(notifier.completedCount, 5);
      expect(
        repo.maxActive,
        lessThanOrEqualTo(PhotoUploadNotifier.maxConcurrency),
      );
      final urls = container.read(photoUploadProvider).map((t) => t.resultUrl);
      expect(urls.where((u) => u != null).length, 5);
    });
  });

  testWidgets('failed uploads surface as failed tasks with an error message',
      (tester) async {
    await tester.runAsync(() async {
      final container = ProviderContainer(
        overrides: [
          filesRepositoryProvider.overrideWithValue(_HoldingFilesRepository()),
        ],
      );
      addTearDown(container.dispose);

      final notifier = container.read(photoUploadProvider.notifier);
      final broken = PhotoUploadTask(
        id: 'broken',
        category: 'kyc_document',
        label: 'Broken',
        file: File('${Directory.systemTemp.path}/missing_photo.png'),
      );
      notifier.enqueueUploads([broken]);

      // A missing file fails fast (decode throws) → failed state.
      await pumpUntil(() => notifier.hasFailures);
      expect(notifier.hasFailures, isTrue);
      final task = container.read(photoUploadProvider).single;
      expect(task.status, PhotoUploadStatus.failed);
      expect(task.errorMessage, isNotNull);
    });
  });
}
