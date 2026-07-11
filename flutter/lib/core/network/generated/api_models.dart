// GENERATED CODE - DO NOT MODIFY BY HAND
// Generated from OpenAPI spec using generate-client.ts

class SendOtpRequest {
  final String phone;

  SendOtpRequest({
    required this.phone,
  });

  factory SendOtpRequest.fromJson(Map<String, dynamic> json) {
    return SendOtpRequest(
      phone: json['phone'] as String,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'phone': phone,
    };
  }
}

class SendOtpResponse {
  final bool? exists;
  final String? otp;

  SendOtpResponse({
    this.exists,
    this.otp,
  });

  factory SendOtpResponse.fromJson(Map<String, dynamic> json) {
    return SendOtpResponse(
      exists: json['exists'] as bool?,
      otp: json['otp']?.toString(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'exists': exists,
      'otp': otp,
    };
  }
}

class VerifyOtpRequest {
  final String? phone;
  final String? otp;
  final String? idToken;
  final String? referralCode;

  VerifyOtpRequest({
    this.phone,
    this.otp,
    this.idToken,
    this.referralCode,
  });

  factory VerifyOtpRequest.fromJson(Map<String, dynamic> json) {
    return VerifyOtpRequest(
      phone: json['phone'] as String?,
      otp: json['otp']?.toString(),
      idToken: json['idToken'] as String?,
      referralCode: json['referralCode'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'phone': phone,
      'otp': otp,
      'idToken': idToken,
      'referralCode': referralCode,
    };
  }
}

class VerifyOtpResponse {
  final String? riderId;
  final String? phone;
  final String? fullName;
  final String? state;
  final String? kycStatus;
  final String? guarantorStatus;
  final int? walletBalance;
  final String? depositStatus;
  final String? rentalStatus;
  final String? referralCode;
  final String? token;
  final String? accountStatus;
  final bool? isNewRider;
  final String? fcmCommandSecret;
  final String? refreshToken;

  VerifyOtpResponse({
    this.riderId,
    this.phone,
    this.fullName,
    this.state,
    this.kycStatus,
    this.guarantorStatus,
    this.walletBalance,
    this.depositStatus,
    this.rentalStatus,
    this.referralCode,
    this.token,
    this.accountStatus,
    this.isNewRider,
    this.fcmCommandSecret,
    this.refreshToken,
  });

  factory VerifyOtpResponse.fromJson(Map<String, dynamic> json) {
    return VerifyOtpResponse(
      riderId: json['riderId'] as String?,
      phone: json['phone'] as String?,
      fullName: json['fullName'] as String?,
      state: json['state'] as String?,
      kycStatus: json['kycStatus'] as String?,
      guarantorStatus: json['guarantorStatus'] as String?,
      walletBalance: json['walletBalance'] as int?,
      depositStatus: json['depositStatus'] as String?,
      rentalStatus: json['rentalStatus'] as String?,
      referralCode: json['referralCode'] as String?,
      token: json['token'] as String?,
      accountStatus: json['accountStatus'] as String?,
      isNewRider: json['isNewRider'] as bool?,
      fcmCommandSecret: json['fcmCommandSecret'] as String?,
      refreshToken: json['refreshToken'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'riderId': riderId,
      'phone': phone,
      'fullName': fullName,
      'state': state,
      'kycStatus': kycStatus,
      'guarantorStatus': guarantorStatus,
      'walletBalance': walletBalance,
      'depositStatus': depositStatus,
      'rentalStatus': rentalStatus,
      'referralCode': referralCode,
      'token': token,
      'accountStatus': accountStatus,
      'isNewRider': isNewRider,
      'fcmCommandSecret': fcmCommandSecret,
      'refreshToken': refreshToken,
    };
  }
}

class RiderProfileResponse {
  final String? riderId;
  final String? phone;
  final String? fullName;
  final String? state;
  final String? kycStatus;
  final String? guarantorStatus;
  final int? walletBalance;
  final String? depositStatus;
  final String? rentalStatus;
  final String? referralCode;
  final String? accountStatus;
  final String? email;
  final String? fatherName;
  final String? motherName;
  final String? currentAddress;
  final String? emergencyContact;
  final String? dob;
  final String? profilePhoto;
  final String? aadhaarFront;
  final String? aadhaarBack;
  final String? panCard;

  RiderProfileResponse({
    this.riderId,
    this.phone,
    this.fullName,
    this.state,
    this.kycStatus,
    this.guarantorStatus,
    this.walletBalance,
    this.depositStatus,
    this.rentalStatus,
    this.referralCode,
    this.accountStatus,
    this.email,
    this.fatherName,
    this.motherName,
    this.currentAddress,
    this.emergencyContact,
    this.dob,
    this.profilePhoto,
    this.aadhaarFront,
    this.aadhaarBack,
    this.panCard,
  });

  factory RiderProfileResponse.fromJson(Map<String, dynamic> json) {
    return RiderProfileResponse(
      riderId: json['riderId'] as String?,
      phone: json['phone'] as String?,
      fullName: json['fullName'] as String?,
      state: json['state'] as String?,
      kycStatus: json['kycStatus'] as String?,
      guarantorStatus: json['guarantorStatus'] as String?,
      walletBalance: json['walletBalance'] as int?,
      depositStatus: json['depositStatus'] as String?,
      rentalStatus: json['rentalStatus'] as String?,
      referralCode: json['referralCode'] as String?,
      accountStatus: json['accountStatus'] as String?,
      email: json['email'] as String?,
      fatherName: json['fatherName'] as String?,
      motherName: json['motherName'] as String?,
      currentAddress: json['currentAddress'] as String?,
      emergencyContact: json['emergencyContact'] as String?,
      dob: json['dob'] as String?,
      profilePhoto: json['profilePhoto'] as String?,
      aadhaarFront: json['aadhaarFront'] as String?,
      aadhaarBack: json['aadhaarBack'] as String?,
      panCard: json['panCard'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'riderId': riderId,
      'phone': phone,
      'fullName': fullName,
      'state': state,
      'kycStatus': kycStatus,
      'guarantorStatus': guarantorStatus,
      'walletBalance': walletBalance,
      'depositStatus': depositStatus,
      'rentalStatus': rentalStatus,
      'referralCode': referralCode,
      'accountStatus': accountStatus,
      'email': email,
      'fatherName': fatherName,
      'motherName': motherName,
      'currentAddress': currentAddress,
      'emergencyContact': emergencyContact,
      'dob': dob,
      'profilePhoto': profilePhoto,
      'aadhaarFront': aadhaarFront,
      'aadhaarBack': aadhaarBack,
      'panCard': panCard,
    };
  }
}

class UpdateProfileRequest {
  final String? riderId;
  final String? fullName;
  final dynamic email;
  final String? fatherName;
  final String? motherName;
  final String? currentAddress;
  final String? emergencyContact;
  final String? dob;
  final String? intent;
  final dynamic profilePhoto;
  final dynamic riderPhoto;
  final dynamic signature;
  final dynamic aadhaarFront;
  final dynamic aadhaarBack;
  final dynamic panCard;
  final dynamic bankName;
  final dynamic bankAccount;
  final dynamic bankIfsc;
  final dynamic selfie;
  final bool? returnPending;
  final List<String>? returnPhotos;
  final String? returnReason;
  final double? latitude;
  final double? longitude;
  final String? guarantorName;
  final String? guarantorPhone;
  final String? guarantorRelation;
  final String? guarantorDob;
  final String? guarantorFatherName;
  final String? guarantorMotherName;
  final String? guarantorAddress;
  final String? guarantorAadhaarFront;
  final String? guarantorAadhaarBack;
  final String? guarantorPan;
  final String? guarantorVideo;
  final String? guarantorSignature;
  final String? guarantorPhoto;
  final String? guarantorStatus;
  final bool? locationGranted;
  final bool? batteryGranted;
  final bool? contactsGranted;
  final bool? callLogsGranted;
  final bool? micGranted;
  final bool? cameraGranted;
  final bool? phoneGranted;

