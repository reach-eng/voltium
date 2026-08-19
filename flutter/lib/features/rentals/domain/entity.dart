/// Rental plan types.
enum PlanType { daily, weekly, monthly }

/// Rental plan entity.
class RentalPlanEntity {
  final String id;
  final String name;
  final PlanType type;

  /// PR-RUPEES-2026-08-08: the plan price is now in **rupees** (decimal).
  /// Renamed from `pricePerPaise` (int) → `priceInRupees` (double). The
  /// API exposes rupees; the DB stores paise. The `fromJson` handles
  /// both the new `price` (already rupees) and the legacy
  /// `priceInPaise` (paise) for backwards-compat during the rollout.
  final double priceInRupees;

  final int durationDays;
  final String? description;

  const RentalPlanEntity({
    required this.id,
    required this.name,
    this.type = PlanType.daily,
    this.priceInRupees = 0,
    this.durationDays = 1,
    this.description,
  });

  factory RentalPlanEntity.fromJson(Map<String, dynamic> json) {
    // Prefer the new rupees-shaped field; fall back to the legacy
    // paise field if present.
    double rupees = 0.0;
    final priceRupees = json['priceInRupees'];
    final price = json['price'];
    final pricePaise = json['priceInPaise'];
    if (priceRupees is num) {
      rupees = priceRupees.toDouble();
    } else if (price is num) {
      rupees = price.toDouble();
    } else if (pricePaise is num) {
      rupees = pricePaise.toDouble() / 100.0;
    }
    return RentalPlanEntity(
      id: json['id'] as String,
      name: json['name'] as String? ?? '',
      type: _parseType(json['type'] as String?),
      priceInRupees: rupees,
      durationDays: (json['durationDays'] as num?)?.toInt() ?? 1,
      description: json['description'] as String?,
    );
  }

  static PlanType _parseType(String? type) {
    switch (type?.toUpperCase()) {
      case 'DAILY':
        return PlanType.daily;
      case 'WEEKLY':
        return PlanType.weekly;
      case 'MONTHLY':
        return PlanType.monthly;
      default:
        return PlanType.daily;
    }
  }
}

/// Active rental entity.
class ActiveRentalEntity {
  final String rentalStatus;
  final String? currentPlan;
  final String? assignedVehicle;
  final String? pickupHub;
  final DateTime? planStartDate;
  final DateTime? planEndDate;

  const ActiveRentalEntity({
    this.rentalStatus = 'NO_RENTAL',
    this.currentPlan,
    this.assignedVehicle,
    this.pickupHub,
    this.planStartDate,
    this.planEndDate,
  });

  bool get isActive => rentalStatus == 'ACTIVE';
  bool get isOverdue => rentalStatus == 'OVERDUE';

  factory ActiveRentalEntity.fromJson(Map<String, dynamic> json) {
    return ActiveRentalEntity(
      rentalStatus: json['rentalStatus'] as String? ?? 'NO_RENTAL',
      currentPlan: json['currentPlan'] as String?,
      assignedVehicle: json['assignedVehicle'] as String?,
      pickupHub: json['pickupHub'] as String?,
      planStartDate: json['planStartDate'] != null
          ? DateTime.tryParse(json['planStartDate'] as String)
          : null,
      planEndDate: json['planEndDate'] != null
          ? DateTime.tryParse(json['planEndDate'] as String)
          : null,
    );
  }
}
