import 'dart:io';
import 'dart:convert';
import 'package:crypto/crypto.dart';
import 'package:http/http.dart' as http;
import 'package:http/io_client.dart';

http.Client createPinnedClient(List<String> activeFingerprints) {
  final httpClient = HttpClient(
      context: SecurityContext(withTrustedRoots: true))
    ..badCertificateCallback = (X509Certificate cert, String host, int port) {
      final digest = sha256.convert(cert.der);
      final extractedFingerprint = base64.encode(digest.bytes);
      final isValid = activeFingerprints.contains(extractedFingerprint);
      return isValid;
    };
  return IOClient(httpClient);
}
