/// Pickup domain entity for vehicle pickup flow.
class PickupEntity {
  final String vehicleId;
  final String vehicleNumber;
  final String vehicleModel;
  final String hubName;
  final String hubLocation;

  const PickupEntity({
    this.vehicleId = '',
    this.vehicleNumber = '',
    this.vehicleModel = '',
    this.hubName = '',
    this.hubLocation = '',
  });

  factory PickupEntity.fromJson(Map<String, dynamic> json) {
    final vehicle = json['vehicle'] as Map<String, dynamic>? ?? {};
    final hub = json['hub'] as Map<String, dynamic>? ?? {};
    return PickupEntity(
      vehicleId: vehicle['id'] as String? ?? json['vehicleId'] as String? ?? '',
      vehicleNumber: vehicle['vehicleNumber'] as String? ?? '',
      vehicleModel: vehicle['model'] as String? ?? '',
      hubName: hub['name'] as String? ?? json['hubName'] as String? ?? '',
      hubLocation:
          hub['location'] as String? ?? json['hubLocation'] as String? ?? '',
    );
  }
}
