/// A category of issues the rider can select for troubleshooting.
class TroubleshooterCategory {
  final String id;
  final String label;
  final String icon;
  final int color;
  final String rootNodeId;

  const TroubleshooterCategory({
    required this.id,
    required this.label,
    required this.icon,
    required this.color,
    required this.rootNodeId,
  });
}

/// A single node in the decision tree.
class TroubleshooterNode {
  final String id;
  final String question;
  final String? yesNodeId;
  final String? noNodeId;
  final bool isLeaf;
  final String? resolution;
  final String? resolutionType;
  final String? category;

  const TroubleshooterNode({
    required this.id,
    required this.question,
    this.yesNodeId,
    this.noNodeId,
    this.isLeaf = false,
    this.resolution,
    this.resolutionType,
    this.category,
  });
}

/// A recorded answer along the diagnostic path.
class TroubleshooterAnswer {
  final String question;
  final bool answer;
  final String nodeId;

  const TroubleshooterAnswer({
    required this.question,
    required this.answer,
    required this.nodeId,
  });

  Map<String, dynamic> toJson() => {
        'question': question,
        'answer': answer,
        'nodeId': nodeId,
      };
}

// ── Decision tree ───────────────────────────────────────────────────────────

final List<TroubleshooterCategory> troubleshooterCategories = [
  TroubleshooterCategory(
    id: 'battery',
    label: 'Battery & Charging',
    icon: 'battery_charging_full',
    color: 0xFF16A34A,
    rootNodeId: 'battery_root',
  ),
  TroubleshooterCategory(
    id: 'speed',
    label: 'Speed & Performance',
    icon: 'speed',
    color: 0xFF2563EB,
    rootNodeId: 'speed_root',
  ),
  TroubleshooterCategory(
    id: 'display',
    label: 'Display & Controls',
    icon: 'display_settings',
    color: 0xFF9333EA,
    rootNodeId: 'display_root',
  ),
  TroubleshooterCategory(
    id: 'noise',
    label: 'Unusual Noises',
    icon: 'hearing',
    color: 0xFFEA580C,
    rootNodeId: 'noise_root',
  ),
  TroubleshooterCategory(
    id: 'lock',
    label: 'Lock & Security',
    icon: 'lock_open',
    color: 0xFFDC2626,
    rootNodeId: 'lock_root',
  ),
  TroubleshooterCategory(
    id: 'gps',
    label: 'GPS & Navigation',
    icon: 'gps_off',
    color: 0xFF0891B2,
    rootNodeId: 'gps_root',
  ),
  TroubleshooterCategory(
    id: 'tires',
    label: 'Tires & Wheels',
    icon: 'tire_repair',
    color: 0xFF4F46E5,
    rootNodeId: 'tires_root',
  ),
];

