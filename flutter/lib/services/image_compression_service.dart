import 'package:universal_io/io.dart';
import 'package:image_picker/image_picker.dart';
import '../utils/app_logger.dart';

/// PR-9 (F-079 — 2026-08-22 deep audit): the previous
/// implementation was a singleton holding a shared
/// `ImagePicker`. The picker itself is fine to share (it's
/// stateless, just a plugin handle) but the singleton pattern
/// made the service impossible to substitute in tests, AND
/// every concurrent `pickAndCompress` call would share state
/// (the picker's `requestFullMetadata: false` flag, the active
/// source, etc.). Now a regular class — callers construct a
/// fresh instance (or use `ImageCompressionService()` in widgets
/// that have no DI). The class is still cheap to construct
/// (no I/O, just plugin-handle lookup).
///
/// Existing call sites that use `ImageCompressionService()`
/// (factory) keep compiling — `ImageCompressionService.new` is
/// equivalent for the no-args constructor.
class ImageCompressionService {
  final ImagePicker _picker;

  ImageCompressionService({ImagePicker? picker})
      : _picker = picker ?? ImagePicker();

  Future<File?> pickAndCompress({
    ImageSource source = ImageSource.camera,
    int maxWidth = 1024,
    int maxHeight = 1024,
    int quality = 80,
  }) async {
    try {
      final XFile? picked = await _picker.pickImage(
        source: source,
        maxWidth: maxWidth.toDouble(),
        maxHeight: maxHeight.toDouble(),
        imageQuality: quality,
        requestFullMetadata: false,
      );

      if (picked == null) return null;
      return File(picked.path);
    } catch (e) {
      appDebug('Error picking image: $e');
      return null;
    }
  }

  Future<List<File>> pickMultipleAndCompress({
    int maxImages = 5,
    int maxWidth = 1024,
    int maxHeight = 1024,
    int quality = 80,
  }) async {
    try {
      final List<XFile> picked = await _picker.pickMultiImage(
        maxWidth: maxWidth.toDouble(),
        maxHeight: maxHeight.toDouble(),
        imageQuality: quality,
        requestFullMetadata: false,
      );

      return picked.take(maxImages).map((p) => File(p.path)).toList();
    } catch (e) {
      appDebug('Error picking multiple images: $e');
      return [];
    }
  }

  Future<int> getImageSize(File file) async {
    final bytes = await file.readAsBytes();
    return bytes.length;
  }

  String formatFileSize(int bytes) {
    if (bytes < 1024) return '$bytes B';
    if (bytes < 1024 * 1024) return '${(bytes / 1024).toStringAsFixed(1)} KB';
    return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
  }
}
