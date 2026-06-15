import '../data/troubleshooter_tree.dart';

class TroubleshooterResult {
  const TroubleshooterResult({
    required this.path,
    required this.resolution,
    required this.resolutionType,
    this.category,
  });

  final List<TroubleshooterAnswer> path;
  final String resolution;
  final String resolutionType;
  final String? category;

  Map<String, dynamic> toJson() => {
        'path': path.map((a) => a.toJson()).toList(),
        'resolution': resolution,
        'resolutionType': resolutionType,
        'category': category,
      };
}