final Map<String, TroubleshooterNode> _tree = {
  // ── Battery tree ─────────────────────────────────────────────────────────
  'battery_root': TroubleshooterNode(
    id: 'battery_root',
    question: 'Does the vehicle turn on at all?',
    yesNodeId: 'battery_on',
    noNodeId: 'battery_dead',
  ),
  'battery_on': TroubleshooterNode(
    id: 'battery_on',
    question: 'Does the battery indicator show a charge level below 20%?',
    yesNodeId: 'battery_low',
    noNodeId: 'battery_not_charging',
  ),
  'battery_low': TroubleshooterNode(
    id: 'battery_low',
    question: 'Have you tried charging for at least 30 minutes?',
    yesNodeId: 'battery_low_charged',
    noNodeId: 'battery_charge_advice',
  ),
  'battery_low_charged': TroubleshooterNode(
    id: 'battery_low_charged',
    question: 'Did the battery level increase after charging?',
    yesNodeId: 'battery_success',
    noNodeId: 'battery_not_charging',
  ),
  'battery_success': TroubleshooterNode(
    id: 'battery_success',
    question: '',
    isLeaf: true,
    resolution:
        'Your battery seems fine. The low charge was a temporary state. '
        'Make it a habit to charge overnight for a full experience.',
    resolutionType: 'SUCCESS',
    category: 'battery',
  ),
  'battery_dead': TroubleshooterNode(
    id: 'battery_dead',
    question: 'Is the charging cable properly connected to both the vehicle and power outlet?',
    yesNodeId: 'battery_dead_connected',
    noNodeId: 'battery_connect',
  ),
  'battery_dead_connected': TroubleshooterNode(
    id: 'battery_dead_connected',
    question: 'Does the charger indicator light turn on?',
    yesNodeId: 'battery_not_charging',
    noNodeId: 'battery_charger_fault',
  ),
  'battery_connect': TroubleshooterNode(
    id: 'battery_connect',
    question: '',
    isLeaf: true,
    resolution:
        'Please ensure the charging cable is firmly connected on both ends. '
        'Check that the power outlet is switched on.',
    resolutionType: 'SUCCESS',
    category: 'battery',
  ),
  'battery_charger_fault': TroubleshooterNode(
    id: 'battery_charger_fault',
    question: '',
    isLeaf: true,
    resolution:
        'The charger indicator is not lighting up. This could indicate a faulty charger '
        'or power supply issue. Try a different power outlet. If the problem persists, '
        'you may need a replacement charger.',
    resolutionType: 'NEEDS_SUPPORT',
    category: 'battery',
  ),
  'battery_not_charging': TroubleshooterNode(
    id: 'battery_not_charging',
    question: '',
    isLeaf: true,
    resolution:
        'The battery is not accepting charge. This could require a battery diagnostic. '
        'Please contact support to schedule a battery check.',
    resolutionType: 'NEEDS_SUPPORT',
    category: 'battery',
  ),
  'battery_charge_advice': TroubleshooterNode(
    id: 'battery_charge_advice',
    question: '',
    isLeaf: true,
    resolution:
        'Please charge the vehicle for at least 30 minutes and check the battery '
        'indicator again. If still below 20%, contact support.',
    resolutionType: 'SUCCESS',
    category: 'battery',
  ),

  // ── Speed tree ──────────────────────────────────────────────────────────
  'speed_root': TroubleshooterNode(
    id: 'speed_root',
    question: 'Does the vehicle accelerate from a standstill?',
    yesNodeId: 'speed_accel_yes',
    noNodeId: 'speed_no_accel',
  ),
  'speed_accel_yes': TroubleshooterNode(
    id: 'speed_accel_yes',
    question: 'Does the vehicle reach the expected top speed?',
    yesNodeId: 'speed_normal',
    noNodeId: 'speed_slow',
  ),
  'speed_normal': TroubleshooterNode(
    id: 'speed_normal',
    question: '',
    isLeaf: true,
    resolution:
        'Your vehicle\'s speed and acceleration appear normal. No further action needed.',
    resolutionType: 'SUCCESS',
    category: 'speed',
  ),
  'speed_slow': TroubleshooterNode(
    id: 'speed_slow',
    question: '',
    isLeaf: true,
    resolution:
        'Reduced top speed may indicate a battery or motor issue. Please contact support '
        'to schedule a performance check.',
    resolutionType: 'NEEDS_SUPPORT',
    category: 'speed',
  ),
  'speed_no_accel': TroubleshooterNode(
    id: 'speed_no_accel',
    question: '',
    isLeaf: true,
    resolution:
        'The vehicle is not responding to throttle input. This could be a motor controller '
        'or throttle sensor issue. Please contact support immediately.',
    resolutionType: 'NEEDS_SUPPORT',
    category: 'speed',
  ),

  // ── Display tree ────────────────────────────────────────────────────────
  'display_root': TroubleshooterNode(
    id: 'display_root',
    question: 'Is the display completely blank (black screen)?',
    yesNodeId: 'display_blank',
    noNodeId: 'display_glitch',
  ),
  'display_blank': TroubleshooterNode(
    id: 'display_blank',
    question: 'Did you try restarting the vehicle (power off/on)?',
    yesNodeId: 'display_restarted',
    noNodeId: 'display_restart',
  ),
  'display_restart': TroubleshooterNode(
    id: 'display_restart',
    question: '',
    isLeaf: true,
    resolution:
        'Please try restarting the vehicle by turning it off, waiting 10 seconds, '
        'and turning it back on.',
    resolutionType: 'SUCCESS',
    category: 'display',
  ),
  'display_restarted': TroubleshooterNode(
    id: 'display_restarted',
    question: '',
    isLeaf: true,
    resolution:
        'The display remains blank after restart. This could indicate a loose display '
        'connector or a hardware fault. Please contact support.',
    resolutionType: 'NEEDS_SUPPORT',
    category: 'display',
  ),
  'display_glitch': TroubleshooterNode(
    id: 'display_glitch',
    question: '',
    isLeaf: true,
    resolution:
        'Display glitches or unresponsive touch may require a firmware update or calibration. '
        'Please try restarting. If the issue persists, contact support.',
    resolutionType: 'NEEDS_SUPPORT',
    category: 'display',
  ),

  // ── Noise tree ──────────────────────────────────────────────────────────
  'noise_root': TroubleshooterNode(
    id: 'noise_root',
    question: 'Does the noise occur while the vehicle is stationary?',
    yesNodeId: 'noise_stationary',
    noNodeId: 'noise_moving',
  ),
  'noise_stationary': TroubleshooterNode(
    id: 'noise_stationary',
    question: '',
    isLeaf: true,
    resolution:
        'Unusual noises while stationary may indicate a loose component or electrical issue. '
        'Please inspect the vehicle visually and contact support if the noise persists.',
    resolutionType: 'NEEDS_SUPPORT',
    category: 'noise',
  ),
  'noise_moving': TroubleshooterNode(
    id: 'noise_moving',
    question: 'Does the noise come from the wheels or brakes?',
    yesNodeId: 'noise_wheels',
    noNodeId: 'noise_motor',
  ),
  'noise_wheels': TroubleshooterNode(
    id: 'noise_wheels',
    question: '',
    isLeaf: true,
    resolution:
        'Wheel or brake noises may indicate worn brake pads or debris in the brake assembly. '
        'Please inspect and contact support if the noise persists.',
    resolutionType: 'NEEDS_SUPPORT',
    category: 'noise',
  ),
  'noise_motor': TroubleshooterNode(
    id: 'noise_motor',
    question: '',
    isLeaf: true,
    resolution:
        'Motor noises could indicate a mechanical issue with the drivetrain. '
        'Please avoid riding and contact support immediately.',
    resolutionType: 'DANGER',
    category: 'noise',
  ),

  // ── Lock tree ───────────────────────────────────────────────────────────
  'lock_root': TroubleshooterNode(
    id: 'lock_root',
    question: 'Is the vehicle\'s steering lock engaged?',
    yesNodeId: 'lock_engaged',
    noNodeId: 'lock_unlock_issue',
  ),
  'lock_engaged': TroubleshooterNode(
    id: 'lock_engaged',
    question: '',
    isLeaf: true,
    resolution:
        'Gently turn the handlebars while pressing the unlock button to disengage '
        'the steering lock.',
    resolutionType: 'SUCCESS',
    category: 'lock',
  ),
  'lock_unlock_issue': TroubleshooterNode(
    id: 'lock_unlock_issue',
    question: '',
    isLeaf: true,
    resolution:
        'If you\'re having trouble locking/unlocking the vehicle, the lock mechanism '
        'may need servicing. Please contact support.',
    resolutionType: 'NEEDS_SUPPORT',
    category: 'lock',
  ),

  // ── GPS tree ────────────────────────────────────────────────────────────
  'gps_root': TroubleshooterNode(
    id: 'gps_root',
    question: 'Does the app show your current location accurately?',
    yesNodeId: 'gps_ok',
    noNodeId: 'gps_offline',
  ),
  'gps_ok': TroubleshooterNode(
    id: 'gps_ok',
    question: '',
    isLeaf: true,
    resolution:
        'GPS appears to be working correctly. If you\'re still experiencing issues, '
        'try restarting the app.',
    resolutionType: 'SUCCESS',
    category: 'gps',
  ),
  'gps_offline': TroubleshooterNode(
    id: 'gps_offline',
    question: '',
    isLeaf: true,
    resolution:
        'GPS signal may be weak. Ensure you\'re outdoors with a clear view of the sky. '
        'Check that location services are enabled in your device settings.',
    resolutionType: 'SUCCESS',
    category: 'gps',
  ),

  // ── Tires tree ──────────────────────────────────────────────────────────
  'tires_root': TroubleshooterNode(
    id: 'tires_root',
    question: 'Do the tires appear visibly flat or damaged?',
    yesNodeId: 'tires_damaged',
    noNodeId: 'tires_pressure',
  ),
  'tires_damaged': TroubleshooterNode(
    id: 'tires_damaged',
    question: '',
    isLeaf: true,
    resolution:
        'Visibly damaged or flat tires need immediate attention. Do not ride the vehicle. '
        'Please contact support for tire replacement.',
    resolutionType: 'DANGER',
    category: 'tires',
  ),
  'tires_pressure': TroubleshooterNode(
    id: 'tires_pressure',
    question: '',
    isLeaf: true,
    resolution:
        'Tires may need inflation. Recommended pressure is 30-35 PSI. '
        'Please inflate and check again. If the issue persists, contact support.',
    resolutionType: 'SUCCESS',
    category: 'tires',
  ),
};

TroubleshooterNode? findNode(String id) => _tree[id];

int maxTreeDepth(String rootNodeId) {
  int depth = 0;
  String? currentId = rootNodeId;
  while (currentId != null) {
    final node = _tree[currentId];
    if (node == null || node.isLeaf) break;
    // Follow the yes path to calculate max depth
    currentId = node.yesNodeId ?? node.noNodeId;
    depth++;
    if (depth > 20) break; // Safety limit
  }
  return depth;
}