  UpdateProfileRequest({
    this.riderId,
    this.fullName,
    this.email,
    this.fatherName,
    this.motherName,
    this.currentAddress,
    this.emergencyContact,
    this.dob,
    this.intent,
    this.profilePhoto,
    this.riderPhoto,
    this.signature,
    this.aadhaarFront,
    this.aadhaarBack,
    this.panCard,
    this.bankName,
    this.bankAccount,
    this.bankIfsc,
    this.selfie,
    this.returnPending,
    this.returnPhotos,
    this.returnReason,
    this.latitude,
    this.longitude,
    this.guarantorName,
    this.guarantorPhone,
    this.guarantorRelation,
    this.guarantorDob,
    this.guarantorFatherName,
    this.guarantorMotherName,
    this.guarantorAddress,
    this.guarantorAadhaarFront,
    this.guarantorAadhaarBack,
    this.guarantorPan,
    this.guarantorVideo,
    this.guarantorSignature,
    this.guarantorPhoto,
    this.guarantorStatus,
    this.locationGranted,
    this.batteryGranted,
    this.contactsGranted,
    this.callLogsGranted,
    this.micGranted,
    this.cameraGranted,
    this.phoneGranted,
  });

  factory UpdateProfileRequest.fromJson(Map<String, dynamic> json) {
    return UpdateProfileRequest(
      riderId: json['riderId'] as String?,
      fullName: json['fullName'] as String?,
      email: json['email'],
      fatherName: json['fatherName'] as String?,
      motherName: json['motherName'] as String?,
      currentAddress: json['currentAddress'] as String?,
      emergencyContact: json['emergencyContact'] as String?,
      dob: json['dob'] as String?,
      intent: json['intent'] as String?,
      profilePhoto: json['profilePhoto'],
      riderPhoto: json['riderPhoto'],
      signature: json['signature'],
      aadhaarFront: json['aadhaarFront'],
      aadhaarBack: json['aadhaarBack'],
      panCard: json['panCard'],
      bankName: json['bankName'],
      bankAccount: json['bankAccount'],
      bankIfsc: json['bankIfsc'],
      selfie: json['selfie'],
      returnPending: json['returnPending'] as bool?,
      returnPhotos: json['returnPhotos'] != null
          ? (json['returnPhotos'] as List).map((e) => e as String).toList()
          : null,
      returnReason: json['returnReason'] as String?,
      latitude: json['latitude'] != null
          ? (json['latitude'] as num).toDouble()
          : null,
      longitude: json['longitude'] != null
          ? (json['longitude'] as num).toDouble()
          : null,
      guarantorName: json['guarantorName'] as String?,
      guarantorPhone: json['guarantorPhone'] as String?,
      guarantorRelation: json['guarantorRelation'] as String?,
      guarantorDob: json['guarantorDob'] as String?,
      guarantorFatherName: json['guarantorFatherName'] as String?,
      guarantorMotherName: json['guarantorMotherName'] as String?,
      guarantorAddress: json['guarantorAddress'] as String?,
      guarantorAadhaarFront: json['guarantorAadhaarFront'] as String?,
      guarantorAadhaarBack: json['guarantorAadhaarBack'] as String?,
      guarantorPan: json['guarantorPan'] as String?,
      guarantorVideo: json['guarantorVideo'] as String?,
      guarantorSignature: json['guarantorSignature'] as String?,
      guarantorPhoto: json['guarantorPhoto'] as String?,
      guarantorStatus: json['guarantorStatus'] as String?,
      locationGranted: json['locationGranted'] as bool?,
      batteryGranted: json['batteryGranted'] as bool?,
      contactsGranted: json['contactsGranted'] as bool?,
      callLogsGranted: json['callLogsGranted'] as bool?,
      micGranted: json['micGranted'] as bool?,
      cameraGranted: json['cameraGranted'] as bool?,
      phoneGranted: json['phoneGranted'] as bool?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'riderId': riderId,
      'fullName': fullName,
      'email': email,
      'fatherName': fatherName,
      'motherName': motherName,
      'currentAddress': currentAddress,
      'emergencyContact': emergencyContact,
      'dob': dob,
      'intent': intent,
      'profilePhoto': profilePhoto,
      'riderPhoto': riderPhoto,
      'signature': signature,
      'aadhaarFront': aadhaarFront,
      'aadhaarBack': aadhaarBack,
      'panCard': panCard,
      'bankName': bankName,
      'bankAccount': bankAccount,
      'bankIfsc': bankIfsc,
      'selfie': selfie,
      'returnPending': returnPending,
      'returnPhotos': returnPhotos,
      'returnReason': returnReason,
      'latitude': latitude,
      'longitude': longitude,
      'guarantorName': guarantorName,
      'guarantorPhone': guarantorPhone,
      'guarantorRelation': guarantorRelation,
      'guarantorDob': guarantorDob,
      'guarantorFatherName': guarantorFatherName,
      'guarantorMotherName': guarantorMotherName,
      'guarantorAddress': guarantorAddress,
      'guarantorAadhaarFront': guarantorAadhaarFront,
      'guarantorAadhaarBack': guarantorAadhaarBack,
      'guarantorPan': guarantorPan,
      'guarantorVideo': guarantorVideo,
      'guarantorSignature': guarantorSignature,
      'guarantorPhoto': guarantorPhoto,
      'guarantorStatus': guarantorStatus,
      'locationGranted': locationGranted,
      'batteryGranted': batteryGranted,
      'contactsGranted': contactsGranted,
      'callLogsGranted': callLogsGranted,
      'micGranted': micGranted,
      'cameraGranted': cameraGranted,
      'phoneGranted': phoneGranted,
    };
  }
}

class SubmitKycRequest {
  final String riderId;
  final String aadhaarNumber;
  final String panNumber;
  final String bankName;
  final String bankAccount;
  final String bankIfsc;
  final dynamic aadhaarFront;
  final dynamic aadhaarBack;
  final dynamic panCard;
  final dynamic profilePhoto;
  final dynamic signature;

  SubmitKycRequest({
    required this.riderId,
    required this.aadhaarNumber,
    required this.panNumber,
    required this.bankName,
    required this.bankAccount,
    required this.bankIfsc,
    this.aadhaarFront,
    this.aadhaarBack,
    this.panCard,
    this.profilePhoto,
    this.signature,
  });

  factory SubmitKycRequest.fromJson(Map<String, dynamic> json) {
    return SubmitKycRequest(
      riderId: json['riderId'] as String,
      aadhaarNumber: json['aadhaarNumber'] as String,
      panNumber: json['panNumber'] as String,
      bankName: json['bankName'] as String,
      bankAccount: json['bankAccount'] as String,
      bankIfsc: json['bankIfsc'] as String,
      aadhaarFront: json['aadhaarFront'],
      aadhaarBack: json['aadhaarBack'],
      panCard: json['panCard'],
      profilePhoto: json['profilePhoto'],
      signature: json['signature'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'riderId': riderId,
      'aadhaarNumber': aadhaarNumber,
      'panNumber': panNumber,
      'bankName': bankName,
      'bankAccount': bankAccount,
      'bankIfsc': bankIfsc,
      'aadhaarFront': aadhaarFront,
      'aadhaarBack': aadhaarBack,
      'panCard': panCard,
      'profilePhoto': profilePhoto,
      'signature': signature,
    };
  }
}

class SubmitKycResponse {
  final String? id;
  final String? riderId;
  final String? kycStatus;

