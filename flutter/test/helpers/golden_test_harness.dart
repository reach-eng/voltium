import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// A wrapper for golden tests to supply standard MediaQuery, Theme, and Locales.
class GoldenTestHarness extends StatelessWidget {
  final Widget child;
  final ThemeMode themeMode;

  const GoldenTestHarness({
    super.key,
    required this.child,
    this.themeMode = ThemeMode.light,
  });

  @override
  Widget build(BuildContext context) {
    return ProviderScope(
      child: MaterialApp(
        themeMode: themeMode,
        theme: ThemeData.light(),
        darkTheme: ThemeData.dark(),
        debugShowCheckedModeBanner: false,
        home: Scaffold(
          body: child,
        ),
      ),
    );
  }
}
