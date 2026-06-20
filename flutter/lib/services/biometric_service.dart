import 'package:local_auth/local_auth.dart';
import 'package:flutter/services.dart';

class BiometricService {
  static final BiometricService _instance = BiometricService._internal();
  factory BiometricService() => _instance;
  BiometricService._internal();

  final LocalAuthentication _auth = LocalAuthentication();
  bool _isSupported = false;
  List<BiometricType> _availableBiometrics = [];

  Future<void> init() async {
    try {
      _isSupported = await _auth.isDeviceSupported();
      if (_isSupported) {
        _availableBiometrics = await _auth.getAvailableBiometrics();
      }
    } on PlatformException {
      _isSupported = false;
    }
  }

  bool get isSupported => _isSupported;
  List<BiometricType> get availableBiometrics => _availableBiometrics;

  bool get hasFingerprint =>
      _availableBiometrics.contains(BiometricType.fingerprint);
  bool get hasFace => _availableBiometrics.contains(BiometricType.face);
  bool get hasIris => _availableBiometrics.contains(BiometricType.iris);

  Future<bool> authenticate(
      {String reason = 'Authenticate to access Voltium',}) async {
    if (!_isSupported) return false;

    try {
      return await _auth.authenticate(
        localizedReason: reason,
        options: const AuthenticationOptions(
          stickyAuth: true,
          biometricOnly: false,
          useErrorDialogs: true,
        ),
      );
    } on PlatformException {
      return false;
    }
  }

  Future<bool> authenticateWithBiometricsOnly(
      {String reason = 'Use biometric to authenticate',}) async {
    if (!_isSupported) return false;

    try {
      return await _auth.authenticate(
        localizedReason: reason,
        options: const AuthenticationOptions(
          stickyAuth: true,
          biometricOnly: true,
          useErrorDialogs: true,
        ),
      );
    } on PlatformException {
      return false;
    }
  }

  Future<bool> stopAuthentication() async {
    try {
      return await _auth.stopAuthentication();
    } on PlatformException {
      return false;
    }
  }
}
