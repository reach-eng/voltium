import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

class BackButtonHandler extends StatelessWidget {
  final Widget child;
  final VoidCallback? onBack;
  final bool showConfirmation;
  final String confirmationMessage;

  const BackButtonHandler({
    super.key,
    required this.child,
    this.onBack,
    this.showConfirmation = false,
    this.confirmationMessage = 'Are you sure you want to go back?',
  });

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: !showConfirmation,
      onPopInvokedWithResult: (didPop, result) async {
        if (didPop) return;

        if (showConfirmation) {
          final shouldPop = await _showConfirmationDialog(context);
          if (shouldPop && context.mounted) {
            Navigator.of(context).pop();
          }
        } else if (onBack != null) {
          onBack!();
        }
      },
      child: child,
    );
  }

  Future<bool> _showConfirmationDialog(BuildContext context) async {
    final result = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Go Back?'),
        content: Text(confirmationMessage),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Go Back'),
          ),
        ],
      ),
    );
    return result ?? false;
  }
}

class WillPopScopeWidget extends StatelessWidget {
  final Widget child;
  final Future<bool> Function()? onWillPop;

  const WillPopScopeWidget({
    super.key,
    required this.child,
    this.onWillPop,
  });

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: onWillPop == null,
      onPopInvokedWithResult: (didPop, result) async {
        if (didPop || onWillPop == null) return;
        final canPop = await onWillPop!();
        if (canPop && context.mounted) {
          Navigator.of(context).pop();
        }
      },
      child: child,
    );
  }
}
