/// Profile domain entity representing the rider's personal information.
class ProfileEntity {
  final String riderId;
  final String fullName;
  final String phone;
  final String? email;
  final String? fatherName;
  final String? motherName;
  final String? currentAddress;
  final String? emergencyContact;
  final String? dob;
  final String? profilePhotoUrl;

  const ProfileEntity({
    this.riderId = '',
    this.fullName = '',
    this.phone = '',
    this.email,
    this.fatherName,
    this.motherName,
    this.currentAddress,
    this.emergencyContact,
    this.dob,
    this.profilePhotoUrl,
  });

  factory ProfileEntity.fromJson(Map<String, dynamic> json) {
    return ProfileEntity(
      riderId: json['riderId'] as String? ?? json['id'] as String? ?? '',
      fullName: json['fullName'] as String? ?? '',
      phone: json['phone'] as String? ?? '',
      email: json['email'] as String?,
      fatherName: json['fatherName'] as String?,
      motherName: json['motherName'] as String?,
      currentAddress: json['currentAddress'] as String?,
      emergencyContact: json['emergencyContact'] as String?,
      dob: json['dob'] as String?,
      profilePhotoUrl: json['profilePhoto'] as String?,
    );
  }
}
