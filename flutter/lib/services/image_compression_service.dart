import 'dart:io';
import 'dart:typed_data';
import 'package:flutter/foundation.dart';
import 'package:image_picker/image_picker.dart';
import 'package:image/image.dart' as img;

class ImageCompressionService {
  static final ImageCompressionService _instance =
      ImageCompressionService._internal();
  factory ImageCompressionService() => _instance;
  ImageCompressionService._internal();

  final ImagePicker _picker = ImagePicker();

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
      );

      if (picked == null) return null;

      final file = File(picked.path);
      final compressed = await _compressImage(file, quality: quality);

      return compressed;
    } catch (e) {
      debugPrint('Error picking image: $e');
      return null;
    }
  }

  Future<File> _compressImage(File file, {int quality = 80}) async {
    final bytes = await file.readAsBytes();
    final originalSize = bytes.length;

    if (originalSize <= 500 * 1024) {
      return file;
    }

    try {
      final image = img.decodeImage(bytes);
      if (image == null) return file;

      img.Image resized = image;
      if (image.width > 1024 || image.height > 1024) {
        resized = img.copyResize(image, width: 1024);
      }

      final compressed = img.encodeJpg(resized, quality: quality);

      final compressedFile = await _writeToTempFile(compressed, file.path);
      return compressedFile;
    } catch (e) {
      debugPrint('Error compressing image: $e');
      return file;
    }
  }

  Future<File> _writeToTempFile(Uint8List bytes, String originalPath) async {
    final tempDir = Directory.systemTemp;
    final fileName = '${DateTime.now().millisecondsSinceEpoch}.jpg';
    final newPath = '${tempDir.path}/$fileName';
    final newFile = File(newPath);
    await newFile.writeAsBytes(bytes);
    return newFile;
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
      );

      final limited = picked.take(maxImages).toList();
      final compressed = <File>[];

      for (final pick in limited) {
        final file = File(pick.path);
        final comp = await _compressImage(file, quality: quality);
        compressed.add(comp);
      }

      return compressed;
    } catch (e) {
      debugPrint('Error picking multiple images: $e');
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
