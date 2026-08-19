import 'package:universal_io/io.dart';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'api_client.dart';
import 'file_category.dart';
import 'generated/api_client.dart';
import 'generated/api_models.dart';
import '../../utils/app_logger.dart';

class FilesRepository {
  final ApiClient _client;
  final VoltiumApiClient _apiClient;

  FilesRepository(this._client, this._apiClient);

  Future<String> uploadFile(File file, dynamic category) async {
    final String categoryStr = category is FileCategory
        ? category.value
        : FileCategory.fromString(category.toString()).value;

    if (!kReleaseMode && const String.fromEnvironment('TEST_MODE') == 'true') {
      return 'https://mock-storage.voltium.in/test-upload-$categoryStr.png';
    }

    try {
      final fileName = file.path.split('/').last;
      final fileBytes = await file.readAsBytes();
      final mimeType = _inferMimeType(fileName, fileBytes);

      final req = RequestUploadUrlRequest(
        fileName: fileName,
        mimeType: mimeType,
        category: categoryStr,
        fileSize: fileBytes.length.toDouble(),
      );

      final urlResponse = await _apiClient.postFilesRequestUpload(req);
      final uploadUrl = urlResponse.uploadUrl;
      if (uploadUrl == null) {
        throw Exception('Upload URL response missing uploadUrl');
      }

      // Step 2: Upload file data to the signed URL via PUT
      final uri = Uri.parse(uploadUrl);
      final storagePath = uri.path.replaceFirst('/api/files/', '');
      String finalUploadUrl = uploadUrl;
      if (finalUploadUrl.startsWith('http')) {
        if (Platform.isAndroid && finalUploadUrl.contains('localhost')) {
          finalUploadUrl = finalUploadUrl.replaceAll('localhost', '10.0.2.2');
        }
      } else {
        finalUploadUrl = '${_client.baseUrl}$uploadUrl';
      }
      final uploadUri = Uri.parse(finalUploadUrl);

      final token = await _client.storage.getSessionToken();
      final uploadResponse = await http
          .put(
            uploadUri,
            headers: {
              'Content-Type': mimeType,
              'Content-Length': fileBytes.length.toString(),
              if (token != null) 'Authorization': 'Bearer $token',
            },
            body: fileBytes,
          )
          .timeout(const Duration(seconds: 120),
              onTimeout: () => throw Exception('Upload timed out after 120s'));

      if (uploadResponse.statusCode < 200 || uploadResponse.statusCode >= 300) {
        throw Exception(
            'Failed to upload file to signed URL (status ${uploadResponse.statusCode})');
      }

      // Step 3: Confirm upload
      final confirmReq = ConfirmUploadRequest(
        fileRecordId: urlResponse.fileRecordId ?? storagePath,
        sizeBytes: fileBytes.length.toDouble(),
      );
      await _apiClient.postFilesConfirmUpload(confirmReq);

      // Return the stable internal storage path, not the temporary signed URL.
      // Callers should request a signed read URL via /api/files/request-read when needed.
      return storagePath;
    } catch (e) {
      appDebug('[FilesRepository] Signed URL upload failed: $e');
      throw Exception('File upload failed: $e');
    }
  }

  String _inferMimeType(String fileName, List<int> bytes) {
    if (bytes.length >= 3 &&
        bytes[0] == 0xFF &&
        bytes[1] == 0xD8 &&
        bytes[2] == 0xFF) {
      return 'image/jpeg';
    }
    if (bytes.length >= 4 &&
        bytes[0] == 0x89 &&
        bytes[1] == 0x50 &&
        bytes[2] == 0x4E &&
        bytes[3] == 0x47) {
      return 'image/png';
    }
    if (bytes.length >= 4 &&
        bytes[0] == 0x25 &&
        bytes[1] == 0x50 &&
        bytes[2] == 0x44 &&
        bytes[3] == 0x46) {
      return 'application/pdf';
    }
    final ext = fileName.split('.').last.toLowerCase();
    switch (ext) {
      case 'png':
        return 'image/png';
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'pdf':
        return 'application/pdf';
      case 'mp4':
        return 'video/mp4';
      case 'mov':
        return 'video/quicktime';
      default:
        return 'application/octet-stream';
    }
  }
}
