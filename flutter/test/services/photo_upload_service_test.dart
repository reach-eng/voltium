import 'package:universal_io/io.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:voltium_rider/services/photo_upload_service.dart';

void main() {
  group('PhotoUploadTask Model', () {
    test('copyWith updates properties correctly', () {
      final file = File('/tmp/test.png');
      final task = PhotoUploadTask(
        id: 'task-1',
        category: 'vehicle_pickup',
        label: 'Front View',
        file: file,
      );

      expect(task.status, PhotoUploadStatus.queued);
      expect(task.progress, 0.0);

      final updated = task.copyWith(
        status: PhotoUploadStatus.uploading,
        progress: 0.5,
        resultUrl: 'https://example.com/front.png',
      );

      expect(updated.status, PhotoUploadStatus.uploading);
      expect(updated.progress, 0.5);
      expect(updated.resultUrl, 'https://example.com/front.png');
      expect(updated.id, 'task-1');
    });
  });

  group('PhotoUploadNotifier', () {
    test('enqueues and updates tasks', () {
      final container = ProviderContainer();
      final notifier = container.read(photoUploadProvider.notifier);

      final task1 = PhotoUploadTask(
        id: 't-1',
        category: 'test',
        label: 'Image 1',
        file: File('/tmp/img1.png'),
      );

      notifier.enqueueUploads([task1]);

      final state = container.read(photoUploadProvider);
      expect(state.length, 1);
      expect(state.first.id, 't-1');
    });

    test('clearCompleted removes completed tasks', () {
      final container = ProviderContainer();
      final notifier = container.read(photoUploadProvider.notifier);

      final taskCompleted = PhotoUploadTask(
        id: 't-comp',
        category: 'test',
        label: 'Done',
        file: File('/tmp/done.png'),
        status: PhotoUploadStatus.completed,
      );

      notifier.enqueueUploads([taskCompleted]);
      notifier.clearCompleted();

      final state = container.read(photoUploadProvider);
      expect(state, isEmpty);
    });
  });
}
