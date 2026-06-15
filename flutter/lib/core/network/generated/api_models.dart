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
      otp: json['otp'] as String?,
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
      otp: json['otp'] as String?,
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
  final String? fullName;
  final String? email;
  final String? fatherName;
  final String? motherName;
  final String? currentAddress;
  final String? emergencyContact;
  final String? dob;
  final String? intent;
  final String? aadhaarFront;
  final String? aadhaarBack;
  final String? panCard;
  final String? bankName;
  final String? bankAccount;
  final String? bankIfsc;
  final String? guarantorName;
  final String? guarantorPhone;
  final String? guarantorRelation;

  UpdateProfileRequest({
    this.fullName,
    this.email,
    this.fatherName,
    this.motherName,
    this.currentAddress,
    this.emergencyContact,
    this.dob,
    this.intent,
    this.aadhaarFront,
    this.aadhaarBack,
    this.panCard,
    this.bankName,
    this.bankAccount,
    this.bankIfsc,
    this.guarantorName,
    this.guarantorPhone,
    this.guarantorRelation,
  });

  factory UpdateProfileRequest.fromJson(Map<String, dynamic> json) {
    return UpdateProfileRequest(
      fullName: json['fullName'] as String?,
      email: json['email'] as String?,
      fatherName: json['fatherName'] as String?,
      motherName: json['motherName'] as String?,
      currentAddress: json['currentAddress'] as String?,
      emergencyContact: json['emergencyContact'] as String?,
      dob: json['dob'] as String?,
      intent: json['intent'] as String?,
      aadhaarFront: json['aadhaarFront'] as String?,
      aadhaarBack: json['aadhaarBack'] as String?,
      panCard: json['panCard'] as String?,
      bankName: json['bankName'] as String?,
      bankAccount: json['bankAccount'] as String?,
      bankIfsc: json['bankIfsc'] as String?,
      guarantorName: json['guarantorName'] as String?,
      guarantorPhone: json['guarantorPhone'] as String?,
      guarantorRelation: json['guarantorRelation'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'fullName': fullName,
      'email': email,
      'fatherName': fatherName,
      'motherName': motherName,
      'currentAddress': currentAddress,
      'emergencyContact': emergencyContact,
      'dob': dob,
      'intent': intent,
      'aadhaarFront': aadhaarFront,
      'aadhaarBack': aadhaarBack,
      'panCard': panCard,
      'bankName': bankName,
      'bankAccount': bankAccount,
      'bankIfsc': bankIfsc,
      'guarantorName': guarantorName,
      'guarantorPhone': guarantorPhone,
      'guarantorRelation': guarantorRelation,
    };
  }
}

class SubmitKycRequest {
  final String aadhaarNumber;
  final String panNumber;
  final String bankName;
  final String bankAccount;
  final String bankIfsc;
  final String? aadhaarFront;
  final String? aadhaarBack;
  final String? panCard;
  final String? profilePhoto;
  final String? signature;

  SubmitKycRequest({
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
      aadhaarNumber: json['aadhaarNumber'] as String,
      panNumber: json['panNumber'] as String,
      bankName: json['bankName'] as String,
      bankAccount: json['bankAccount'] as String,
      bankIfsc: json['bankIfsc'] as String,
      aadhaarFront: json['aadhaarFront'] as String?,
      aadhaarBack: json['aadhaarBack'] as String?,
      panCard: json['panCard'] as String?,
      profilePhoto: json['profilePhoto'] as String?,
      signature: json['signature'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
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
      amount: json['amount'] != null ? (json['amount'] as num).toDouble() : null,
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
      refundAmount: json['refundAmount'] != null ? (json['refundAmount'] as num).toDouble() : null,
      bonusAmount: json['bonusAmount'] != null ? (json['bonusAmount'] as num).toDouble() : null,
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

  ApproveTransactionRequest({
    required this.id,
    required this.action,
    this.rejectionReason,
  });

  factory ApproveTransactionRequest.fromJson(Map<String, dynamic> json) {
    return ApproveTransactionRequest(
      id: json['id'] as String,
      action: json['action'] as String,
      rejectionReason: json['rejectionReason'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'action': action,
      'rejectionReason': rejectionReason,
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
  final String category;
  final String? priority;
  final String subject;
  final String message;
  final String? attachments;

  CreateTicketRequest({
    required this.category,
    this.priority,
    required this.subject,
    required this.message,
    this.attachments,
  });

  factory CreateTicketRequest.fromJson(Map<String, dynamic> json) {
    return CreateTicketRequest(
      category: json['category'] as String,
      priority: json['priority'] as String?,
      subject: json['subject'] as String,
      message: json['message'] as String,
      attachments: json['attachments'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'category': category,
      'priority': priority,
      'subject': subject,
      'message': message,
      'attachments': attachments,
    };
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
      expiresIn: json['expiresIn'] != null ? (json['expiresIn'] as num).toDouble() : null,
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
      expiresIn: json['expiresIn'] != null ? (json['expiresIn'] as num).toDouble() : null,
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
      notifications: json['notifications'] != null ? (json['notifications'] as List).map((e) => NotificationResponse.fromJson(e as Map<String, dynamic>)).toList() : null,
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
      vehicles: json['vehicles'] != null ? (json['vehicles'] as List).map((e) => VehicleResponse.fromJson(e as Map<String, dynamic>)).toList() : null,
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
      batteryLevel: json['batteryLevel'] != null ? (json['batteryLevel'] as num).toDouble() : null,
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
      hubs: json['hubs'] != null ? (json['hubs'] as List).map((e) => HubResponse.fromJson(e as Map<String, dynamic>)).toList() : null,
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
      amountInPaise: json['amountInPaise'] != null ? (json['amountInPaise'] as num).toDouble() : null,
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
      otp: json['otp'] as String,
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

