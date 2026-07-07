import 'package:json_annotation/json_annotation.dart';

@JsonEnum(fieldRename: FieldRename.none)
enum KycField {
  aadhaarFront,
  aadhaarBack,
  pan,
  selfie,
  signature,
  name,
  email,
  dob,
  address,
  fatherName,
  motherName,
  bankName,
  bankAccount,
  bankIfsc
}
