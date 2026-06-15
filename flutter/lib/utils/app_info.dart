import 'package:flutter/material.dart';

class AppInfo {
  static const String name = 'Voltium';
  static const String version = '1.0.0';
  static const int buildNumber = 1;
  static const String platform = 'Flutter';

  static String get fullVersion => '$version ($buildNumber)';

  static String get appDescription => 'Voltium EV Rental Rider App';

  static Map<String, dynamic> get info => {
        'app_name': name,
        'version': version,
        'build': buildNumber,
        'platform': platform,
      };
}

class VersionWidget extends StatelessWidget {
  final bool showBuildNumber;

  const VersionWidget({
    super.key,
    this.showBuildNumber = false,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Text(
          AppInfo.name,
          style: const TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.bold,
            color: Color(0xFF0053C1),
          ),
        ),
        const SizedBox(height: 4),
        Text(
          showBuildNumber ? AppInfo.fullVersion : AppInfo.version,
          style: const TextStyle(
            fontSize: 14,
            color: Color(0xFF667085),
          ),
        ),
      ],
    );
  }
}