  SubmitKycResponse({
    this.id,
    this.riderId,
    this.kycStatus,
  });

  factory SubmitKycResponse.fromJson(Map<String, dynamic> json) {
    return SubmitKycResponse(
      id: json['id'] as String?,
      riderId: json['riderId'] as String?,
      kycStatus: json['kycStatus'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'riderId': riderId,
      'kycStatus': kycStatus,
    };
  }
}

class KycStatusResponse {
  final String? kycStatus;
  final String? profilePhoto;
  final String? riderPhoto;
  final String? signature;
  final String? aadhaarFront;
  final String? aadhaarBack;
  final String? panCard;
  final String? bankName;
  final String? rejectionReason;

  KycStatusResponse({
    this.kycStatus,
    this.profilePhoto,
    this.riderPhoto,
    this.signature,
    this.aadhaarFront,
    this.aadhaarBack,
    this.panCard,
    this.bankName,
    this.rejectionReason,
  });

  factory KycStatusResponse.fromJson(Map<String, dynamic> json) {
    return KycStatusResponse(
      kycStatus: json['kycStatus'] as String?,
      profilePhoto: json['profilePhoto'] as String?,
      riderPhoto: json['riderPhoto'] as String?,
      signature: json['signature'] as String?,
      aadhaarFront: json['aadhaarFront'] as String?,
      aadhaarBack: json['aadhaarBack'] as String?,
      panCard: json['panCard'] as String?,
      bankName: json['bankName'] as String?,
      rejectionReason: json['rejectionReason'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'kycStatus': kycStatus,
      'profilePhoto': profilePhoto,
      'riderPhoto': riderPhoto,
      'signature': signature,
      'aadhaarFront': aadhaarFront,
      'aadhaarBack': aadhaarBack,
      'panCard': panCard,
      'bankName': bankName,
      'rejectionReason': rejectionReason,
    };
  }
}

class ReviewKycRequest {
  final String riderId;
  final String action;
  final String? rejectionReason;
  final String? infoRequest;

  ReviewKycRequest({
    required this.riderId,
    required this.action,
    this.rejectionReason,
    this.infoRequest,
  });

  factory ReviewKycRequest.fromJson(Map<String, dynamic> json) {
    return ReviewKycRequest(
      riderId: json['riderId'] as String,
      action: json['action'] as String,
      rejectionReason: json['rejectionReason'] as String?,
      infoRequest: json['infoRequest'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'riderId': riderId,
      'action': action,
      'rejectionReason': rejectionReason,
      'infoRequest': infoRequest,
    };
  }
}

class TopupRequest {
  final String riderId;
  final double amount;
  final String? purpose;
  final String method;
  final String? upiRef;
  final String? proofUrl;

  TopupRequest({
    required this.riderId,
    required this.amount,
    this.purpose,
    required this.method,
    this.upiRef,
    this.proofUrl,
  });

  factory TopupRequest.fromJson(Map<String, dynamic> json) {
    return TopupRequest(
      riderId: json['riderId'] as String,
      amount: (json['amount'] as num).toDouble(),
      purpose: json['purpose'] as String?,
      method: json['method'] as String,
      upiRef: json['upiRef'] as String?,
      proofUrl: json['proofUrl'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'riderId': riderId,
      'amount': amount,
      'purpose': purpose,
      'method': method,
      'upiRef': upiRef,
      'proofUrl': proofUrl,
    };
  }
}

class TopupResponse {
  final String? id;
  final double? amount;
  final String? status;
  final bool? idempotent;

  TopupResponse({
    this.id,
    this.amount,
    this.status,
    this.idempotent,
  });

  factory TopupResponse.fromJson(Map<String, dynamic> json) {
    return TopupResponse(
      id: json['id'] as String?,
      amount:
          json['amount'] != null ? (json['amount'] as num).toDouble() : null,
      status: json['status'] as String?,
      idempotent: json['idempotent'] as bool?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'amount': amount,
      'status': status,
      'idempotent': idempotent,
    };
  }
}

class ReviewDepositRequest {
  final String riderId;
  final String action;
  final String? reason;
  final double? refundAmount;
  final double? bonusAmount;

  ReviewDepositRequest({
    required this.riderId,
    required this.action,
    this.reason,
    this.refundAmount,
    this.bonusAmount,
  });

  factory ReviewDepositRequest.fromJson(Map<String, dynamic> json) {
    return ReviewDepositRequest(
      riderId: json['riderId'] as String,
      action: json['action'] as String,
      reason: json['reason'] as String?,
      refundAmount: json['refundAmount'] != null
          ? (json['refundAmount'] as num).toDouble()
          : null,
      bonusAmount: json['bonusAmount'] != null
          ? (json['bonusAmount'] as num).toDouble()
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'riderId': riderId,
      'action': action,
      'reason': reason,
      'refundAmount': refundAmount,
      'bonusAmount': bonusAmount,
    };
  }
}

class ApproveTransactionRequest {
  final String id;
  final String action;
  final String? rejectionReason;
  final double? walletCreditAmount;

  ApproveTransactionRequest({
    required this.id,
    required this.action,
    this.rejectionReason,
    this.walletCreditAmount,
  });

  factory ApproveTransactionRequest.fromJson(Map<String, dynamic> json) {
    return ApproveTransactionRequest(
      id: json['id'] as String,
      action: json['action'] as String,
      rejectionReason: json['rejectionReason'] as String?,
      walletCreditAmount: json['walletCreditAmount'] != null
          ? (json['walletCreditAmount'] as num).toDouble()
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'action': action,
      'rejectionReason': rejectionReason,
      'walletCreditAmount': walletCreditAmount,
    };
  }
}

class BookRentalRequest {
  final String vehicleId;
  final String shiftId;
  final String leaseDate;
  final String startTime;

  BookRentalRequest({
    required this.vehicleId,
    required this.shiftId,
    required this.leaseDate,
    required this.startTime,
  });

  factory BookRentalRequest.fromJson(Map<String, dynamic> json) {
    return BookRentalRequest(
      vehicleId: json['vehicleId'] as String,
      shiftId: json['shiftId'] as String,
      leaseDate: json['leaseDate'] as String,
      startTime: json['startTime'] as String,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'vehicleId': vehicleId,
      'shiftId': shiftId,
      'leaseDate': leaseDate,
      'startTime': startTime,
    };
  }
}

class BookRentalResponse {
  final Map<String, dynamic>? lease;
  final Map<String, dynamic>? pricing;

  BookRentalResponse({
    this.lease,
    this.pricing,
  });

  factory BookRentalResponse.fromJson(Map<String, dynamic> json) {
    return BookRentalResponse(
      lease: json['lease'] as Map<String, dynamic>?,
      pricing: json['pricing'] as Map<String, dynamic>?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'lease': lease,
      'pricing': pricing,
    };
  }
}

class CreateTicketRequest {
  final String riderId;
  final String category;
  final String priority;
  final String subject;
  final String message;
  final dynamic attachments;

  CreateTicketRequest({
    required this.riderId,
    required this.category,
    required this.priority,
    required this.subject,
    required this.message,
    this.attachments,
  });

  factory CreateTicketRequest.fromJson(Map<String, dynamic> json) {
    return CreateTicketRequest(
      riderId: json['riderId'] as String,
      category: json['category'] as String,
      priority: json['priority'] as String,
      subject: json['subject'] as String,
      message: json['message'] as String,
      attachments: json['attachments'],
    );
  }

  Map<String, dynamic> toJson() {
    final map = <String, dynamic>{
      'riderId': riderId,
      'category': category,
      'priority': priority,
      'subject': subject,
      'message': message,
    };
    if (attachments != null) map['attachments'] = attachments;
    return map;
  }
}

class TicketResponse {
  final String? id;
  final String? ticketId;
  final String? riderId;
  final String? category;
  final String? priority;
  final String? subject;
  final String? message;
  final String? status;
  final String? createdAt;
  final String? updatedAt;

