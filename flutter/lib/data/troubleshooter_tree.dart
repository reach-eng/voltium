/// EV troubleshooting decision‑tree data layer.
///
/// A JSON‑style binary tree where each [TroubleshooterNode] represents either a
/// diagnostic question (branches to `yesNodeId` / `noNodeId`) or a leaf
/// resolution (has a non‑null [resolution]).
///
/// The exported [troubleshooterTree] list contains every node for seven issue
/// categories: acceleration, screen, battery, noise, lock, GPS and tire
/// pressure.  Each category has a dedicated root node whose `id` doubles as the
/// entry point for that issue path.
///
/// Usage:
/// ```dart
/// final root = troubleshooterTree.firstWhere((n) => n.id == 'accel_q1');
/// ```
library;

// =============================================================================
// Data models
// =============================================================================

/// A single node in the troubleshooting decision tree.
///
/// If [yesNodeId] or [noNodeId] is non‑null the node is a **question** and the
/// troubleshooter must navigate to the referenced node based on the user's
/// answer.
///
/// If [resolution] is non‑null the node is a **leaf** and represents the final
/// outcome of the diagnostic path.
class TroubleshooterNode {
  const TroubleshooterNode({
    required this.id,
    required this.question,
    this.yesNodeId,
    this.noNodeId,
    this.resolution,
    this.resolutionType = 'SUCCESS',
    this.category,
  });

  /// Unique identifier — used for graph traversal and path tracking.
  final String id;

  /// The question text shown to the rider, or the title of a resolution node.
  final String question;

  /// ID of the next node when the user answers **Yes**.
  final String? yesNodeId;

  /// ID of the next node when the user answers **No**.
  final String? noNodeId;

  /// Human‑readable resolution text.  Non‑null only on leaf nodes.
  final String? resolution;

  /// Semantic type of the resolution.
  ///
  /// * `SUCCESS`   — self‑help action resolved the issue.
  /// * `FAILED`    — the suggested fix did not work.
  /// * `NEEDS_SUPPORT` — the rider must contact Ryd support.
  /// * `DANGER`    — immediate safety concern / SOS.
  final String resolutionType;

  /// Free‑form category string for support‑ticket tagging.
  final String? category;

  /// Convenience: `true` when this node is a leaf (has a resolution).
  bool get isLeaf => resolution != null;
}

/// A single answer recorded while walking the tree.
class TroubleshooterAnswer {
  const TroubleshooterAnswer({
    required this.question,
    required this.answer,
    required this.nodeId,
  });

  final String question;

  /// `true` → rider answered **Yes**, `false` → rider answered **No**.
  final bool answer;

  /// The [TroubleshooterNode.id] of the question that was answered.
  final String nodeId;

  Map<String, dynamic> toJson() => {
        'question': question,
        'answer': answer,
        'nodeId': nodeId,
      };
}

/// Metadata about a top‑level issue category shown on the selection screen.
class TroubleshooterCategory {
  const TroubleshooterCategory({
    required this.id,
    required this.label,
    required this.icon,
    required this.rootNodeId,
    required this.color,
  });

  final String id;
  final String label;
  final String icon; // Material icon name
  final String rootNodeId;
  final int color; // ARGB int
}

// =============================================================================
// Category list — shown on the initial selection screen
// =============================================================================

const troubleshooterCategories = <TroubleshooterCategory>[
  TroubleshooterCategory(
    id: 'acceleration',
    label: "Scooter Won't Accelerate",
    icon: 'speed',
    rootNodeId: 'accel_q1',
    color: 0xFFFF6D00,
  ),
  TroubleshooterCategory(
    id: 'display',
    label: 'Screen is Blank',
    icon: 'display_settings',
    rootNodeId: 'screen_q1',
    color: 0xFF1565C0,
  ),
  TroubleshooterCategory(
    id: 'battery',
    label: 'Battery Not Charging',
    icon: 'battery_charging_full',
    rootNodeId: 'battery_q1',
    color: 0xFF2E7D32,
  ),
  TroubleshooterCategory(
    id: 'noise',
    label: 'Unusual Noise',
    icon: 'hearing',
    rootNodeId: 'noise_q1',
    color: 0xFF6A1B9A,
  ),
  TroubleshooterCategory(
    id: 'lock',
    label: 'Lock Not Opening',
    icon: 'lock_open',
    rootNodeId: 'lock_q1',
    color: 0xFFC62828,
  ),
  TroubleshooterCategory(
    id: 'gps',
    label: 'GPS Not Working',
    icon: 'gps_off',
    rootNodeId: 'gps_q1',
    color: 0xFF00838F,
  ),
  TroubleshooterCategory(
    id: 'tire',
    label: 'Tire Pressure Warning',
    icon: 'tire_repair',
    rootNodeId: 'tire_q1',
    color: 0xFFAD1457,
  ),
];

