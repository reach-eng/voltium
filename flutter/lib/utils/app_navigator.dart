import 'package:flutter/material.dart';

class AppNavigator {
  static void push(BuildContext context, Widget page, {String? routeName}) {
    Navigator.push(
      context,
      PageTransitions.slide(page: page),
    ).catchError((e) {
      debugPrint('[AppNavigator] Navigation error on push: $e');
    });
  }

  static void pushReplacement(BuildContext context, Widget page,
      {String? routeName,}) {
    Navigator.pushReplacement(
      context,
      PageTransitions.slide(page: page),
    ).catchError((e) {
      debugPrint('[AppNavigator] Navigation error on pushReplacement: $e');
    });
  }

  static void pop(BuildContext context) {
    Navigator.pop(context);
  }

  static void popUntilFirst(BuildContext context) {
    Navigator.popUntil(context, (route) => route.isFirst);
  }

  static Future<T?> pushForResult<T>(BuildContext context, Widget page) {
    return Navigator.push<T>(
      context,
      PageTransitions.slide(page: page),
    );
  }
}

class PageTransitions {
  static const Duration _duration = Duration(milliseconds: 300);
  static const Curve _curve = Curves.easeInOut;

  static Route<T> slide<T>({
    required Widget page,
    RouteSettings? settings,
    AxisDirection direction = AxisDirection.right,
  }) {
    final offsetTween = _getOffsetTween(direction);

    return PageRouteBuilder<T>(
      settings: settings,
      transitionDuration: _duration,
      reverseTransitionDuration: _duration,
      pageBuilder: (context, animation, secondaryAnimation) => page,
      transitionsBuilder: (context, animation, secondaryAnimation, child) {
        final curvedAnimation = CurvedAnimation(
          parent: animation,
          curve: _curve,
        );
        return SlideTransition(
          position: offsetTween.animate(curvedAnimation),
          child: FadeTransition(
            opacity: curvedAnimation,
            child: child,
          ),
        );
      },
    );
  }

  static Route<T> fade<T>({
    required Widget page,
    RouteSettings? settings,
  }) {
    return PageRouteBuilder<T>(
      settings: settings,
      transitionDuration: const Duration(milliseconds: 200),
      reverseTransitionDuration: const Duration(milliseconds: 200),
      pageBuilder: (context, animation, secondaryAnimation) => page,
      transitionsBuilder: (context, animation, secondaryAnimation, child) {
        return FadeTransition(opacity: animation, child: child);
      },
    );
  }

  static Route<T> scale<T>({
    required Widget page,
    RouteSettings? settings,
  }) {
    return PageRouteBuilder<T>(
      settings: settings,
      transitionDuration: _duration,
      reverseTransitionDuration: _duration,
      pageBuilder: (context, animation, secondaryAnimation) => page,
      transitionsBuilder: (context, animation, secondaryAnimation, child) {
        final curvedAnimation = CurvedAnimation(
          parent: animation,
          curve: Curves.easeOutCubic,
        );
        return ScaleTransition(
          scale: Tween<double>(begin: 0.95, end: 1.0).animate(curvedAnimation),
          child: FadeTransition(opacity: curvedAnimation, child: child),
        );
      },
    );
  }

  static Tween<Offset> _getOffsetTween(AxisDirection direction) {
    switch (direction) {
      case AxisDirection.up:
        return Tween<Offset>(begin: const Offset(0, 1), end: Offset.zero);
      case AxisDirection.down:
        return Tween<Offset>(begin: const Offset(0, -1), end: Offset.zero);
      case AxisDirection.left:
        return Tween<Offset>(begin: const Offset(1, 0), end: Offset.zero);
      case AxisDirection.right:
        return Tween<Offset>(begin: const Offset(-1, 0), end: Offset.zero);
    }
  }
}
