import 'package:flutter/material.dart';
import '../core/platform/platform_info.dart';

class WebPlatformBanner extends StatelessWidget {
  const WebPlatformBanner({super.key});

  @override
  Widget build(BuildContext context) {
    if (!PlatformInfo.isWeb) return const SizedBox.shrink();
    
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      color: Colors.amber.shade100,
      child: Row(
        children: [
          Icon(Icons.info_outline, size: 16, color: Colors.amber.shade800),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              'Web mode — device admin, background location, and push notifications are not available.',
              style: TextStyle(fontSize: 11, color: Colors.amber.shade900),
            ),
          ),
        ],
      ),
    );
  }
}