  TicketResponse({
    this.id,
    this.ticketId,
    this.riderId,
    this.category,
    this.priority,
    this.subject,
    this.message,
    this.status,
    this.createdAt,
    this.updatedAt,
  });

  factory TicketResponse.fromJson(Map<String, dynamic> json) {
    return TicketResponse(
      id: json['id'] as String?,
      ticketId: json['ticketId'] as String?,
      riderId: json['riderId'] as String?,
      category: json['category'] as String?,
      priority: json['priority'] as String?,
      subject: json['subject'] as String?,
      message: json['message'] as String?,
      status: json['status'] as String?,
      createdAt: json['createdAt'] as String?,
      updatedAt: json['updatedAt'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'ticketId': ticketId,
      'riderId': riderId,
      'category': category,
      'priority': priority,
      'subject': subject,
      'message': message,
      'status': status,
      'createdAt': createdAt,
      'updatedAt': updatedAt,
    };
  }
}

class RequestUploadUrlRequest {
  final String fileName;
  final String mimeType;
  final String category;
  final double fileSize;

  RequestUploadUrlRequest({
    required this.fileName,
    required this.mimeType,
    required this.category,
    required this.fileSize,
  });

  factory RequestUploadUrlRequest.fromJson(Map<String, dynamic> json) {
    return RequestUploadUrlRequest(
      fileName: json['fileName'] as String,
      mimeType: json['mimeType'] as String,
      category: json['category'] as String,
      fileSize: (json['fileSize'] as num).toDouble(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'fileName': fileName,
      'mimeType': mimeType,
      'category': category,
      'fileSize': fileSize,
    };
  }
}

class RequestUploadUrlResponse {
  final String? uploadUrl;
  final String? fileRecordId;
  final String? storageKey;
  final double? expiresIn;

  RequestUploadUrlResponse({
    this.uploadUrl,
    this.fileRecordId,
    this.storageKey,
    this.expiresIn,
  });

  factory RequestUploadUrlResponse.fromJson(Map<String, dynamic> json) {
    return RequestUploadUrlResponse(
      uploadUrl: json['uploadUrl'] as String?,
      fileRecordId: json['fileRecordId'] as String?,
      storageKey: json['storageKey'] as String?,
      expiresIn: json['expiresIn'] != null
          ? (json['expiresIn'] as num).toDouble()
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'uploadUrl': uploadUrl,
      'fileRecordId': fileRecordId,
      'storageKey': storageKey,
      'expiresIn': expiresIn,
    };
  }
}

class ConfirmUploadRequest {
  final String fileRecordId;
  final double sizeBytes;
  final String? checksum;
  final String? idempotencyKey;

  ConfirmUploadRequest({
    required this.fileRecordId,
    required this.sizeBytes,
    this.checksum,
    this.idempotencyKey,
  });

  factory ConfirmUploadRequest.fromJson(Map<String, dynamic> json) {
    return ConfirmUploadRequest(
      fileRecordId: json['fileRecordId'] as String,
      sizeBytes: (json['sizeBytes'] as num).toDouble(),
      checksum: json['checksum'] as String?,
      idempotencyKey: json['idempotencyKey'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'fileRecordId': fileRecordId,
      'sizeBytes': sizeBytes,
      'checksum': checksum,
      'idempotencyKey': idempotencyKey,
    };
  }
}

class RequestReadUrlRequest {
  final String fileRecordId;

  RequestReadUrlRequest({
    required this.fileRecordId,
  });

  factory RequestReadUrlRequest.fromJson(Map<String, dynamic> json) {
    return RequestReadUrlRequest(
      fileRecordId: json['fileRecordId'] as String,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'fileRecordId': fileRecordId,
    };
  }
}

class RequestReadUrlResponse {
  final String? readUrl;
  final double? expiresIn;

  RequestReadUrlResponse({
    this.readUrl,
    this.expiresIn,
  });

  factory RequestReadUrlResponse.fromJson(Map<String, dynamic> json) {
    return RequestReadUrlResponse(
      readUrl: json['readUrl'] as String?,
      expiresIn: json['expiresIn'] != null
          ? (json['expiresIn'] as num).toDouble()
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'readUrl': readUrl,
      'expiresIn': expiresIn,
    };
  }
}

class ListNotificationsResponse {
  final List<NotificationResponse>? notifications;
  final int? unreadCount;
  final int? total;

  ListNotificationsResponse({
    this.notifications,
    this.unreadCount,
    this.total,
  });

  factory ListNotificationsResponse.fromJson(Map<String, dynamic> json) {
    return ListNotificationsResponse(
      notifications: json['notifications'] != null
          ? (json['notifications'] as List)
              .map((e) =>
                  NotificationResponse.fromJson(e as Map<String, dynamic>))
              .toList()
          : null,
      unreadCount: json['unreadCount'] as int?,
      total: json['total'] as int?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'notifications': notifications?.map((e) => e.toJson()).toList(),
      'unreadCount': unreadCount,
      'total': total,
    };
  }
}

class NotificationResponse {
  final String? id;
  final String? type;
  final String? title;
  final String? message;
  final bool? isRead;
  final String? createdAt;

  NotificationResponse({
    this.id,
    this.type,
    this.title,
    this.message,
    this.isRead,
    this.createdAt,
  });

  factory NotificationResponse.fromJson(Map<String, dynamic> json) {
    return NotificationResponse(
      id: json['id'] as String?,
      type: json['type'] as String?,
      title: json['title'] as String?,
      message: json['message'] as String?,
      isRead: json['isRead'] as bool?,
      createdAt: json['createdAt'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'type': type,
      'title': title,
      'message': message,
      'isRead': isRead,
      'createdAt': createdAt,
    };
  }
}

class ListVehiclesResponse {
  final List<VehicleResponse>? vehicles;
  final int? total;

  ListVehiclesResponse({
    this.vehicles,
    this.total,
  });

  factory ListVehiclesResponse.fromJson(Map<String, dynamic> json) {
    return ListVehiclesResponse(
      vehicles: json['vehicles'] != null
          ? (json['vehicles'] as List)
              .map((e) => VehicleResponse.fromJson(e as Map<String, dynamic>))
              .toList()
          : null,
      total: json['total'] as int?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'vehicles': vehicles?.map((e) => e.toJson()).toList(),
      'total': total,
    };
  }
}

class VehicleResponse {
  final String? id;
  final String? vehicleId;
  final String? registrationNumber;
  final String? model;
  final String? status;
  final double? batteryLevel;
  final String? hubId;

  VehicleResponse({
    this.id,
    this.vehicleId,
    this.registrationNumber,
    this.model,
    this.status,
    this.batteryLevel,
    this.hubId,
  });

  factory VehicleResponse.fromJson(Map<String, dynamic> json) {
    return VehicleResponse(
      id: json['id'] as String?,
      vehicleId: json['vehicleId'] as String?,
      registrationNumber: json['registrationNumber'] as String?,
      model: json['model'] as String?,
      status: json['status'] as String?,
      batteryLevel: json['batteryLevel'] != null
          ? (json['batteryLevel'] as num).toDouble()
          : null,
      hubId: json['hubId'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'vehicleId': vehicleId,
      'registrationNumber': registrationNumber,
      'model': model,
      'status': status,
      'batteryLevel': batteryLevel,
      'hubId': hubId,
    };
  }
}

class ListHubsResponse {
  final List<HubResponse>? hubs;
  final int? total;

  ListHubsResponse({
    this.hubs,
    this.total,
  });

