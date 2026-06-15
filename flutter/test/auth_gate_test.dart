/// Tests for AuthGate — pure auth routing logic.
///
/// These are pure Dart unit tests with no Flutter widget testing overhead.
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/features/auth/presentation/auth_gate.dart';

void main() {
  group('AuthGate.hasSession', () {
    test('returns true when both riderId and token are present', () {
      expect(
        AuthGate.hasSession(riderId: 'VF-RD-1234', token: 'abc.def.ghi'),
        isTrue,
      );
    });

    test('returns false when riderId is null', () {
      expect(
        AuthGate.hasSession(riderId: null, token: 'abc.def.ghi'),
        isFalse,
      );
    });

    test('returns false when token is null', () {
      expect(
        AuthGate.hasSession(riderId: 'VF-RD-1234', token: null),
        isFalse,
      );
    });

    test('returns false when riderId is empty', () {
      expect(
        AuthGate.hasSession(riderId: '', token: 'abc.def.ghi'),
        isFalse,
      );
    });

    test('returns false when token is empty', () {
      expect(
        AuthGate.hasSession(riderId: 'VF-RD-1234', token: ''),
        isFalse,
      );
    });

    test('returns false when both are null', () {
      expect(AuthGate.hasSession(), isFalse);
    });
  });

  group('AuthGate.redirect', () {
    test('returns login when no session and not public route', () {
      final target = AuthGate.redirect(
        riderId: null,
        token: null,
        isPublicRoute: false,
      );
      expect(target, AuthGateTarget.login);
    });

    test('returns null for public routes regardless of session', () {
      final target = AuthGate.redirect(
        riderId: null,
        token: null,
        isPublicRoute: true,
      );
      expect(target, isNull);
    });

    test('returns null when session exists (lifecycle gate handles routing)', () {
      final target = AuthGate.redirect(
        riderId: 'VF-RD-1234',
        token: 'abc.def.ghi',
        isPublicRoute: false,
      );
      expect(target, isNull);
    });
  });

  group('AuthGate.isPublicRoute', () {
    test('login is public', () {
      expect(AuthGate.isPublicRoute('login'), isTrue);
    });

    test('splash is public', () {
      expect(AuthGate.isPublicRoute('splash'), isTrue);
    });

    test('otp is public', () {
      expect(AuthGate.isPublicRoute('otp'), isTrue);
    });

    test('legal is public', () {
      expect(AuthGate.isPublicRoute('legal'), isTrue);
    });

    test('dashboard is not public', () {
      expect(AuthGate.isPublicRoute('dashboard'), isFalse);
    });

    test('wallet is not public', () {
      expect(AuthGate.isPublicRoute('wallet'), isFalse);
    });
  });
}