// =============================================================================
// Full decision tree
// =============================================================================

/// Complete troubleshooting decision tree (49 nodes across 7 issue paths).
///
/// Leaf nodes have a non‑null [TroubleshooterNode.resolution].
/// Question nodes have non‑null [TroubleshooterNode.yesNodeId] and/or
/// [TroubleshooterNode.noNodeId].
const troubleshooterTree = <TroubleshooterNode>[
  // ╔══════════════════════════════════════════════════════════════════════════╗
  // ║  1. SCOOTER WON'T ACCELERATE                                           ║
  // ╚══════════════════════════════════════════════════════════════════════════╝

  TroubleshooterNode(
    id: 'accel_q1',
    question: 'Is the scooter powered on?',
    yesNodeId: 'accel_q2',
    noNodeId: 'accel_leaf_5',
    category: 'acceleration',
  ),
  TroubleshooterNode(
    id: 'accel_q2',
    question: 'Are there any error lights on the display?',
    yesNodeId: 'accel_q3',
    noNodeId: 'accel_q4',
    category: 'acceleration',
  ),
  TroubleshooterNode(
    id: 'accel_q3',
    question: 'Is the kickstand down?',
    yesNodeId: 'accel_leaf_1',
    noNodeId: 'accel_leaf_2',
    category: 'acceleration',
  ),
  TroubleshooterNode(
    id: 'accel_leaf_1',
    question: 'Kickstand detected',
    resolution:
        'Try removing and reinserting the key. The scooter should start after the key is properly seated.',
    resolutionType: 'SUCCESS',
    category: 'acceleration',
  ),
  TroubleshooterNode(
    id: 'accel_leaf_2',
    question: 'No kickstand issue',
    resolution:
        'Tighten the key connector. If the connector is loose the ignition signal may not reach the controller.',
    resolutionType: 'SUCCESS',
    category: 'acceleration',
  ),
  TroubleshooterNode(
    id: 'accel_q4',
    question: 'Is the battery above 20%?',
    yesNodeId: 'accel_leaf_3',
    noNodeId: 'accel_leaf_4',
    category: 'acceleration',
  ),
  TroubleshooterNode(
    id: 'accel_leaf_3',
    question: 'Battery sufficient but no acceleration',
    resolution:
        'Contact Ryd support — this is likely a motor or controller issue. Please do not ride the scooter.',
    resolutionType: 'NEEDS_SUPPORT',
    category: 'motor',
  ),
  TroubleshooterNode(
    id: 'accel_leaf_4',
    question: 'Battery critically low',
    resolution:
        'Charge the scooter for at least 15 minutes and retry. Low battery can prevent acceleration as a safety measure.',
    resolutionType: 'SUCCESS',
    category: 'battery',
  ),
  TroubleshooterNode(
    id: 'accel_leaf_5',
    question: 'Scooter is off',
    resolution:
        'Turn on the scooter using the power button. If it does not start, connect the charger for 15 minutes and try again.',
    resolutionType: 'SUCCESS',
    category: 'battery',
  ),

  // ╔══════════════════════════════════════════════════════════════════════════╗
  // ║  2. SCREEN IS BLANK                                                    ║
  // ╚══════════════════════════════════════════════════════════════════════════╝

  TroubleshooterNode(
    id: 'screen_q1',
    question: 'Is the scooter powered on?',
    yesNodeId: 'screen_q2',
    noNodeId: 'screen_q3',
    category: 'display',
  ),
  TroubleshooterNode(
    id: 'screen_q2',
    question:
        'Press and hold the power button for 10 seconds. Does the screen turn on?',
    yesNodeId: 'screen_leaf_1',
    noNodeId: 'screen_leaf_2',
    category: 'display',
  ),
  TroubleshooterNode(
    id: 'screen_leaf_1',
    question: 'Screen restored',
    resolution:
        'The screen should now be working. If it goes blank again, note when it happens and contact support.',
    resolutionType: 'SUCCESS',
    category: 'display',
  ),
  TroubleshooterNode(
    id: 'screen_leaf_2',
    question: 'Screen still blank after restart',
    resolution:
        'Contact Ryd support — the display may have a hardware fault.',
    resolutionType: 'NEEDS_SUPPORT',
    category: 'display',
  ),
  TroubleshooterNode(
    id: 'screen_q3',
    question:
        'Connect the charger — does the screen show a charging indicator?',
    yesNodeId: 'screen_q4',
    noNodeId: 'screen_leaf_5',
    category: 'display',
  ),
  TroubleshooterNode(
    id: 'screen_q4',
    question:
        'Try a hard restart: hold power + brake for 10 seconds. Does the screen turn on?',
    yesNodeId: 'screen_leaf_3',
    noNodeId: 'screen_leaf_4',
    category: 'display',
  ),
  TroubleshooterNode(
    id: 'screen_leaf_3',
    question: 'Screen restored via hard restart',
    resolution:
        'The screen restarted successfully. The issue may have been a firmware glitch.',
    resolutionType: 'SUCCESS',
    category: 'display',
  ),
  TroubleshooterNode(
    id: 'screen_leaf_4',
    question: 'Screen still blank after hard restart',
    resolution:
        'Contact Ryd support — the display unit likely needs replacement.',
    resolutionType: 'NEEDS_SUPPORT',
    category: 'display',
  ),
  TroubleshooterNode(
    id: 'screen_leaf_5',
    question: 'No charging indicator',
    resolution:
        'Contact Ryd support — there may be a power delivery issue to the display.',
    resolutionType: 'NEEDS_SUPPORT',
    category: 'display',
  ),

  // ╔══════════════════════════════════════════════════════════════════════════╗
  // ║  3. BATTERY NOT CHARGING                                               ║
  // ╚══════════════════════════════════════════════════════════════════════════╝

  TroubleshooterNode(
    id: 'battery_q1',
    question: 'Is the charger properly connected to the scooter?',
    yesNodeId: 'battery_q2',
    noNodeId: 'battery_q4',
    category: 'battery',
  ),
  TroubleshooterNode(
    id: 'battery_q2',
    question: "Is the charger's green light on?",
    yesNodeId: 'battery_q3',
    noNodeId: 'battery_leaf_3',
    category: 'battery',
  ),
  TroubleshooterNode(
    id: 'battery_q3',
    question: 'Wait 10 minutes. Is the charging percentage increasing?',
    yesNodeId: 'battery_leaf_1',
    noNodeId: 'battery_leaf_2',
    category: 'battery',
  ),
  TroubleshooterNode(
    id: 'battery_leaf_1',
    question: 'Charging normally',
    resolution:
        'Charging is working as expected. The percentage should increase steadily over time.',
    resolutionType: 'SUCCESS',
    category: 'battery',
  ),
  TroubleshooterNode(
    id: 'battery_leaf_2',
    question: 'Not charging despite green light',
    resolution:
        'Try a different charging station. The current station may have a faulty outlet.',
    resolutionType: 'SUCCESS',
    category: 'battery',
  ),
  TroubleshooterNode(
    id: 'battery_leaf_3',
    question: 'Charger light not on',
    resolution:
        'The charger may be faulty. Try a different charger or charging cable.',
    resolutionType: 'SUCCESS',
    category: 'battery',
  ),
  TroubleshooterNode(
    id: 'battery_q4',
    question: 'Is the charging port clean and free of debris?',
    yesNodeId: 'battery_leaf_4',
    noNodeId: 'battery_leaf_5',
    category: 'battery',
  ),
  TroubleshooterNode(
    id: 'battery_leaf_4',
    question: 'Port looks clean',
    resolution:
        'Try wiggling the charging cable gently to ensure a firm connection.',
    resolutionType: 'SUCCESS',
    category: 'battery',
  ),
  TroubleshooterNode(
    id: 'battery_leaf_5',
    question: 'Charging port dirty',
    resolution:
        'Contact Ryd support — the charging port may need professional cleaning or repair.',
    resolutionType: 'NEEDS_SUPPORT',
    category: 'charging_port',
  ),

  // ╔══════════════════════════════════════════════════════════════════════════╗
  // ║  4. UNUSUAL NOISE                                                      ║
  // ╚══════════════════════════════════════════════════════════════════════════╝

  TroubleshooterNode(
    id: 'noise_q1',
    question: 'Does the noise happen only when braking?',
    yesNodeId: 'noise_leaf_1',
    noNodeId: 'noise_q2',
    category: 'noise',
  ),
  TroubleshooterNode(
    id: 'noise_leaf_1',
    question: 'Noise during braking',
    resolution:
        'This is normal — it is the regenerative braking sound. The motor acts as a generator to slow the scooter and recharge the battery.',
    resolutionType: 'SUCCESS',
    category: 'mechanical',
  ),
  TroubleshooterNode(
    id: 'noise_q2',
    question: 'Does the noise happen at low speed?',
    yesNodeId: 'noise_q3',
    noNodeId: 'noise_leaf_4',
    category: 'noise',
  ),
  TroubleshooterNode(
    id: 'noise_q3',
    question: 'Does the noise stop when you accelerate?',
    yesNodeId: 'noise_leaf_2',
    noNodeId: 'noise_leaf_3',
    category: 'noise',
  ),
  TroubleshooterNode(
    id: 'noise_leaf_2',
    question: 'Noise at low speed, stops on acceleration',
    resolution:
        'This is likely a motor bearing issue. Please book a service appointment — continuing to ride may cause further damage.',
    resolutionType: 'NEEDS_SUPPORT',
    category: 'motor',
  ),
  TroubleshooterNode(
    id: 'noise_leaf_3',
    question: 'Persistent noise',
    resolution:
        'Contact Ryd support for further diagnosis. Please avoid riding until the issue is checked.',
    resolutionType: 'NEEDS_SUPPORT',
    category: 'mechanical',
  ),
  TroubleshooterNode(
    id: 'noise_leaf_4',
    question: 'Noise at higher speeds',
    resolution:
        'Contact Ryd support for further diagnosis. The issue may be related to the drivetrain or wheel assembly.',
    resolutionType: 'NEEDS_SUPPORT',
    category: 'mechanical',
  ),

  // ╔══════════════════════════════════════════════════════════════════════════╗
  // ║  5. LOCK NOT OPENING                                                   ║
  // ╚══════════════════════════════════════════════════════════════════════════╝

  TroubleshooterNode(
    id: 'lock_q1',
    question: "Is the app showing 'Ride Active'?",
    yesNodeId: 'lock_leaf_1',
    noNodeId: 'lock_q2',
    category: 'lock',
  ),
  TroubleshooterNode(
    id: 'lock_leaf_1',
    question: 'Ride already active',
    resolution:
        'Force-close and reopen the Ryd app. Tap "End Ride" first, then try the lock again.',
    resolutionType: 'SUCCESS',
    category: 'lock',
  ),
  TroubleshooterNode(
    id: 'lock_q2',
    question: 'Is the scooter powered on?',
    yesNodeId: 'lock_leaf_2',
    noNodeId: 'lock_leaf_3',
    category: 'lock',
  ),
  TroubleshooterNode(
    id: 'lock_leaf_2',
    question: 'Scooter is on',
    resolution:
        'Try restarting the scooter and attempt the lock again from the app.',
    resolutionType: 'SUCCESS',
    category: 'lock',
  ),
  TroubleshooterNode(
    id: 'lock_leaf_3',
    question: 'Scooter is off',
    resolution:
        'Check if the lock mechanism has battery. If the lock battery is dead, the electronic lock cannot disengage.',
    resolutionType: 'SUCCESS',
    category: 'battery',
  ),

  // ╔══════════════════════════════════════════════════════════════════════════╗
  // ║  6. GPS NOT WORKING                                                    ║
  // ╚══════════════════════════════════════════════════════════════════════════╝

  TroubleshooterNode(
    id: 'gps_q1',
    question: 'Are you in an underground area or parking garage?',
    yesNodeId: 'gps_leaf_1',
    noNodeId: 'gps_q2',
    category: 'gps',
  ),
  TroubleshooterNode(
    id: 'gps_leaf_1',
    question: 'Underground / garage',
    resolution:
        'Move to an open outdoor area. GPS may take up to 2 minutes to reconnect after leaving an enclosed space.',
    resolutionType: 'SUCCESS',
    category: 'gps',
  ),
  TroubleshooterNode(
    id: 'gps_q2',
    question: 'Restart the scooter. Does the GPS signal return?',
    yesNodeId: 'gps_leaf_2',
    noNodeId: 'gps_leaf_3',
    category: 'gps',
  ),
  TroubleshooterNode(
    id: 'gps_leaf_2',
    question: 'GPS restored',
    resolution:
        'GPS is working normally after restart. This was likely a temporary glitch.',
    resolutionType: 'SUCCESS',
    category: 'gps',
  ),
  TroubleshooterNode(
    id: 'gps_leaf_3',
    question: 'GPS still not working',
    resolution:
        'Contact Ryd support with your current location. The GPS module may need recalibration or replacement.',
    resolutionType: 'NEEDS_SUPPORT',
    category: 'gps',
  ),

  // ╔══════════════════════════════════════════════════════════════════════════╗
  // ║  7. TIRE PRESSURE WARNING                                              ║
  // ╚══════════════════════════════════════════════════════════════════════════╝

  TroubleshooterNode(
    id: 'tire_q1',
    question: 'Can you see which tire has the low‑pressure warning?',
    yesNodeId: 'tire_q2',
    noNodeId: 'tire_leaf_1',
    category: 'tire',
  ),
  TroubleshooterNode(
    id: 'tire_q2',
    question: 'Is the pressure below 20 PSI?',
    yesNodeId: 'tire_leaf_2',
    noNodeId: 'tire_leaf_3',
    category: 'tire',
  ),
  TroubleshooterNode(
    id: 'tire_leaf_2',
    question: 'Critically low pressure',
    resolution:
        'Inflate the tire to 32 PSI at the nearest air pump. Do not ride on a severely under‑inflated tire.',
    resolutionType: 'SUCCESS',
    category: 'tire',
  ),
  TroubleshooterNode(
    id: 'tire_leaf_3',
    question: 'Moderately low pressure',
    resolution:
        'Monitor the pressure for the next ride. Report to support if it drops below 25 PSI.',
    resolutionType: 'SUCCESS',
    category: 'tire',
  ),
  TroubleshooterNode(
    id: 'tire_leaf_1',
    question: 'Cannot identify tire',
    resolution:
        'Park the scooter safely and contact Ryd support with a photo of all tires for identification.',
    resolutionType: 'NEEDS_SUPPORT',
    category: 'tire',
  ),
];

// =============================================================================
// Tree helpers
// =============================================================================

/// Fast node lookup by [id].
TroubleshooterNode? findNode(String id) {
  for (final node in troubleshooterTree) {
    if (node.id == id) return node;
  }
  return null;
}

/// Returns the total depth from [startId] to the nearest leaf node
/// (used to display "Step X of Y").
int treeDepth(String startId) {
  int depth = 0;
  String? current = startId;
  final visited = <String>{};

  while (current != null && !visited.contains(current)) {
    visited.add(current);
    depth++;
    final node = findNode(current);
    if (node == null || node.isLeaf) break;
    // Prefer the longer branch for the step counter.
    current = node.yesNodeId ?? node.noNodeId;
  }
  return depth;
}

/// Collects the maximum depth from [startId] (longest path to any leaf).
int maxTreeDepth(String startId) {
  int _walk(String? id, Set<String> visited) {
    if (id == null || visited.contains(id)) return 0;
    visited.add(id);
    final node = findNode(id);
    if (node == null || node.isLeaf) return 1;
    final y = _walk(node.yesNodeId, visited);
    final n = _walk(node.noNodeId, visited);
    return 1 + (y > n ? y : n);
  }

  return _walk(startId, {});
}
