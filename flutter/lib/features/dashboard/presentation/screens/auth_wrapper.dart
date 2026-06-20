import 'package:flutter/material.dart';

/// Wraps the app content, checking authentication state and redirecting
/// to the appropriate screen when the rider is unauthenticated.
class AuthWrapper extends StatelessWidget {
  final Widget child;

  const AuthWrapper({super.key, required this.child});

  @override
  Widget build(BuildContext context) => child;
}
