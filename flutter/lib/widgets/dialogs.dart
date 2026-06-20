import 'package:flutter/material.dart';
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

Future<void> showSuccessSnackBar(BuildContext context, String message) async {
  ScaffoldMessenger.of(context).showSnackBar(
    SnackBar(
      content: Row(
        children: [
          const Icon(Icons.check_circle, color: Colors.white),
          const SizedBox(width: 8),
          Expanded(child: Text(message)),
        ],
      ),
      backgroundColor: Colors.green,
      behavior: SnackBarBehavior.floating,
    ),
  );
}

Future<void> showErrorSnackBar(BuildContext context, String message) async {
  ScaffoldMessenger.of(context).showSnackBar(
    SnackBar(
      content: Row(
        children: [
          const Icon(Icons.error, color: Colors.white),
          const SizedBox(width: 8),
          Expanded(child: Text(message)),
        ],
      ),
      backgroundColor: Colors.red,
      behavior: SnackBarBehavior.floating,
    ),
  );
}

Future<void> showInfoSnackBar(BuildContext context, String message) async {
  ScaffoldMessenger.of(context).showSnackBar(
    SnackBar(
      content: Row(
        children: [
          const Icon(Icons.info, color: Colors.white),
          const SizedBox(width: 8),
          Expanded(child: Text(message)),
        ],
      ),
      backgroundColor: AppColors.primary,
      behavior: SnackBarBehavior.floating,
    ),
  );
}
