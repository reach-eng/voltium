// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'rider_rental.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

RiderRental _$RiderRentalFromJson(Map<String, dynamic> json) => RiderRental(
      rentalStatus: json['rentalStatus'] as String? ?? 'NONE',
      assignedVehicle: json['assignedVehicle'] as String?,
      vehicleModel: json['vehicleModel'] as String?,
      pickupHub: json['pickupHub'] as String?,
      teamLeader: json['teamLeader'] as String?,
      emergencyContact: json['emergencyContact'] as String?,
      intent: json['intent'] as String?,
      submissionDate: json['submissionDate'] == null
          ? null
          : DateTime.parse(json['submissionDate'] as String),
      returnPending: json['returnPending'] as bool? ?? false,
      pickupPhotoFront: json['pickupPhotoFront'] as String?,
      pickupPhotoBack: json['pickupPhotoBack'] as String?,
      pickupPhotoLeft: json['pickupPhotoLeft'] as String?,
      pickupPhotoRight: json['pickupPhotoRight'] as String?,
      pickupPhotoWithVehicle: json['pickupPhotoWithVehicle'] as String?,
      planDone: json['planDone'] as bool? ?? false,
      pickupDone: json['pickupDone'] as bool? ?? false,
    );

Map<String, dynamic> _$RiderRentalToJson(RiderRental instance) =>
    <String, dynamic>{
      'rentalStatus': instance.rentalStatus,
      'assignedVehicle': instance.assignedVehicle,
      'vehicleModel': instance.vehicleModel,
      'pickupHub': instance.pickupHub,
      'teamLeader': instance.teamLeader,
      'emergencyContact': instance.emergencyContact,
      'intent': instance.intent,
      'submissionDate': instance.submissionDate?.toIso8601String(),
      'returnPending': instance.returnPending,
      'pickupPhotoFront': instance.pickupPhotoFront,
      'pickupPhotoBack': instance.pickupPhotoBack,
      'pickupPhotoLeft': instance.pickupPhotoLeft,
      'pickupPhotoRight': instance.pickupPhotoRight,
      'pickupPhotoWithVehicle': instance.pickupPhotoWithVehicle,
      'planDone': instance.planDone,
      'pickupDone': instance.pickupDone,
    };
