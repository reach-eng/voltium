import 'package:http/http.dart' as http;

// Web has no dart:io — TLS is browser-terminated (same-origin /rider-app).
http.Client createPinnedClient(List<String> activeFingerprints) =>
    http.Client();
