import 'package:universal_io/io.dart';
import 'package:flutter/foundation.dart';
import 'api_client.dart';
import 'file_category.dart';
import 'generated/api_client.dart';
import '../../config/app_config.dart';
import '../../services/monitoring_service.dart';
import '../../utils/app_constants.dart';
import 'generated/api_models.dart';

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

    // PR-9 (F-081 — 2026-08-22 deep audit): client-side upload size
    // cap. The previous code accepted any file size and let the
    // signed-URL PUT 413-fail mid-stream — a 200MB Aadhaar photo
    // on a 2G connection would block the rider for the full
    // signedUploadTimeout, then lose the bytes they thought were
    // uploaded. A 10MB cap is generous for a KYC selfie or
    // Aadhaar scan and keeps the failure mode to a clean
    // client-side exception with a clear retry path.
    final fileSizeBytes = await file.length();
    final maxBytes = AppConstants.maxUploadFileSizeMb * 1024 * 1024;
    if (fileSizeBytes > maxBytes) {
      throw Exception(
        'File too large: ${(fileSizeBytes / 1024 / 1024).toStringAsFixed(1)}MB '
        '(max ${AppConstants.maxUploadFileSizeMb}MB). Please compress and retry.',
      );
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

      // Step 2: Upload file data to the signed URL via PUT.
      //
      // PR-3 (F-005 — 2026-08-22 deep audit): the previous code used
      // `package:http`'s top-level `http.put(...)` here, which bypassed
      // `PinnedHttpInterceptor` entirely. KYC selfies, Aadhaar/PAN
      // photos, deposit proofs, and signature scans all traversed an
      // unpinned TLS connection — a rogue CA could intercept them in
      // transit.
      //
      // The new `ApiClient.putRaw` reuses the SAME pinned http.Client
      // as the rest of the API. The signed-URL host's cert must be
      // registered via `PinnedHttpInterceptor.setDynamicPins(...)`
      // before the first upload; the release build will crash loudly
      // if no fingerprint covers the upload host (see
      // `PinnedHttpInterceptor.createClient`).
      final uri = Uri.parse(uploadUrl);
      final storagePath = uri.path.replaceFirst('/api/files/', '');
      String finalUploadUrl = uploadUrl;
      if (finalUploadUrl.startsWith('http')) {
        if (!kIsWeb && finalUploadUrl.contains('localhost')) {
          // PR-7 (F-065): use the platform-aware dev host helper
          // (10.0.2.2 on Android, 127.0.0.1 elsewhere) instead of
          // the hardcoded `10.0.2.2` which broke iOS simulators.
          finalUploadUrl =
              finalUploadUrl.replaceAll('localhost', AppConfig.localDevHost);
        }
      } else {
        finalUploadUrl = '${_client.baseUrl}$uploadUrl';
      }
      final uploadUri = Uri.parse(finalUploadUrl);

      // PR-8 (F-055 — 2026-08-22 deep audit): the previous override
      // (`Duration(seconds: 120)`) was a hardcoded constant that
      // silently drifted from `ApiClient.uploadTimeout` (60s).
      // Signed-URL uploads to S3 / Cloud Storage can legitimately
      // take longer than the regular multipart upload (larger
      // files, slower cross-region routes), so we use a
      // dedicated `signedUploadTimeout` on the client.
      final uploadResponse = await _client.putRaw(
        uploadUri,
        body: fileBytes,
        contentType: mimeType,
        timeout: ApiClient.signedUploadTimeout,
      );

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
    } catch (e, stack) {
      // PR-8 (F-054 — 2026-08-22 deep audit): the previous catch
      // logged via `appDebug` (kDebugMode-gated) and rethrew a
      // stringified `Exception('File upload failed: $e')` that
      // erased the original error type and stack. Two failures:
      //   1. Production builds had no observability — `appDebug`
      //      is a no-op outside debug mode, so the failure was
      //      truly silent in release.
      //   2. Callers couldn't `instanceof ApiException` to
      //      distinguish 4xx (bad file) from 5xx (server) from
      //      socket (network) — every failure looked the same.
      // Now logs via `MonitoringService.logError` (always
      // active, PII-masked) AND rethrows the ORIGINAL error so
      // callers retain the type and stack.
      MonitoringService.logError(e, stack,
          reason: 'FilesRepository: signed URL upload failed');
      rethrow;
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
