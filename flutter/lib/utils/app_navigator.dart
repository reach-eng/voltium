import 'package:flutter/material.dart';
import 'page_transitions.dart';
import 'app_logger.dart';

class AppNavigator {
  static void push(BuildContext context, Widget page, {String? routeName}) {
    Navigator.push(
      context,
      AppPageTransitions.slide(page),
    ).catchError((e) {
      appDebug('[AppNavigator] Navigation error on push: $e');
    });
  }

  static void pushReplacement(
    BuildContext context,
    Widget page, {
    String? routeName,
  }) {
    Navigator.pushReplacement(
      context,
      AppPageTransitions.slide(page),
    ).catchError((e) {
      appDebug('[AppNavigator] Navigation error on pushReplacement: $e');
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
      AppPageTransitions.slide(page),
    );
  }
}