  factory ListHubsResponse.fromJson(Map<String, dynamic> json) {
    return ListHubsResponse(
      hubs: json['hubs'] != null
          ? (json['hubs'] as List)
              .map((e) => HubResponse.fromJson(e as Map<String, dynamic>))
              .toList()
          : null,
      total: json['total'] as int?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'hubs': hubs?.map((e) => e.toJson()).toList(),
      'total': total,
    };
  }
}

class HubResponse {
  final String? id;
  final String? name;
  final String? address;
  final String? city;
  final String? state;
  final int? capacity;
  final int? activeVehicles;
  final String? status;

  HubResponse({
    this.id,
    this.name,
    this.address,
    this.city,
    this.state,
    this.capacity,
    this.activeVehicles,
    this.status,
  });

  factory HubResponse.fromJson(Map<String, dynamic> json) {
    return HubResponse(
      id: json['id'] as String?,
      name: json['name'] as String?,
      address: json['address'] as String?,
      city: json['city'] as String?,
      state: json['state'] as String?,
      capacity: json['capacity'] as int?,
      activeVehicles: json['activeVehicles'] as int?,
      status: json['status'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'address': address,
      'city': city,
      'state': state,
      'capacity': capacity,
      'activeVehicles': activeVehicles,
      'status': status,
    };
  }
}

class DepositStatusResponse {
  final String? riderId;
  final String? status;
  final double? amountInPaise;

  DepositStatusResponse({
    this.riderId,
    this.status,
    this.amountInPaise,
  });

  factory DepositStatusResponse.fromJson(Map<String, dynamic> json) {
    return DepositStatusResponse(
      riderId: json['riderId'] as String?,
      status: json['status'] as String?,
      amountInPaise: json['amountInPaise'] != null
          ? (json['amountInPaise'] as num).toDouble()
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'riderId': riderId,
      'status': status,
      'amountInPaise': amountInPaise,
    };
  }
}

class SubmitDepositRequest {
  final double amount;
  final String proofUrl;
  final String method;
  final String? upiRef;

  SubmitDepositRequest({
    required this.amount,
    required this.proofUrl,
    required this.method,
    this.upiRef,
  });

  factory SubmitDepositRequest.fromJson(Map<String, dynamic> json) {
    return SubmitDepositRequest(
      amount: (json['amount'] as num).toDouble(),
      proofUrl: json['proofUrl'] as String,
      method: json['method'] as String,
      upiRef: json['upiRef'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'amount': amount,
      'proofUrl': proofUrl,
      'method': method,
      'upiRef': upiRef,
    };
  }
}

class VerifyPhoneRequest {
  final String phone;
  final String otp;

  VerifyPhoneRequest({
    required this.phone,
    required this.otp,
  });

  factory VerifyPhoneRequest.fromJson(Map<String, dynamic> json) {
    return VerifyPhoneRequest(
      phone: json['phone'] as String,
      otp: json['otp'].toString(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'phone': phone,
      'otp': otp,
    };
  }
}

class VerifyPhoneResponse {
  final bool? verified;

  VerifyPhoneResponse({
    this.verified,
  });

  factory VerifyPhoneResponse.fromJson(Map<String, dynamic> json) {
    return VerifyPhoneResponse(
      verified: json['verified'] as bool?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'verified': verified,
    };
  }
}

class AdminWalletTopupRequest {
  final String riderId;
  final int amount;
  final String? purpose;

  AdminWalletTopupRequest({
    required this.riderId,
    required this.amount,
    this.purpose,
  });

  factory AdminWalletTopupRequest.fromJson(Map<String, dynamic> json) {
    return AdminWalletTopupRequest(
      riderId: json['riderId'] as String,
      amount: json['amount'] as int,
      purpose: json['purpose'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'riderId': riderId,
      'amount': amount,
      'purpose': purpose,
    };
  }
}

class AwardRewardRequest {
  final String riderDbId;
  final String title;
  final int points;

  AwardRewardRequest({
    required this.riderDbId,
    required this.title,
    required this.points,
  });

  factory AwardRewardRequest.fromJson(Map<String, dynamic> json) {
    return AwardRewardRequest(
      riderDbId: json['riderDbId'] as String,
      title: json['title'] as String,
      points: json['points'] as int,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'riderDbId': riderDbId,
      'title': title,
      'points': points,
    };
  }
}

class BulkActionRequest {
  final List<String> ids;
  final String action;
  final String? value;

  BulkActionRequest({
    required this.ids,
    required this.action,
    this.value,
  });

  factory BulkActionRequest.fromJson(Map<String, dynamic> json) {
    return BulkActionRequest(
      ids: (json['ids'] as List).map((e) => e as String).toList(),
      action: json['action'] as String,
      value: json['value'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'ids': ids,
      'action': action,
      'value': value,
    };
  }
}

class ChatMessageRequest {
  final String message;
  final String? riderId;

  ChatMessageRequest({
    required this.message,
    this.riderId,
  });

  factory ChatMessageRequest.fromJson(Map<String, dynamic> json) {
    return ChatMessageRequest(
      message: json['message'] as String,
      riderId: json['riderId'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'message': message,
      'riderId': riderId,
    };
  }
}

class CreateAnnouncementRequest {
  final String title;
  final String message;
  final String channel;
  final String targetAudience;
  final List<String> targetIds;
  final String? scheduledAt;

  CreateAnnouncementRequest({
    required this.title,
    required this.message,
    required this.channel,
    required this.targetAudience,
    required this.targetIds,
    this.scheduledAt,
  });

  factory CreateAnnouncementRequest.fromJson(Map<String, dynamic> json) {
    return CreateAnnouncementRequest(
      title: json['title'] as String,
      message: json['message'] as String,
      channel: json['channel'] as String,
      targetAudience: json['targetAudience'] as String,
      targetIds: (json['targetIds'] as List).map((e) => e as String).toList(),
      scheduledAt: json['scheduledAt'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'title': title,
      'message': message,
      'channel': channel,
      'targetAudience': targetAudience,
      'targetIds': targetIds,
      'scheduledAt': scheduledAt,
    };
  }
}

class CreateCouponRequest {
  final String code;
  final String description;
  final String discountType;
  final double discountValue;
  final double? minAmount;
  final int? maxUses;
  final String validFrom;
  final String validUntil;
  final bool isActive;

  CreateCouponRequest({
    required this.code,
    required this.description,
    required this.discountType,
    required this.discountValue,
    this.minAmount,
    this.maxUses,
    required this.validFrom,
    required this.validUntil,
    required this.isActive,
  });

  factory CreateCouponRequest.fromJson(Map<String, dynamic> json) {
    return CreateCouponRequest(
      code: json['code'] as String,
      description: json['description'] as String,
      discountType: json['discountType'] as String,
      discountValue: (json['discountValue'] as num).toDouble(),
      minAmount: json['minAmount'] != null
          ? (json['minAmount'] as num).toDouble()
          : null,
      maxUses: json['maxUses'] as int?,
      validFrom: json['validFrom'] as String,
      validUntil: json['validUntil'] as String,
      isActive: json['isActive'] as bool,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'code': code,
      'description': description,
      'discountType': discountType,
      'discountValue': discountValue,
      'minAmount': minAmount,
      'maxUses': maxUses,
      'validFrom': validFrom,
      'validUntil': validUntil,
      'isActive': isActive,
    };
  }
}

class CreateEarningRequest {
  final String date;
  final String? platform;
  final double amount;
  final int trips;
  final double? distance;
  final double? hoursOnline;
  final String? notes;

  CreateEarningRequest({
    required this.date,
    this.platform,
    required this.amount,
    required this.trips,
    this.distance,
    this.hoursOnline,
    this.notes,
  });

