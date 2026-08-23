import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../theme/app_theme.dart';

Future<bool> showConfirmDialog({
  required BuildContext context,
  required String title,
  required String message,
  String confirmText = 'Confirm',
  String cancelText = 'Cancel',
  bool isDestructive = false,
}) async {
  final result = await showDialog<bool>(
    context: context,
    builder: (context) => AlertDialog(
      title: Text(title),
      content: Text(message),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context, false),
          child: Text(cancelText),
        ),
        TextButton(
          onPressed: () => Navigator.pop(context, true),
          style: isDestructive
              ? TextButton.styleFrom(foregroundColor: AppColors.error)
              : null,
          child: Text(confirmText),
        ),
      ],
    ),
  );
  return result ?? false;
}

/// PR-4 (F-007 — 2026-08-22 deep audit): require the user to type a
/// literal phrase ("delete", the contact's name, etc.) before a
/// destructive action can fire. A simple `showConfirmDialog` is too
/// easy to confirm by accident — a mis-tap on the row above, a child
/// playing with the parent's phone, or a fat-finger on the Delete
/// button all clear the data. Typing the phrase forces a deliberate
/// decision.
///
/// The destructive button is **disabled** until the typed input
/// exactly matches [phrase] (case-insensitive). Returns `true` on
/// confirmation, `false` on cancel / dismiss / mismatch.
Future<bool> showDestructivePhraseDialog({
  required BuildContext context,
  required String title,
  required String message,
  required String phrase,
  String confirmText = 'Delete',
  String cancelText = 'Cancel',
}) async {
  assert(phrase.trim().isNotEmpty,
      'showDestructivePhraseDialog: phrase must be non-empty');
  final result = await showDialog<bool>(
    context: context,
    builder: (ctx) => _DestructivePhraseDialog(
      title: title,
      message: message,
      phrase: phrase,
      confirmText: confirmText,
      cancelText: cancelText,
    ),
  );
  return result ?? false;
}

/// Private StatefulWidget that owns the [TextEditingController] for
/// the destructive-phrase dialog. Owning the controller in a
/// [StatefulWidget] ensures it is disposed via the framework's
/// standard lifecycle (i.e. AFTER all dependents — the TextField,
/// the animated _ErrorWidget — have been deactivated). Disposing it
/// from the calling function before the dialog's exit animation
/// finishes causes "A TextEditingController was used after being
/// disposed" assertions during teardown.
class _DestructivePhraseDialog extends StatefulWidget {
  const _DestructivePhraseDialog({
    required this.title,
    required this.message,
    required this.phrase,
    required this.confirmText,
    required this.cancelText,
  });

  final String title;
  final String message;
  final String phrase;
  final String confirmText;
  final String cancelText;

  @override
  State<_DestructivePhraseDialog> createState() =>
      _DestructivePhraseDialogState();
}

class _DestructivePhraseDialogState extends State<_DestructivePhraseDialog> {
  final TextEditingController _controller = TextEditingController();
  bool _matches = false;
  bool _hasText = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return AlertDialog(
      backgroundColor: colors.surface,
      title: Text(widget.title),
      // Wrap in SingleChildScrollView so the dialog never
      // overflows when the surface is short (e.g. test
      // surfaces, split-screen, landscape on a small phone).
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(widget.message),
            const SizedBox(height: 16),
            Text(
              'Type ${widget.phrase} to confirm',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: colors.onSurfaceVariant,
                  ),
            ),
            const SizedBox(height: 8),
            TextField(
              autofocus: true,
              controller: _controller,
              onChanged: (v) {
                final m = v.trim().toLowerCase() == widget.phrase.toLowerCase();
                final has = v.isNotEmpty;
                if (m != _matches || has != _hasText) {
                  setState(() {
                    _matches = m;
                    _hasText = has;
                  });
                }
              },
              inputFormatters: [
                LengthLimitingTextInputFormatter(widget.phrase.length + 8),
              ],
              decoration: InputDecoration(
                hintText: widget.phrase,
                border: const OutlineInputBorder(),
                errorText: _hasText && !_matches
                    ? 'Must match ${widget.phrase}'
                    : null,
              ),
              onSubmitted: (_) {
                if (_matches) Navigator.of(context).pop(true);
              },
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context, false),
          child: Text(widget.cancelText),
        ),
        FilledButton(
          key: const Key('destructivePhraseConfirmButton'),
          onPressed: _matches ? () => Navigator.pop(context, true) : null,
          style: FilledButton.styleFrom(
            backgroundColor: AppColors.error,
            disabledBackgroundColor: AppColors.error.withValues(alpha: 0.4),
          ),
          child: Text(widget.confirmText),
        ),
      ],
    );
  }
}

Future<bool> showLogoutConfirmation(BuildContext context) async {
  return showConfirmDialog(
    context: context,
    title: 'Logout',
    message:
        'Are you sure you want to logout? Any unsaved changes will be lost.',
    confirmText: 'Logout',
    isDestructive: true,
  );
}

Future<bool> showDeleteConfirmation(
  BuildContext context, {
  String itemName = 'this item',
}) async {
  return showConfirmDialog(
    context: context,
    title: 'Delete $itemName?',
    message: 'This action cannot be undone.',
    confirmText: 'Delete',
    isDestructive: true,
  );
}

Future<bool> showDiscardChangesDialog(BuildContext context) async {
  return showConfirmDialog(
    context: context,
    title: 'Discard changes?',
    message: 'You have unsaved changes. Are you sure you want to leave?',
    confirmText: 'Discard',
    isDestructive: true,
  );
}
