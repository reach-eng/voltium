import 'package:flutter/material.dart';
import '../../../../theme/app_theme.dart';

/// Notification Center screen showing rider notifications.
class NotificationCenterScreen extends StatelessWidget {
  const NotificationCenterScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.iconBackground,
      appBar: AppBar(
        backgroundColor: AppColors.iconBackground,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        title: const Text('Notifications',
            style: TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF1E293B))),
        leading: Padding(
          padding: const EdgeInsets.only(left: 20),
          child: GestureDetector(
            onTap: () => Navigator.pop(context),
            child: Container(
              width: 40, height: 40,
              decoration: BoxDecoration(
                color: Colors.white, shape: BoxShape.circle,
                boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.05), blurRadius: 10, offset: const Offset(0, 4))],
              ),
              child: const Icon(Icons.arrow_back, color: Color(0xFF1E293B), size: 20),
            ),
          ),
        ),
      ),
      body: const Center(
        child: Text('No notifications yet',
            style: TextStyle(fontSize: 16, color: AppColors.slate500)),
      ),
    );
  }
}