  factory CreateEarningRequest.fromJson(Map<String, dynamic> json) {
    return CreateEarningRequest(
      date: json['date'] as String,
      platform: json['platform'] as String?,
      amount: (json['amount'] as num).toDouble(),
      trips: json['trips'] as int,
      distance: json['distance'] != null
          ? (json['distance'] as num).toDouble()
          : null,
      hoursOnline: json['hoursOnline'] != null
          ? (json['hoursOnline'] as num).toDouble()
          : null,
      notes: json['notes'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'date': date,
      'platform': platform,
      'amount': amount,
      'trips': trips,
      'distance': distance,
      'hoursOnline': hoursOnline,
      'notes': notes,
    };
  }
}

class CreateFaqRequest {
  final String question;
  final String answer;
  final String? category;
  final int order;
  final bool isActive;

  CreateFaqRequest({
    required this.question,
    required this.answer,
    this.category,
    required this.order,
    required this.isActive,
  });

  factory CreateFaqRequest.fromJson(Map<String, dynamic> json) {
    return CreateFaqRequest(
      question: json['question'] as String,
      answer: json['answer'] as String,
      category: json['category'] as String?,
      order: json['order'] as int,
      isActive: json['isActive'] as bool,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'question': question,
      'answer': answer,
      'category': category,
      'order': order,
      'isActive': isActive,
    };
  }
}

class CreateHubRequest {
  final String name;
  final dynamic location;
  final dynamic city;
  final bool isActive;

  CreateHubRequest({
    required this.name,
    this.location,
    this.city,
    required this.isActive,
  });

  factory CreateHubRequest.fromJson(Map<String, dynamic> json) {
    return CreateHubRequest(
      name: json['name'] as String,
      location: json['location'],
      city: json['city'],
      isActive: json['isActive'] as bool,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'name': name,
      'location': location,
      'city': city,
      'isActive': isActive,
    };
  }
}

class CreateIncidentRequest {
  final String? riderId;
  final String? vehicleId;
  final String type;
  final String severity;
  final String title;
  final String description;
  final String? location;
  final double? latitude;
  final double? longitude;
  final List<String> photos;
  final bool insuranceClaim;
  final String? insuranceClaimNumber;

  CreateIncidentRequest({
    this.riderId,
    this.vehicleId,
    required this.type,
    required this.severity,
    required this.title,
    required this.description,
    this.location,
    this.latitude,
    this.longitude,
    required this.photos,
    required this.insuranceClaim,
    this.insuranceClaimNumber,
  });

  factory CreateIncidentRequest.fromJson(Map<String, dynamic> json) {
    return CreateIncidentRequest(
      riderId: json['riderId'] as String?,
      vehicleId: json['vehicleId'] as String?,
      type: json['type'] as String,
      severity: json['severity'] as String,
      title: json['title'] as String,
      description: json['description'] as String,
      location: json['location'] as String?,
      latitude: json['latitude'] != null
          ? (json['latitude'] as num).toDouble()
          : null,
      longitude: json['longitude'] != null
          ? (json['longitude'] as num).toDouble()
          : null,
      photos: (json['photos'] as List).map((e) => e as String).toList(),
      insuranceClaim: json['insuranceClaim'] as bool,
      insuranceClaimNumber: json['insuranceClaimNumber'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'riderId': riderId,
      'vehicleId': vehicleId,
      'type': type,
      'severity': severity,
      'title': title,
      'description': description,
      'location': location,
      'latitude': latitude,
      'longitude': longitude,
      'photos': photos,
      'insuranceClaim': insuranceClaim,
      'insuranceClaimNumber': insuranceClaimNumber,
    };
  }
}

class CreateOfferRequest {
  final String title;
  final String description;
  final String validFrom;
  final String validUntil;
  final bool isSponsored;
  final bool isActive;
  final String? icon;

  CreateOfferRequest({
    required this.title,
    required this.description,
    required this.validFrom,
    required this.validUntil,
    required this.isSponsored,
    required this.isActive,
    this.icon,
  });

  factory CreateOfferRequest.fromJson(Map<String, dynamic> json) {
    return CreateOfferRequest(
      title: json['title'] as String,
      description: json['description'] as String,
      validFrom: json['validFrom'] as String,
      validUntil: json['validUntil'] as String,
      isSponsored: json['isSponsored'] as bool,
      isActive: json['isActive'] as bool,
      icon: json['icon'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'title': title,
      'description': description,
      'validFrom': validFrom,
      'validUntil': validUntil,
      'isSponsored': isSponsored,
      'isActive': isActive,
      'icon': icon,
    };
  }
}

class CreatePlanRequest {
  final String name;
  final String type;
  final double price;
  final int durationDays;
  final String? description;

  CreatePlanRequest({
    required this.name,
    required this.type,
    required this.price,
    required this.durationDays,
    this.description,
  });

  factory CreatePlanRequest.fromJson(Map<String, dynamic> json) {
    return CreatePlanRequest(
      name: json['name'] as String,
      type: json['type'] as String,
      price: (json['price'] as num).toDouble(),
      durationDays: json['durationDays'] as int,
      description: json['description'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'name': name,
      'type': type,
      'price': price,
      'durationDays': durationDays,
      'description': description,
    };
  }
}

class CreateRiderRequest {
  final String phone;
  final String? fullName;
  final dynamic email;
  final String? intent;
  final String? lifecycleStatus;

  CreateRiderRequest({
    required this.phone,
    this.fullName,
    this.email,
    this.intent,
    this.lifecycleStatus,
  });

  factory CreateRiderRequest.fromJson(Map<String, dynamic> json) {
    return CreateRiderRequest(
      phone: json['phone'] as String,
      fullName: json['fullName'] as String?,
      email: json['email'],
      intent: json['intent'] as String?,
      lifecycleStatus: json['lifecycleStatus'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'phone': phone,
      'fullName': fullName,
      'email': email,
      'intent': intent,
      'lifecycleStatus': lifecycleStatus,
    };
  }
}

class CreateTeamLeaderRequest {
  final String name;
  final String phone;
  final dynamic email;
  final bool isActive;

  CreateTeamLeaderRequest({
    required this.name,
    required this.phone,
    this.email,
    required this.isActive,
  });

  factory CreateTeamLeaderRequest.fromJson(Map<String, dynamic> json) {
    return CreateTeamLeaderRequest(
      name: json['name'] as String,
      phone: json['phone'] as String,
      email: json['email'],
      isActive: json['isActive'] as bool,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'name': name,
      'phone': phone,
      'email': email,
      'isActive': isActive,
    };
  }
}

class CreateVehicleRequest {
  final String vehicleNumber;
  final String model;
  final String? batteryPartner;
  final String? licensePlate;
  final String hubId;
  final String? status;

  CreateVehicleRequest({
    required this.vehicleNumber,
    required this.model,
    this.batteryPartner,
    this.licensePlate,
    required this.hubId,
    this.status,
  });

  factory CreateVehicleRequest.fromJson(Map<String, dynamic> json) {
    return CreateVehicleRequest(
      vehicleNumber: json['vehicleNumber'] as String,
      model: json['model'] as String,
      batteryPartner: json['batteryPartner'] as String?,
      licensePlate: json['licensePlate'] as String?,
      hubId: json['hubId'] as String,
      status: json['status'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'vehicleNumber': vehicleNumber,
      'model': model,
      'batteryPartner': batteryPartner,
      'licensePlate': licensePlate,
      'hubId': hubId,
      'status': status,
    };
  }
}

class DeletePlanRequest {
  final String id;

  DeletePlanRequest({
    required this.id,
  });

  factory DeletePlanRequest.fromJson(Map<String, dynamic> json) {
    return DeletePlanRequest(
      id: json['id'] as String,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
    };
  }
}

class DevicePermissionsRequest {
  final String riderId;
  final Map<String, dynamic> permissions;

