import 'dart:async';
import 'dart:ui' as ui;
import 'package:universal_io/io.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path_provider/path_provider.dart';
import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/utils/image_decode.dart';

enum PhotoUploadStatus { queued, processing, uploading, completed, failed }

@immutable
class PhotoUploadTask {
  final String id;
  final String category;
  final String label;
  final File file;
  final PhotoUploadStatus status;
  final double progress;
  final String? resultUrl;
  final String? errorMessage;
  final int retryCount;

  const PhotoUploadTask({
    required this.id,
    required this.category,
    required this.label,
    required this.file,
    this.status = PhotoUploadStatus.queued,
    this.progress = 0.0,
    this.resultUrl,
    this.errorMessage,
    this.retryCount = 0,
  });

  PhotoUploadTask copyWith({
    PhotoUploadStatus? status,
    double? progress,
    String? resultUrl,
    String? errorMessage,
    int? retryCount,
  }) {
    return PhotoUploadTask(
      id: id,
      category: category,
      label: label,
      file: file,
      status: status ?? this.status,
      progress: progress ?? this.progress,
      resultUrl: resultUrl ?? this.resultUrl,
      errorMessage: errorMessage ?? this.errorMessage,
      retryCount: retryCount ?? this.retryCount,
    );
  }
}

class PhotoUploadNotifier extends Notifier<List<PhotoUploadTask>> {
  static const int maxConcurrency = 3;
  static const int maxRetries = 3;
  bool _isProcessingQueue = false;

  @override
  List<PhotoUploadTask> build() {
    return [];
  }

  int get pendingCount =>
      state.where((t) => t.status != PhotoUploadStatus.completed).length;
  int get completedCount =>
      state.where((t) => t.status == PhotoUploadStatus.completed).length;
  bool get hasActiveUploads => state.any((t) =>
      t.status == PhotoUploadStatus.queued ||
      t.status == PhotoUploadStatus.processing ||
      t.status == PhotoUploadStatus.uploading);
  bool get hasFailures =>
      state.any((t) => t.status == PhotoUploadStatus.failed);
  bool get isAllCompleted =>
      state.isNotEmpty &&
      state.every((t) => t.status == PhotoUploadStatus.completed);

  Map<String, String> get completedUrlMap {
    final map = <String, String>{};
    for (final task in state) {
      if (task.status == PhotoUploadStatus.completed &&
          task.resultUrl != null) {
        map[task.id] = task.resultUrl!;
      }
    }
    return map;
  }

  void enqueueUploads(List<PhotoUploadTask> tasks) {
    state = [...state, ...tasks];
    _processQueue();
  }

  void retryTask(String taskId) {
    state = state.map((task) {
      if (task.id == taskId && task.status == PhotoUploadStatus.failed) {
        return task.copyWith(
          status: PhotoUploadStatus.queued,
          progress: 0.0,
          errorMessage: null,
        );
      }
      return task;
    }).toList();
    _processQueue();
  }

  void clearCompleted() {
    state =
        state.where((t) => t.status != PhotoUploadStatus.completed).toList();
  }

  void clearAll() {
    state = [];
  }

  Future<void> _processQueue() async {
    if (_isProcessingQueue) return;
    _isProcessingQueue = true;

    try {
      while (true) {
        final activeCount = state
            .where((t) =>
                t.status == PhotoUploadStatus.uploading ||
                t.status == PhotoUploadStatus.processing)
            .length;
        if (activeCount >= maxConcurrency) break;

        final nextTaskIndex =
            state.indexWhere((t) => t.status == PhotoUploadStatus.queued);
        if (nextTaskIndex == -1) break;

        final task = state[nextTaskIndex];
        _updateTaskStatus(task.id, PhotoUploadStatus.processing, progress: 0.1);
        _runSingleUpload(task);
      }
    } finally {
      _isProcessingQueue = false;
    }
  }

  Future<void> _runSingleUpload(PhotoUploadTask task) async {
    File uploadFile = task.file;

    try {
      // Step 1: Decode and downsample to 1024px cap using PR-132 helper
      final decoded = await decodeFileWithCap(task.file, maxWidth: 1024);
      if (decoded != null) {
        try {
          final byteData =
              await decoded.image.toByteData(format: ui.ImageByteFormat.png);
          decoded.dispose();
          if (byteData != null) {
            final tempDir = await getTemporaryDirectory();
            final resizedPath = '${tempDir.path}/upload_${task.id}_1024.png';
            final resizedFile = File(resizedPath);
            await resizedFile.writeAsBytes(byteData.buffer.asUint8List());
            uploadFile = resizedFile;
          }
        } catch (_) {
          // Fallback to original file if format conversion fails
        }
      }

      _updateTaskStatus(task.id, PhotoUploadStatus.uploading, progress: 0.4);

      // Step 2: Upload with retry
      String? resultUrl;
      int attempt = task.retryCount;
      while (attempt < maxRetries) {
        try {
          final filesRepo = ref.read(filesRepositoryProvider);
          resultUrl = await filesRepo.uploadFile(uploadFile, task.category);
          break;
        } catch (e) {
          attempt++;
          if (attempt >= maxRetries) {
            rethrow;
          }
          await Future.delayed(Duration(seconds: attempt));
        }
      }

      if (resultUrl != null) {
        _updateTaskStatus(
          task.id,
          PhotoUploadStatus.completed,
          progress: 1.0,
          resultUrl: resultUrl,
        );
      } else {
        throw Exception('Upload returned null URL');
      }
    } catch (e) {
      _updateTaskStatus(
        task.id,
        PhotoUploadStatus.failed,
        errorMessage: e.toString(),
        retryCount: task.retryCount + 1,
      );
    } finally {
      _processQueue();
    }
  }

  void _updateTaskStatus(
    String taskId,
    PhotoUploadStatus status, {
    double? progress,
    String? resultUrl,
    String? errorMessage,
    int? retryCount,
  }) {
    state = state.map((t) {
      if (t.id == taskId) {
        return t.copyWith(
          status: status,
          progress: progress ?? t.progress,
          resultUrl: resultUrl ?? t.resultUrl,
          errorMessage: errorMessage,
          retryCount: retryCount ?? t.retryCount,
        );
      }
      return t;
    }).toList();
  }
}

final photoUploadProvider =
    NotifierProvider<PhotoUploadNotifier, List<PhotoUploadTask>>(
  PhotoUploadNotifier.new,
);
