import 'package:flutter/material.dart';

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
              ? TextButton.styleFrom(foregroundColor: Colors.red)
              : null,
          child: Text(confirmText),
        ),
      ],
    ),
  );
  return result ?? false;
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

/// @deprecated Use [Toast] from `utils/toast.dart` instead.
///
///   Toast.success(context, msg)
///   Toast.error(context, msg)
///   Toast.info(context, msg)
@Deprecated('Use Toast from utils/toast.dart instead')
Future<void> showSuccessSnackBar(BuildContext context, String message) async {
  throw UnimplementedError('Migrate to Toast.success()');
}

/// @deprecated Use [Toast] from `utils/toast.dart` instead.
@Deprecated('Use Toast from utils/toast.dart instead')
Future<void> showErrorSnackBar(BuildContext context, String message) async {
  throw UnimplementedError('Migrate to Toast.error()');
}

/// @deprecated Use [Toast] from `utils/toast.dart` instead.
@Deprecated('Use Toast from utils/toast.dart instead')
Future<void> showInfoSnackBar(BuildContext context, String message) async {
  throw UnimplementedError('Migrate to Toast.info()');
}