  DevicePermissionsRequest({
    required this.riderId,
    required this.permissions,
  });

  factory DevicePermissionsRequest.fromJson(Map<String, dynamic> json) {
    return DevicePermissionsRequest(
      riderId: json['riderId'] as String,
      permissions: json['permissions'] as Map<String, dynamic>,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'riderId': riderId,
      'permissions': permissions,
    };
  }
}

class HubBulkActionRequest {
  final List<String> ids;
  final String action;

  HubBulkActionRequest({
    required this.ids,
    required this.action,
  });

  factory HubBulkActionRequest.fromJson(Map<String, dynamic> json) {
    return HubBulkActionRequest(
      ids: (json['ids'] as List).map((e) => e as String).toList(),
      action: json['action'] as String,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'ids': ids,
      'action': action,
    };
  }
}

class RecalculateScoreRequest {
  final String riderId;

  RecalculateScoreRequest({
    required this.riderId,
  });

  factory RecalculateScoreRequest.fromJson(Map<String, dynamic> json) {
    return RecalculateScoreRequest(
      riderId: json['riderId'] as String,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'riderId': riderId,
    };
  }
}

class RefreshTokenRequest {
  final String refreshToken;

  RefreshTokenRequest({
    required this.refreshToken,
  });

  factory RefreshTokenRequest.fromJson(Map<String, dynamic> json) {
    return RefreshTokenRequest(
      refreshToken: json['refreshToken'] as String,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'refreshToken': refreshToken,
    };
  }
}

class RegisterTokenRequest {
  final String fcmToken;

  RegisterTokenRequest({
    required this.fcmToken,
  });

  factory RegisterTokenRequest.fromJson(Map<String, dynamic> json) {
    return RegisterTokenRequest(
      fcmToken: json['fcmToken'] as String,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'fcmToken': fcmToken,
    };
  }
}

class RiderActionRequest {
  final String action;
  final String riderId;
  final String? planId;
  final String? vehicleId;
  final String? hubId;
  final String? teamLeader;
  final String? password;
  final bool? enabled;

  RiderActionRequest({
    required this.action,
    required this.riderId,
    this.planId,
    this.vehicleId,
    this.hubId,
    this.teamLeader,
    this.password,
    this.enabled,
  });

  factory RiderActionRequest.fromJson(Map<String, dynamic> json) {
    return RiderActionRequest(
      action: json['action'] as String,
      riderId: json['riderId'] as String,
      planId: json['planId'] as String?,
      vehicleId: json['vehicleId'] as String?,
      hubId: json['hubId'] as String?,
      teamLeader: json['teamLeader'] as String?,
      password: json['password'] as String?,
      enabled: json['enabled'] as bool?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'action': action,
      'riderId': riderId,
      'planId': planId,
      'vehicleId': vehicleId,
      'hubId': hubId,
      'teamLeader': teamLeader,
      'password': password,
      'enabled': enabled,
    };
  }
}

class SendNotificationRequest {
  final String title;
  final String message;
  final String type;
  final List<String>? riderIds;
  final bool sendToAll;

  SendNotificationRequest({
    required this.title,
    required this.message,
    required this.type,
    this.riderIds,
    required this.sendToAll,
  });

  factory SendNotificationRequest.fromJson(Map<String, dynamic> json) {
    return SendNotificationRequest(
      title: json['title'] as String,
      message: json['message'] as String,
      type: json['type'] as String,
      riderIds: json['riderIds'] != null
          ? (json['riderIds'] as List).map((e) => e as String).toList()
          : null,
      sendToAll: json['sendToAll'] as bool,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'title': title,
      'message': message,
      'type': type,
      'riderIds': riderIds,
      'sendToAll': sendToAll,
    };
  }
}

class SubmitGuarantorRequest {
  final String riderId;
  final String name;
  final String relation;
  final String phone;
  final String? dob;
  final String? fatherName;
  final String? motherName;
  final dynamic aadhaarFront;
  final dynamic aadhaarBack;
  final dynamic pan;
  final dynamic video;
  final dynamic signature;

  SubmitGuarantorRequest({
    required this.riderId,
    required this.name,
    required this.relation,
    required this.phone,
    this.dob,
    this.fatherName,
    this.motherName,
    this.aadhaarFront,
    this.aadhaarBack,
    this.pan,
    this.video,
    this.signature,
  });

  factory SubmitGuarantorRequest.fromJson(Map<String, dynamic> json) {
    return SubmitGuarantorRequest(
      riderId: json['riderId'] as String,
      name: json['name'] as String,
      relation: json['relation'] as String,
      phone: json['phone'] as String,
      dob: json['dob'] as String?,
      fatherName: json['fatherName'] as String?,
      motherName: json['motherName'] as String?,
      aadhaarFront: json['aadhaarFront'],
      aadhaarBack: json['aadhaarBack'],
      pan: json['pan'],
      video: json['video'],
      signature: json['signature'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'riderId': riderId,
      'name': name,
      'relation': relation,
      'phone': phone,
      'dob': dob,
      'fatherName': fatherName,
      'motherName': motherName,
      'aadhaarFront': aadhaarFront,
      'aadhaarBack': aadhaarBack,
      'pan': pan,
      'video': video,
      'signature': signature,
    };
  }
}

class SubscribePlanRequest {
  final String riderId;
  final String planId;

  SubscribePlanRequest({
    required this.riderId,
    required this.planId,
  });

  factory SubscribePlanRequest.fromJson(Map<String, dynamic> json) {
    return SubscribePlanRequest(
      riderId: json['riderId'] as String,
      planId: json['planId'] as String,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'riderId': riderId,
      'planId': planId,
    };
  }
}

class SyncQueueRequest {
  final String riderId;
  final List<Map<String, dynamic>> actions;

  SyncQueueRequest({
    required this.riderId,
    required this.actions,
  });

  factory SyncQueueRequest.fromJson(Map<String, dynamic> json) {
    return SyncQueueRequest(
      riderId: json['riderId'] as String,
      actions: (json['actions'] as List)
          .map((e) => e as Map<String, dynamic>)
          .toList(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'riderId': riderId,
      'actions': actions,
    };
  }
}

class TeamLeaderBulkActionRequest {
  final List<String> ids;
  final String action;

  TeamLeaderBulkActionRequest({
    required this.ids,
    required this.action,
  });

  factory TeamLeaderBulkActionRequest.fromJson(Map<String, dynamic> json) {
    return TeamLeaderBulkActionRequest(
      ids: (json['ids'] as List).map((e) => e as String).toList(),
      action: json['action'] as String,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'ids': ids,
      'action': action,
    };
  }
}

class TicketBulkActionRequest {
  final List<String> ids;
  final String action;
  final String? value;

  TicketBulkActionRequest({
    required this.ids,
    required this.action,
    this.value,
  });

  factory TicketBulkActionRequest.fromJson(Map<String, dynamic> json) {
    return TicketBulkActionRequest(
      ids: (json['ids'] as List).map((e) => e as String).toList(),
      action: json['action'] as String,
      value: json['value'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'ids': ids,
      'action': action,
      'value': value,
    };
  }
}

class TicketReplyRequest {
  final String message;
  final dynamic attachments;

  TicketReplyRequest({
    required this.message,
    this.attachments,
  });

  factory TicketReplyRequest.fromJson(Map<String, dynamic> json) {
    return TicketReplyRequest(
      message: json['message'] as String,
      attachments: json['attachments'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'message': message,
      'attachments': attachments,
    };
  }
}

class TopUpRequest {
  final String riderId;
  final double amount;
  final String purpose;
  final String method;
  final String? reason;
  final dynamic upiRef;
  final dynamic proofUrl;

