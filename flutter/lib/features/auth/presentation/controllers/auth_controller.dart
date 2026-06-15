import 'package:flutter/foundation.dart';
import '../../domain/entity.dart';
import '../../domain/repository.dart';
import 'package:voltium_rider/core/storage/secure_storage.dart';

/// Authentication flow states for the router.
enum AuthFlowState { phoneEntry, otpVerification, authenticated, error }

/// Controller for the authentication flow.
///
/// Manages the full auth lifecycle:
///   * Session check on startup (checks SecureStorage for existing token)
///   * OTP send/verify
///   * Token persistence on login
///   * Clean logout with storage clearing
///
/// Integrates with:
///   - [SecureStorage] for token persistence across app restarts
///   - [AppRouter] for auth-aware screen navigation
class AuthController extends ChangeNotifier {
  final AuthRepository _repository;
  final SecureStorage _storage;

  AuthController({
    required AuthRepository repository,
    SecureStorage? storage,
  })  : _repository = repository,
        _storage = storage ?? SecureStorage();

  // ── State ───────────────────────────────────────────────────────────────

  AuthFlowState _flowState = AuthFlowState.phoneEntry;
  AuthFlowState get flowState => _flowState;

  String _phone = '';
  String get phone => _phone;

  bool _isLoading = false;
  bool get isLoading => _isLoading;

  bool _isCheckingSession = true;
  bool get isCheckingSession => _isCheckingSession;

  bool _isAuthenticated = false;
  bool get isAuthenticated => _isAuthenticated;

  String? _errorMessage;
  String? get errorMessage => _errorMessage;

  bool _isNewRider = false;
  bool get isNewRider => _isNewRider;

  String? _token;
  String? get token => _token;

  String? _riderId;
  String? get riderId => _riderId;

  // ── Session Check ───────────────────────────────────────────────────────

  /// Check for an existing session on app startup.
  /// Called once by [AppRouter] to determine the initial screen.
  Future<void> checkSession() async {
    _isCheckingSession = true;
    notifyListeners();

    try {
      final hasToken = await _storage.isLoggedIn();
      if (hasToken) {
        _token = await _storage.getSessionToken();
        _riderId = await _storage.getRiderId();
        _isAuthenticated = true;
        _flowState = AuthFlowState.authenticated;
      }
    } catch (e) {
      debugPrint('[AuthController] Session check failed: $e');
      // Fall through — show login screen
    } finally {
      _isCheckingSession = false;
      notifyListeners();
    }
  }

  // ── Send OTP ────────────────────────────────────────────────────────────

  Future<bool> sendOtp(String phone, {String? referralCode}) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final result = await _repository.sendOtp(phone, referralCode: referralCode);
      _phone = phone;
      _flowState = AuthFlowState.otpVerification;
      return result.exists;
    } catch (e) {
      _errorMessage = _humanReadableError(e);
      _flowState = AuthFlowState.error;
      return false;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  // ── Verify OTP ──────────────────────────────────────────────────────────

  Future<bool> verifyOtp(String otp) async {
    if (_phone.isEmpty) return false;

    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final result = await _repository.verifyOtp(_phone, otp);

      // Persist session token
      if (result.token.isNotEmpty) {
        await _storage.saveSessionToken(result.token);
      }
      if (result.riderId.isNotEmpty) {
        await _storage.saveRiderId(result.riderId);
      }

      _token = result.token;
      _riderId = result.riderId;
      _isNewRider = result.isNewRider;
      _isAuthenticated = true;
      _flowState = AuthFlowState.authenticated;
      return true;
    } catch (e) {
      _errorMessage = _humanReadableError(e);
      _flowState = AuthFlowState.error;
      return false;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  // ── Logout ──────────────────────────────────────────────────────────────

  Future<void> logout() async {
    try {
      await _repository.logout();
    } catch (_) {
      // Best-effort logout — clear local state regardless
    }

    await _storage.clearSession();
    _reset();
  }

  // ── Reset ───────────────────────────────────────────────────────────────

  void _reset() {
    _flowState = AuthFlowState.phoneEntry;
    _phone = '';
    _token = null;
    _riderId = null;
    _errorMessage = null;
    _isNewRider = false;
    _isAuthenticated = false;
    _isLoading = false;
    notifyListeners();
  }

  /// Go back from OTP verification to phone entry.
  void goBackToPhoneEntry() {
    _flowState = AuthFlowState.phoneEntry;
    _errorMessage = null;
    notifyListeners();
  }

  void resetError() {
    _errorMessage = null;
    if (_flowState == AuthFlowState.error) {
      _flowState = AuthFlowState.phoneEntry;
    }
    notifyListeners();
  }

  // ── Helpers ─────────────────────────────────────────────────────────────

  String _humanReadableError(dynamic error) {
    final msg = error.toString().toLowerCase();
    if (msg.contains('network') || msg.contains('timeout')) {
      return 'Network error. Please check your connection.';
    }
    if (msg.contains('401') || msg.contains('unauthorized')) {
      return 'Invalid OTP. Please try again.';
    }
    if (msg.contains('429') || msg.contains('rate limit')) {
      return 'Too many attempts. Please wait a moment.';
    }
    debugPrint('[AuthController] Error: $error');
    return 'Something went wrong. Please try again.';
  }
}
