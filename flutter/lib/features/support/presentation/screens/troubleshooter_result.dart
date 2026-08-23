import 'package:voltium_rider/data/troubleshooter_tree.dart';

class TroubleshooterResult {
  const TroubleshooterResult({
    required this.path,
    required this.resolution,
    required this.resolutionType,
    this.category,
  });

  final List<TroubleshooterAnswer> path;
  final String resolution;
  // PR-7 (F-066): now a typed enum (not a String) so a typo
  // like 'NEEDS_SUPPPORT' or 'DANGAR' is a compile error.
  final TroubleshooterResolutionType resolutionType;
  final String? category;

  Map<String, dynamic> toJson() => {
        'path': path.map((a) => a.toJson()).toList(),
        'resolution': resolution,
        'resolutionType': resolutionType.name,
        'category': category,
      };
}
