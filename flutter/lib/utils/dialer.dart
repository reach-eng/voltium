import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:voltium_rider/utils/toast.dart';

Future<bool> launchDialer(
  BuildContext context,
  String phone, {
  String? failureMessage,
}) async {
  final sanitized = phone.replaceAll(RegExp(r'[^0-9+]'), '');
  if (sanitized.isEmpty) return false;
  final uri = Uri.parse('tel:');
  try {
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
      return true;
    } else {
      if (context.mounted && failureMessage != null) {
        Toast.error(context, failureMessage);
      }
      return false;
    }
  } catch (e) {
    if (context.mounted && failureMessage != null) {
      Toast.error(context, failureMessage);
    }
    return false;
  }
}
