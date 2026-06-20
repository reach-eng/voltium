import 'package:flutter/material.dart';

class FormScrollHelper {
  static void scrollToFirstError(
      BuildContext context, Map<String, String?> errors,) {
    String? firstErrorKey;
    for (final entry in errors.entries) {
      if (entry.value != null && entry.value!.isNotEmpty) {
        firstErrorKey = entry.key;
        break;
      }
    }

    if (firstErrorKey != null) {
      final context = primaryFocus?.context;
      if (context != null) {
        Scrollable.ensureVisible(
          context,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeInOut,
        );
      }
    }
  }

  static void scrollToWidget(BuildContext context, GlobalKey key) {
    final currentContext = key.currentContext;
    if (currentContext != null) {
      Scrollable.ensureVisible(
        currentContext,
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeInOut,
      );
    }
  }

  static GlobalKey createKey() => GlobalKey();

  static void showFieldError(BuildContext context, String fieldName) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Please fix $fieldName'),
        backgroundColor: const Color(0xFFD92D20),
        duration: const Duration(seconds: 2),
      ),
    );
  }
}

class AutoScrollForm extends StatefulWidget {
  final GlobalKey? scrollKey;
  final Widget child;
  final Map<String, String?> errors;
  final bool autoScroll;

  const AutoScrollForm({
    super.key,
    this.scrollKey,
    required this.child,
    required this.errors,
    this.autoScroll = true,
  });

  @override
  State<AutoScrollForm> createState() => _AutoScrollFormState();
}

class _AutoScrollFormState extends State<AutoScrollForm> {
  @override
  void didUpdateWidget(AutoScrollForm oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.autoScroll && _hasErrorsChanged(oldWidget.errors)) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        FormScrollHelper.scrollToFirstError(context, widget.errors);
      });
    }
  }

  bool _hasErrorsChanged(Map<String, String?> oldErrors) {
    final oldErrorsList =
        oldErrors.entries.where((e) => e.value != null).toList();
    final newErrorsList =
        widget.errors.entries.where((e) => e.value != null).toList();
    return oldErrorsList.length != newErrorsList.length;
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      key: widget.scrollKey,
      child: widget.child,
    );
  }
}