  TopUpRequest({
    required this.riderId,
    required this.amount,
    required this.purpose,
    required this.method,
    this.reason,
    this.upiRef,
    this.proofUrl,
  });

  factory TopUpRequest.fromJson(Map<String, dynamic> json) {
    return TopUpRequest(
      riderId: json['riderId'] as String,
      amount: (json['amount'] as num).toDouble(),
      purpose: json['purpose'] as String,
      method: json['method'] as String,
      reason: json['reason'] as String?,
      upiRef: json['upiRef'],
      proofUrl: json['proofUrl'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'riderId': riderId,
      'amount': amount,
      'purpose': purpose,
      'method': method,
      'reason': reason,
      'upiRef': upiRef,
      'proofUrl': proofUrl,
    };
  }
}

class TransactionBulkActionRequest {
  final List<String> ids;
  final String action;
  final String? reason;

  TransactionBulkActionRequest({
    required this.ids,
    required this.action,
    this.reason,
  });

  factory TransactionBulkActionRequest.fromJson(Map<String, dynamic> json) {
    return TransactionBulkActionRequest(
      ids: (json['ids'] as List).map((e) => e as String).toList(),
      action: json['action'] as String,
      reason: json['reason'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'ids': ids,
      'action': action,
      'reason': reason,
    };
  }
}

class UpdateCouponRequest {
  final String id;
  final String? code;
  final String? description;
  final String? discountType;
  final double? discountValue;
  final double? minAmount;
  final int? maxUses;
  final String? validFrom;
  final String? validUntil;
  final bool? isActive;

  UpdateCouponRequest({
    required this.id,
    this.code,
    this.description,
    this.discountType,
    this.discountValue,
    this.minAmount,
    this.maxUses,
    this.validFrom,
    this.validUntil,
    this.isActive,
  });

  factory UpdateCouponRequest.fromJson(Map<String, dynamic> json) {
    return UpdateCouponRequest(
      id: json['id'] as String,
      code: json['code'] as String?,
      description: json['description'] as String?,
      discountType: json['discountType'] as String?,
      discountValue: json['discountValue'] != null
          ? (json['discountValue'] as num).toDouble()
          : null,
      minAmount: json['minAmount'] != null
          ? (json['minAmount'] as num).toDouble()
          : null,
      maxUses: json['maxUses'] as int?,
      validFrom: json['validFrom'] as String?,
      validUntil: json['validUntil'] as String?,
      isActive: json['isActive'] as bool?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'code': code,
      'description': description,
      'discountType': discountType,
      'discountValue': discountValue,
      'minAmount': minAmount,
      'maxUses': maxUses,
      'validFrom': validFrom,
      'validUntil': validUntil,
      'isActive': isActive,
    };
  }
}

class UpdateIncidentRequest {
  final String id;
  final String? status;
  final String? assignedTo;
  final String? resolution;
  final bool? insuranceClaim;
  final String? insuranceClaimNumber;

  UpdateIncidentRequest({
    required this.id,
    this.status,
    this.assignedTo,
    this.resolution,
    this.insuranceClaim,
    this.insuranceClaimNumber,
  });

  factory UpdateIncidentRequest.fromJson(Map<String, dynamic> json) {
    return UpdateIncidentRequest(
      id: json['id'] as String,
      status: json['status'] as String?,
      assignedTo: json['assignedTo'] as String?,
      resolution: json['resolution'] as String?,
      insuranceClaim: json['insuranceClaim'] as bool?,
      insuranceClaimNumber: json['insuranceClaimNumber'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'status': status,
      'assignedTo': assignedTo,
      'resolution': resolution,
      'insuranceClaim': insuranceClaim,
      'insuranceClaimNumber': insuranceClaimNumber,
    };
  }
}

class UpdateLegalRequest {
  final String type;
  final String? title;
  final String content;

  UpdateLegalRequest({
    required this.type,
    this.title,
    required this.content,
  });

  factory UpdateLegalRequest.fromJson(Map<String, dynamic> json) {
    return UpdateLegalRequest(
      type: json['type'] as String,
      title: json['title'] as String?,
      content: json['content'] as String,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'type': type,
      'title': title,
      'content': content,
    };
  }
}

class UpdatePlanRequest {
  final String? name;
  final String? type;
  final double? price;
  final int? durationDays;
  final String? description;
  final String id;

  UpdatePlanRequest({
    this.name,
    this.type,
    this.price,
    this.durationDays,
    this.description,
    required this.id,
  });

  factory UpdatePlanRequest.fromJson(Map<String, dynamic> json) {
    return UpdatePlanRequest(
      name: json['name'] as String?,
      type: json['type'] as String?,
      price: json['price'] != null ? (json['price'] as num).toDouble() : null,
      durationDays: json['durationDays'] as int?,
      description: json['description'] as String?,
      id: json['id'] as String,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'name': name,
      'type': type,
      'price': price,
      'durationDays': durationDays,
      'description': description,
      'id': id,
    };
  }
}

class UpdateSettingsRequest {
  UpdateSettingsRequest();

  factory UpdateSettingsRequest.fromJson(Map<String, dynamic> json) {
    return UpdateSettingsRequest();
  }

  Map<String, dynamic> toJson() {
    return {};
  }
}

class UpdateTicketRequest {
  final String id;
  final String? status;
  final String? assignedTo;

  UpdateTicketRequest({
    required this.id,
    this.status,
    this.assignedTo,
  });

  factory UpdateTicketRequest.fromJson(Map<String, dynamic> json) {
    return UpdateTicketRequest(
      id: json['id'] as String,
      status: json['status'] as String?,
      assignedTo: json['assignedTo'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'status': status,
      'assignedTo': assignedTo,
    };
  }
}

class UpdateVehicleRequest {
  final String id;
  final String? vehicleNumber;
  final String? model;
  final dynamic batteryPartner;
  final dynamic licensePlate;
  final String? hubId;
  final String? status;

  UpdateVehicleRequest({
    required this.id,
    this.vehicleNumber,
    this.model,
    this.batteryPartner,
    this.licensePlate,
    this.hubId,
    this.status,
  });

  factory UpdateVehicleRequest.fromJson(Map<String, dynamic> json) {
    return UpdateVehicleRequest(
      id: json['id'] as String,
      vehicleNumber: json['vehicleNumber'] as String?,
      model: json['model'] as String?,
      batteryPartner: json['batteryPartner'],
      licensePlate: json['licensePlate'],
      hubId: json['hubId'] as String?,
      status: json['status'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'vehicleNumber': vehicleNumber,
      'model': model,
      'batteryPartner': batteryPartner,
      'licensePlate': licensePlate,
      'hubId': hubId,
      'status': status,
    };
  }
}

class VehicleBulkActionRequest {
  final List<String> ids;
  final String action;
  final String? value;

  VehicleBulkActionRequest({
    required this.ids,
    required this.action,
    this.value,
  });

  factory VehicleBulkActionRequest.fromJson(Map<String, dynamic> json) {
    return VehicleBulkActionRequest(
      ids: (json['ids'] as List).map((e) => e as String).toList(),
      action: json['action'] as String,
      value: json['value'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'ids': ids,
      'action': action,
      'value': value,
    };
  }
}

class VehicleReturnRequest {
  final String riderId;
  final List<String> photoUrls;
  final String? reason;

  VehicleReturnRequest({
    required this.riderId,
    required this.photoUrls,
    this.reason,
  });

  factory VehicleReturnRequest.fromJson(Map<String, dynamic> json) {
    return VehicleReturnRequest(
      riderId: json['riderId'] as String,
      photoUrls: (json['photoUrls'] as List).map((e) => e as String).toList(),
      reason: json['reason'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'riderId': riderId,
      'photoUrls': photoUrls,
      'reason': reason,
    };
  }
}
