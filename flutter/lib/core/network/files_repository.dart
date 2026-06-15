import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import '../../main.dart';
import 'api_client.dart';
import 'generated/api_client.dart';
import 'generated/api_models.dart';

class FilesRepository {
  final ApiClient _client;
  final VoltiumApiClient _apiClient;

  FilesRepository(this._client, this._apiClient);

  Future<String> uploadFile(File file, String category) async {
    if (VoltiumApp.isTestMode) {
      return 'https://mock-storage.voltium.in/test-upload-$category.png';
    }

    try {
      final fileName = file.path.split('/').last;
      final fileBytes = await file.readAsBytes();
      final mimeType = _inferMimeType(fileName);

      final req = RequestUploadUrlRequest(
        fileName: fileName,
        mimeType: mimeType,
        category: category,
        fileSize: fileBytes.length,
      );

      final urlResponse = await _apiClient.postFilesRequestUpload(req);
      final uploadUrl = urlResponse.uploadUrl;
      if (uploadUrl == null) {
        throw Exception('Upload URL response missing uploadUrl');
      }

      // Step 2: Upload file data to the signed URL via PUT
      final uri = Uri.parse(uploadUrl);
      final storagePath = uri.path.replaceFirst('/api/files/', '');
      final uploadUri = Uri.parse(uploadUrl.startsWith('http') ? uploadUrl : '${_client.baseUrl}$uploadUrl');
      
      final token = await _client.storage.getSessionToken();
      final uploadResponse = await http.put(
        uploadUri,
        headers: {
          'Content-Type': mimeType,
          'Content-Length': fileBytes.length.toString(),
          if (token != null) 'Authorization': 'Bearer $token',
        },
        body: fileBytes,
      );

      if (uploadResponse.statusCode < 200 || uploadResponse.statusCode >= 300) {
        throw Exception('Failed to upload file to signed URL');
      }

      // Step 3: Confirm upload
      final confirmReq = ConfirmUploadRequest(
        storagePath: storagePath,
        originalName: fileName,
        mimeType: mimeType,
        fileSize: fileBytes.length,
        category: category,
      );
      await _apiClient.postFilesConfirmUpload(confirmReq);

      return uploadUrl;
    } catch (e) {
      debugPrint('[FilesRepository] Signed URL upload failed: $e');
      throw Exception('File upload failed: $e');
    }
  }

  String _inferMimeType(String fileName) {
    final ext = fileName.split('.').last.toLowerCase();
    switch (ext) {
      case 'png': return 'image/png';
      case 'jpg':
      case 'jpeg': return 'image/jpeg';
      case 'pdf': return 'application/pdf';
      default: return 'application/octet-stream';
    }
  }
}
