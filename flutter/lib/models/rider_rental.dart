import 'package:json_annotation/json_annotation.dart';

part 'rider_rental.g.dart';

/// Rental status, vehicle assignment, pickup details, and plan lifecycle.
///
/// Extracted from [RiderModel] — widgets that show rental/vehicle
/// information can depend only on this sub-model.
@JsonSerializable()
class RiderRental {
  final String rentalStatus;
  final String? assignedVehicle;
  final String? pickupHub;
  final String? teamLeader;
  final String? emergencyContact;
  final String? intent;
  final DateTime? submissionDate;
  final bool returnPending;

  // ── Pickup photos ─────────────────────────────────────────────────
  final String? pickupPhotoFront;
  final String? pickupPhotoBack;
  final String? pickupPhotoLeft;
  final String? pickupPhotoRight;
  final String? pickupPhotoWithVehicle;

  // ── Plan lifecycle booleans ───────────────────────────────────────
  final bool planDone;
  final bool pickupDone;

  const RiderRental({
    this.rentalStatus = 'NONE',
    this.assignedVehicle,
    this.pickupHub,
    this.teamLeader,
    this.emergencyContact,
    this.intent,
    this.submissionDate,
    this.returnPending = false,
    this.pickupPhotoFront,
    this.pickupPhotoBack,
    this.pickupPhotoLeft,
    this.pickupPhotoRight,
    this.pickupPhotoWithVehicle,
    this.planDone = false,
    this.pickupDone = false,
  });

  RiderRental copyWith({
    String? rentalStatus,
    String? assignedVehicle,
    String? pickupHub,
    String? teamLeader,
    String? emergencyContact,
    String? intent,
    DateTime? submissionDate,
    bool? returnPending,
    String? pickupPhotoFront,
    String? pickupPhotoBack,
    String? pickupPhotoLeft,
    String? pickupPhotoRight,
    String? pickupPhotoWithVehicle,
    bool? planDone,
    bool? pickupDone,
  }) {
    return RiderRental(
      rentalStatus: rentalStatus ?? this.rentalStatus,
      assignedVehicle: assignedVehicle ?? this.assignedVehicle,
      pickupHub: pickupHub ?? this.pickupHub,
      teamLeader: teamLeader ?? this.teamLeader,
      emergencyContact: emergencyContact ?? this.emergencyContact,
      intent: intent ?? this.intent,
      submissionDate: submissionDate ?? this.submissionDate,
      returnPending: returnPending ?? this.returnPending,
      pickupPhotoFront: pickupPhotoFront ?? this.pickupPhotoFront,
      pickupPhotoBack: pickupPhotoBack ?? this.pickupPhotoBack,
      pickupPhotoLeft: pickupPhotoLeft ?? this.pickupPhotoLeft,
      pickupPhotoRight: pickupPhotoRight ?? this.pickupPhotoRight,
      pickupPhotoWithVehicle:
          pickupPhotoWithVehicle ?? this.pickupPhotoWithVehicle,
      planDone: planDone ?? this.planDone,
      pickupDone: pickupDone ?? this.pickupDone,
    );
  }

  factory RiderRental.fromJson(Map<String, dynamic> json) =>
      _$RiderRentalFromJson(json);

  Map<String, dynamic> toJson() => _$RiderRentalToJson(this);
}
