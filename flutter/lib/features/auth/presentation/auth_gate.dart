/// AuthGate — Pure routing logic for authentication state.
///
/// This is NOT a widget. It is a routing decision helper used by AppRouter.
/// It determines where the user should go based on auth state.
///
/// AppRouter calls AuthGate.redirect() to decide the initial route.
library;

enum AuthGateTarget {
  login,
  dashboard,
  onboarding,
  unknown,
}

/// Decides the redirect target based on session state.
///
/// Returns null if no redirect is needed (user is on the correct route).
class AuthGate {
  /// Check if the user has a valid session.
  ///
  /// A valid session means:
  /// - riderId is not null
  /// - token is not null/empty
  static bool hasSession({
    String? riderId,
    String? token,
  }) {
    return riderId != null && riderId.isNotEmpty &&
        token != null && token.isNotEmpty;
  }

  /// Determine where to redirect based on auth state.
  ///
  /// Returns the target route, or null if no redirect needed.
  static AuthGateTarget? redirect({
    String? riderId,
    String? token,
    bool isPublicRoute = false,
  }) {
    // Public routes (login, splash, legal) don't need auth
    if (isPublicRoute) return null;

    // No session → login
    if (!hasSession(riderId: riderId, token: token)) {
      return AuthGateTarget.login;
    }

    // Has session → no redirect needed (lifecycle gate handles the rest)
    return null;
  }

  /// Check if the current route is a public/unauthenticated route.
  static bool isPublicRoute(String routeName) {
    const publicRoutes = [
      'splash',
      'login',
      'otp',
      'authChoice',
      'legal',
      'permissions',
    ];
    return publicRoutes.contains(routeName);
  }
}
