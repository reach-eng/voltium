-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "RiderLifecycleStatus" AS ENUM ('NEW', 'PHONE_VERIFIED', 'PROFILE_SUBMITTED', 'KYC_SUBMITTED', 'KYC_APPROVED', 'GUARANTOR_SUBMITTED', 'GUARANTOR_APPROVED', 'DEPOSIT_PENDING', 'DEPOSIT_APPROVED', 'PLAN_SELECTED', 'PICKUP_SCHEDULED', 'ACTIVE', 'SUSPENDED', 'RETURN_PENDING', 'CLOSED');

-- CreateEnum
CREATE TYPE "KycStatus" AS ENUM ('PENDING', 'DRAFT', 'SUBMITTED', 'INFO_REQUIRED', 'APPROVED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "VehicleReturnStatus" AS ENUM ('SUBMITTED', 'INSPECTION_PENDING', 'APPROVED', 'REJECTED', 'CLOSED');

-- CreateEnum
CREATE TYPE "GuarantorStatus" AS ENUM ('PENDING', 'DRAFT', 'SUBMITTED', 'INFO_REQUIRED', 'APPROVED', 'REJECTED', 'REPLACED');

-- CreateEnum
CREATE TYPE "DepositStatus" AS ENUM ('PENDING', 'NOT_SUBMITTED', 'PENDING_VERIFICATION', 'APPROVED', 'REJECTED', 'REFUND_REQUESTED', 'REFUNDED', 'FORFEITED', 'PARTIALLY_REFUNDED');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'FAILED', 'REVERSED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('CREDIT', 'DEBIT');

-- CreateEnum
CREATE TYPE "TransactionPurpose" AS ENUM ('TOP_UP', 'SECURITY_DEPOSIT', 'RENT_PAYMENT', 'REWARD', 'REFUND', 'REVERSAL', 'ADMIN_ADJUSTMENT', 'FORFEITURE');

-- CreateEnum
CREATE TYPE "RentalStatus" AS ENUM ('BOOKED', 'NO_RENTAL', 'PLAN_SELECTED', 'PICKUP_SCHEDULED', 'ACTIVE', 'OVERDUE', 'RETURN_PENDING', 'RETURN_APPROVED', 'CLOSED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "VehicleStatus" AS ENUM ('AVAILABLE', 'RESERVED', 'ASSIGNED', 'ACTIVE_RENTAL', 'RETURN_PENDING', 'MAINTENANCE', 'RETIRED', 'LOST');

-- CreateEnum
CREATE TYPE "SupportTicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'WAITING_ON_RIDER', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('SUPER_ADMIN', 'OPERATIONS_ADMIN', 'KYC_REVIEWER', 'FINANCE_ADMIN', 'SUPPORT_AGENT', 'HUB_MANAGER', 'FLEET_MANAGER', 'TEAM_LEADER', 'READ_ONLY');

-- CreateEnum
CREATE TYPE "AuditActionType" AS ENUM ('LOGIN', 'LOGOUT', 'CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'REJECT', 'REFUND', 'VIEW', 'EXPORT', 'PERMISSION_CHANGE', 'ROLE_CHANGE', 'SYSTEM_CONFIG');

-- CreateEnum
CREATE TYPE "LedgerEntryType" AS ENUM ('CREDIT', 'DEBIT');

-- CreateEnum
CREATE TYPE "LedgerCategory" AS ENUM ('TOP_UP', 'SECURITY_DEPOSIT', 'RENT_PAYMENT', 'REWARD', 'REFUND', 'REVERSAL', 'ADMIN_ADJUSTMENT', 'FORFEITURE', 'FINE');

-- CreateEnum
CREATE TYPE "FileVisibility" AS ENUM ('PRIVATE', 'PUBLIC', 'ADMIN_ONLY');

-- CreateEnum
CREATE TYPE "FileStatus" AS ENUM ('PENDING_UPLOAD', 'UPLOADED', 'VERIFIED', 'REJECTED', 'DELETED');

-- CreateEnum
CREATE TYPE "OutboxEventStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "breakdown_type" AS ENUM ('CHARGE', 'TAX', 'DISCOUNT', 'PENALTY', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "ticket_category" AS ENUM ('TECHNICAL', 'PAYMENT', 'VEHICLE', 'GENERAL', 'TROUBLESHOOTER', 'BATTERY');

-- CreateEnum
CREATE TYPE "ticket_priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "notification_type" AS ENUM ('INFO', 'ALERT', 'PROMOTION', 'PAYMENT', 'VEHICLE', 'SOS', 'SYSTEM');

-- CreateEnum
CREATE TYPE "notification_priority" AS ENUM ('NORMAL', 'LOW', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "notification_delivery_status" AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'FAILED');

-- CreateEnum
CREATE TYPE "actor_type" AS ENUM ('ADMIN', 'SYSTEM', 'RIDER');

-- CreateEnum
CREATE TYPE "http_method" AS ENUM ('GET', 'POST', 'PUT', 'DELETE');

-- CreateEnum
CREATE TYPE "sync_status" AS ENUM ('PENDING', 'SYNCING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "announcement_status" AS ENUM ('DRAFT', 'SCHEDULED', 'SENT', 'FAILED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "announcement_delivery_status" AS ENUM ('PENDING', 'DELIVERED', 'READ', 'FAILED');

-- CreateEnum
CREATE TYPE "incident_severity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "incident_status" AS ENUM ('OPEN', 'INVESTIGATING', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "incident_type" AS ENUM ('ACCIDENT', 'THEFT', 'DAMAGE', 'BREAKDOWN', 'OTHER');

-- CreateEnum
CREATE TYPE "risk_level" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "fine_status" AS ENUM ('PENDING', 'PAID', 'DISPUTED', 'OVERDUE', 'WAIVED');

-- CreateEnum
CREATE TYPE "violation_status" AS ENUM ('ACTIVE', 'RESOLVED');

-- CreateEnum
CREATE TYPE "rental_plan_type" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "discount_type" AS ENUM ('PERCENTAGE', 'FIXED');

-- CreateEnum
CREATE TYPE "sender_type" AS ENUM ('RIDER', 'ADMIN');

-- CreateEnum
CREATE TYPE "FileOwnerType" AS ENUM ('RIDER', 'ADMIN', 'SYSTEM');

-- CreateTable
CREATE TABLE "Admin" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "AdminRole" NOT NULL DEFAULT 'OPERATIONS_ADMIN',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "permissions" TEXT NOT NULL DEFAULT '[]',
    "tokenVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Admin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminSession" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "permission" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Hub" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT,
    "city" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Hub_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "vehicleNumber" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "licensePlate" TEXT,
    "batteryLevel" INTEGER NOT NULL DEFAULT 100,
    "batteryPartner" TEXT,
    "status" "VehicleStatus" NOT NULL DEFAULT 'AVAILABLE',
    "hubId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shift" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "parts" TEXT,
    "maxBookings" INTEGER NOT NULL DEFAULT 5,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Shift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rental_plans" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "rental_plan_type" NOT NULL,
    "price" INTEGER NOT NULL,
    "durationDays" INTEGER NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "rental_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rider" (
    "id" TEXT NOT NULL,
    "riderId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "fullName" TEXT,
    "email" TEXT,
    "fatherName" TEXT,
    "motherName" TEXT,
    "dob" TEXT,
    "currentAddress" TEXT,
    "tokenVersion" INTEGER NOT NULL DEFAULT 1,
    "intent" TEXT,
    "lifecycleStatus" "RiderLifecycleStatus" NOT NULL DEFAULT 'NEW',
    "vehicleId" TEXT,
    "deliveryId" TEXT,
    "assignedVehicle" TEXT,
    "pickupHub" TEXT,
    "currentPlan" TEXT,
    "planStartDate" TIMESTAMP(3),
    "planEndDate" TIMESTAMP(3),
    "preferredShift" TEXT,
    "teamLeader" TEXT,
    "emergencyContact" TEXT,
    "referralCode" TEXT NOT NULL,
    "referredBy" TEXT,
    "locationGranted" BOOLEAN NOT NULL DEFAULT false,
    "batteryGranted" BOOLEAN NOT NULL DEFAULT false,
    "contactsGranted" BOOLEAN NOT NULL DEFAULT false,
    "callLogsGranted" BOOLEAN NOT NULL DEFAULT false,
    "micGranted" BOOLEAN NOT NULL DEFAULT false,
    "cameraGranted" BOOLEAN NOT NULL DEFAULT false,
    "phoneGranted" BOOLEAN NOT NULL DEFAULT false,
    "pickedUpAt" TIMESTAMP(3),
    "registrationDoneAt" TIMESTAMP(3),
    "depositDoneAt" TIMESTAMP(3),
    "kycDoneAt" TIMESTAMP(3),
    "planDoneAt" TIMESTAMP(3),
    "fcmToken" TEXT,
    "isAdminLocked" BOOLEAN NOT NULL DEFAULT false,
    "lockPassword" TEXT,
    "isUninstallBlocked" BOOLEAN NOT NULL DEFAULT true,
    "isLocationMandatory" BOOLEAN NOT NULL DEFAULT true,
    "isAppsControlRestricted" BOOLEAN NOT NULL DEFAULT true,
    "deviceAdminGranted" BOOLEAN NOT NULL DEFAULT false,
    "displayOverlayGranted" BOOLEAN NOT NULL DEFAULT false,
    "lastDeviceViolationAt" TIMESTAMP(3),
    "deviceViolationCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "currentPlanPrice" INTEGER,
    "pickupPhotoFront" TEXT,
    "pickupPhotoBack" TEXT,
    "pickupPhotoLeft" TEXT,
    "pickupPhotoRight" TEXT,
    "pickupPhotoWithVehicle" TEXT,
    "lastKnownLat" DOUBLE PRECISION,
    "lastKnownLng" DOUBLE PRECISION,
    "lastLocationAt" TIMESTAMP(3),
    "batteryLevel" INTEGER NOT NULL DEFAULT 100,

    CONSTRAINT "Rider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleReturn" (
    "id" TEXT NOT NULL,
    "riderId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "status" "VehicleReturnStatus" NOT NULL DEFAULT 'SUBMITTED',
    "photoFront" TEXT,
    "photoBack" TEXT,
    "photoLeft" TEXT,
    "photoRight" TEXT,
    "photoSpeedometer" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "reason" TEXT,
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleReturn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KycProfile" (
    "id" TEXT NOT NULL,
    "riderId" TEXT NOT NULL,
    "status" "KycStatus" NOT NULL DEFAULT 'PENDING',
    "profilePhoto" TEXT,
    "riderPhoto" TEXT,
    "signature" TEXT,
    "aadhaarFront" TEXT,
    "aadhaarBack" TEXT,
    "aadhaarNumber" TEXT,
    "panCard" TEXT,
    "panNumber" TEXT,
    "bankName" TEXT,
    "accountNumber" TEXT,
    "ifscCode" TEXT,
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KycProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Guarantor" (
    "id" TEXT NOT NULL,
    "riderId" TEXT NOT NULL,
    "status" "GuarantorStatus" NOT NULL DEFAULT 'PENDING',
    "name" TEXT,
    "relation" TEXT,
    "dob" TEXT,
    "phone" TEXT,
    "aadhaarFront" TEXT,
    "aadhaarBack" TEXT,
    "pan" TEXT,
    "video" TEXT,
    "signature" TEXT,
    "address" TEXT,
    "photo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "fatherName" TEXT,
    "motherName" TEXT,

    CONSTRAINT "Guarantor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wallet" (
    "id" TEXT NOT NULL,
    "riderId" TEXT NOT NULL,
    "balanceInPaise" INTEGER NOT NULL DEFAULT 0,
    "securityDeposit" INTEGER NOT NULL DEFAULT 0,
    "depositStatus" "DepositStatus" NOT NULL DEFAULT 'NOT_SUBMITTED',
    "paymentStreak" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletLedger" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "riderId" TEXT NOT NULL,
    "txnId" TEXT,
    "entryType" "LedgerEntryType" NOT NULL,
    "category" "LedgerCategory" NOT NULL,
    "amountInPaise" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "idempotencyKey" TEXT,
    "note" TEXT,
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DepositRecord" (
    "id" TEXT NOT NULL,
    "riderId" TEXT NOT NULL,
    "transactionId" TEXT,
    "amountInPaise" INTEGER NOT NULL DEFAULT 0,
    "status" "DepositStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectedBy" TEXT,
    "rejectionReason" TEXT,
    "refundedAt" TIMESTAMP(3),
    "refundedBy" TEXT,
    "refundedAmountInPaise" INTEGER,
    "forfeitedAt" TIMESTAMP(3),
    "forfeitedBy" TEXT,
    "forfeitReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DepositRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RentalLease" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "riderId" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "leaseDate" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT,
    "status" "RentalStatus" NOT NULL DEFAULT 'BOOKED',
    "basePrice" INTEGER NOT NULL,
    "finalPrice" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RentalLease_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "riderId" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "purpose" "TransactionPurpose" NOT NULL,
    "reason" TEXT,
    "method" TEXT,
    "status" "TransactionStatus" NOT NULL DEFAULT 'PENDING',
    "upiRef" TEXT,
    "receipt" TEXT,
    "proofUrl" TEXT,
    "remark" TEXT,
    "description" TEXT,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "idempotencyKey" TEXT,
    "reversedTxnId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransactionBreakdown" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "type" "breakdown_type" NOT NULL DEFAULT 'CHARGE',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TransactionBreakdown_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportTicket" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "riderId" TEXT NOT NULL,
    "vehicleId" TEXT,
    "category" "ticket_category" NOT NULL,
    "priority" "ticket_priority" NOT NULL DEFAULT 'MEDIUM',
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "SupportTicketStatus" NOT NULL DEFAULT 'OPEN',
    "troubleshootPath" TEXT,
    "assignedTo" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "attachments" TEXT,

    CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketMessage" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "senderType" "sender_type" NOT NULL,
    "message" TEXT NOT NULL,
    "attachments" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "riderId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" "notification_type" NOT NULL,
    "priority" "notification_priority" NOT NULL DEFAULT 'NORMAL',
    "deepLink" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationDelivery" (
    "id" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "riderId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "status" "notification_delivery_status" NOT NULL DEFAULT 'PENDING',
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorType" "actor_type" NOT NULL DEFAULT 'ADMIN',
    "action" "AuditActionType" NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "details" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncQueue" (
    "id" TEXT NOT NULL,
    "riderId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "method" "http_method" NOT NULL DEFAULT 'POST',
    "status" "sync_status" NOT NULL DEFAULT 'PENDING',
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "syncedAt" TIMESTAMP(3),

    CONSTRAINT "SyncQueue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FileRecord" (
    "id" TEXT NOT NULL,
    "ownerType" "FileOwnerType" NOT NULL DEFAULT 'RIDER',
    "ownerId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL DEFAULT 0,
    "checksum" TEXT,
    "visibility" "FileVisibility" NOT NULL DEFAULT 'PRIVATE',
    "status" "FileStatus" NOT NULL DEFAULT 'PENDING_UPLOAD',
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,

    CONSTRAINT "FileRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offers" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "icon" TEXT,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isSponsored" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupons" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "discountType" "discount_type" NOT NULL,
    "discountValue" INTEGER NOT NULL,
    "minAmount" INTEGER,
    "maxUses" INTEGER,
    "currentUses" INTEGER NOT NULL DEFAULT 0,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coupons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rewards" (
    "id" TEXT NOT NULL,
    "riderId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rewards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "valueType" TEXT NOT NULL DEFAULT 'STRING',
    "category" TEXT NOT NULL,
    "isSecret" BOOLEAN NOT NULL DEFAULT false,
    "isEditable" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "updatedByAdminId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legal_documents" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "legal_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faqs" (
    "id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "category" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "faqs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_leaders" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "team_leaders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "targetAudience" TEXT NOT NULL,
    "targetIds" TEXT NOT NULL DEFAULT '[]',
    "scheduledAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "status" "announcement_status" NOT NULL DEFAULT 'DRAFT',
    "totalRecipients" INTEGER NOT NULL DEFAULT 0,
    "deliveredCount" INTEGER NOT NULL DEFAULT 0,
    "readCount" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnnouncementDelivery" (
    "id" TEXT NOT NULL,
    "announcementId" TEXT NOT NULL,
    "riderId" TEXT NOT NULL,
    "status" "announcement_delivery_status" NOT NULL DEFAULT 'PENDING',
    "deliveredAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnnouncementDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Incident" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "riderId" TEXT,
    "vehicleId" TEXT,
    "type" "incident_type" NOT NULL,
    "severity" "incident_severity" NOT NULL DEFAULT 'MEDIUM',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "location" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "photos" TEXT NOT NULL DEFAULT '[]',
    "status" "incident_status" NOT NULL DEFAULT 'OPEN',
    "assignedTo" TEXT,
    "resolution" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "insuranceClaim" BOOLEAN NOT NULL DEFAULT false,
    "insuranceClaimNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Incident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiderEarning" (
    "id" TEXT NOT NULL,
    "riderId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "platform" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "trips" INTEGER NOT NULL DEFAULT 0,
    "distance" DOUBLE PRECISION,
    "hoursOnline" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RiderEarning_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiderScore" (
    "id" TEXT NOT NULL,
    "riderId" TEXT NOT NULL,
    "paymentScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "kycScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "activityScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "supportScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "compositeScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "riskLevel" "risk_level" NOT NULL DEFAULT 'LOW',
    "lastCalculated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RiderScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrafficFine" (
    "id" TEXT NOT NULL,
    "riderId" TEXT NOT NULL,
    "vehicleId" TEXT,
    "fineId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "location" TEXT,
    "violationType" TEXT NOT NULL,
    "violationDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" "fine_status" NOT NULL DEFAULT 'PENDING',
    "paymentProofUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrafficFine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceViolation" (
    "id" TEXT NOT NULL,
    "riderId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "status" "violation_status" NOT NULL DEFAULT 'ACTIVE',
    "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "DeviceViolation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserContact" (
    "id" TEXT NOT NULL,
    "riderId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserCallLog" (
    "id" TEXT NOT NULL,
    "riderId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "name" TEXT,
    "type" TEXT NOT NULL,
    "duration" INTEGER NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserCallLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserLocation" (
    "id" TEXT NOT NULL,
    "riderId" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "accuracy" DOUBLE PRECISION,
    "speed" DOUBLE PRECISION,
    "isMocked" BOOLEAN NOT NULL DEFAULT false,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtpCode" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "salt" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "resendCount" INTEGER NOT NULL DEFAULT 1,
    "lastSentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OtpCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimitBucket" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "resetAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimitBucket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboxEvent" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "status" "OutboxEventStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "OutboxEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReconciliationReport" (
    "id" TEXT NOT NULL,
    "reportDate" TEXT NOT NULL,
    "totalWallets" INTEGER NOT NULL,
    "matched" INTEGER NOT NULL,
    "mismatched" INTEGER NOT NULL,
    "totalLedgerSum" INTEGER NOT NULL,
    "totalWalletSum" INTEGER NOT NULL,
    "drift" INTEGER NOT NULL,
    "mismatchDetails" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReconciliationReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BackupSchedule" (
    "id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "frequency" TEXT NOT NULL DEFAULT 'DAILY',
    "timeOfDay" TEXT NOT NULL DEFAULT '02:00',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "dayOfWeek" INTEGER,
    "dayOfMonth" INTEGER,
    "includeDatabase" BOOLEAN NOT NULL DEFAULT true,
    "includeUploads" BOOLEAN NOT NULL DEFAULT true,
    "includeLogs" BOOLEAN NOT NULL DEFAULT false,
    "primaryBackupRoot" TEXT NOT NULL,
    "secondaryBackupRoot" TEXT,
    "keepDaily" INTEGER NOT NULL DEFAULT 7,
    "keepWeekly" INTEGER NOT NULL DEFAULT 4,
    "keepMonthly" INTEGER NOT NULL DEFAULT 6,
    "keepManual" INTEGER,
    "minimumFreeDiskGb" INTEGER NOT NULL DEFAULT 20,
    "lastRunAt" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3),
    "lastStatus" TEXT,
    "lastError" TEXT,
    "updatedByAdminId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BackupSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BackupJob" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "scheduleType" TEXT,
    "status" TEXT NOT NULL,
    "backupPath" TEXT,
    "databasePath" TEXT,
    "filesPath" TEXT,
    "manifestPath" TEXT,
    "checksumPath" TEXT,
    "sizeBytes" BIGINT,
    "fileCount" INTEGER,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdByAdminId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BackupJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RestoreJob" (
    "id" TEXT NOT NULL,
    "backupJobId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "requestedByAdminId" TEXT NOT NULL,
    "approvedByAdminId" TEXT,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RestoreJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Admin_email_key" ON "Admin"("email");

-- CreateIndex
CREATE INDEX "Admin_role_idx" ON "Admin"("role");

-- CreateIndex
CREATE INDEX "Admin_email_idx" ON "Admin"("email");

-- CreateIndex
CREATE UNIQUE INDEX "AdminSession_token_key" ON "AdminSession"("token");

-- CreateIndex
CREATE INDEX "AdminSession_adminId_idx" ON "AdminSession"("adminId");

-- CreateIndex
CREATE INDEX "AdminSession_token_idx" ON "AdminSession"("token");

-- CreateIndex
CREATE INDEX "AdminSession_expiresAt_idx" ON "AdminSession"("expiresAt");

-- CreateIndex
CREATE INDEX "RolePermission_role_idx" ON "RolePermission"("role");

-- CreateIndex
CREATE INDEX "RolePermission_permission_idx" ON "RolePermission"("permission");

-- CreateIndex
CREATE UNIQUE INDEX "RolePermission_role_permission_key" ON "RolePermission"("role", "permission");

-- CreateIndex
CREATE INDEX "Hub_isActive_idx" ON "Hub"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_vehicleId_key" ON "Vehicle"("vehicleId");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_vehicleNumber_key" ON "Vehicle"("vehicleNumber");

-- CreateIndex
CREATE INDEX "Vehicle_status_idx" ON "Vehicle"("status");

-- CreateIndex
CREATE INDEX "Vehicle_hubId_idx" ON "Vehicle"("hubId");

-- CreateIndex
CREATE INDEX "Vehicle_vehicleId_idx" ON "Vehicle"("vehicleId");

-- CreateIndex
CREATE INDEX "Vehicle_hubId_status_idx" ON "Vehicle"("hubId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Rider_riderId_key" ON "Rider"("riderId");

-- CreateIndex
CREATE UNIQUE INDEX "Rider_phone_key" ON "Rider"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "Rider_referralCode_key" ON "Rider"("referralCode");

-- CreateIndex
CREATE INDEX "Rider_lifecycleStatus_idx" ON "Rider"("lifecycleStatus");

-- CreateIndex
CREATE INDEX "Rider_phone_idx" ON "Rider"("phone");

-- CreateIndex
CREATE INDEX "Rider_riderId_idx" ON "Rider"("riderId");

-- CreateIndex
CREATE INDEX "Rider_referralCode_idx" ON "Rider"("referralCode");

-- CreateIndex
CREATE INDEX "Rider_referredBy_idx" ON "Rider"("referredBy");

-- CreateIndex
CREATE INDEX "Rider_teamLeader_idx" ON "Rider"("teamLeader");

-- CreateIndex
CREATE INDEX "Rider_phone_lifecycleStatus_idx" ON "Rider"("phone", "lifecycleStatus");

-- CreateIndex
CREATE INDEX "VehicleReturn_riderId_idx" ON "VehicleReturn"("riderId");

-- CreateIndex
CREATE INDEX "VehicleReturn_vehicleId_idx" ON "VehicleReturn"("vehicleId");

-- CreateIndex
CREATE INDEX "VehicleReturn_status_idx" ON "VehicleReturn"("status");

-- CreateIndex
CREATE INDEX "VehicleReturn_riderId_status_idx" ON "VehicleReturn"("riderId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "KycProfile_riderId_key" ON "KycProfile"("riderId");

-- CreateIndex
CREATE INDEX "KycProfile_status_idx" ON "KycProfile"("status");

-- CreateIndex
CREATE INDEX "KycProfile_riderId_idx" ON "KycProfile"("riderId");

-- CreateIndex
CREATE INDEX "KycProfile_status_riderId_idx" ON "KycProfile"("status", "riderId");

-- CreateIndex
CREATE UNIQUE INDEX "Guarantor_riderId_key" ON "Guarantor"("riderId");

-- CreateIndex
CREATE INDEX "Guarantor_riderId_idx" ON "Guarantor"("riderId");

-- CreateIndex
CREATE INDEX "Guarantor_status_idx" ON "Guarantor"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_riderId_key" ON "Wallet"("riderId");

-- CreateIndex
CREATE INDEX "Wallet_riderId_idx" ON "Wallet"("riderId");

-- CreateIndex
CREATE INDEX "Wallet_depositStatus_idx" ON "Wallet"("depositStatus");

-- CreateIndex
CREATE UNIQUE INDEX "WalletLedger_idempotencyKey_key" ON "WalletLedger"("idempotencyKey");

-- CreateIndex
CREATE INDEX "WalletLedger_walletId_idx" ON "WalletLedger"("walletId");

-- CreateIndex
CREATE INDEX "WalletLedger_riderId_idx" ON "WalletLedger"("riderId");

-- CreateIndex
CREATE INDEX "WalletLedger_txnId_idx" ON "WalletLedger"("txnId");

-- CreateIndex
CREATE INDEX "WalletLedger_category_idx" ON "WalletLedger"("category");

-- CreateIndex
CREATE INDEX "WalletLedger_createdAt_idx" ON "WalletLedger"("createdAt");

-- CreateIndex
CREATE INDEX "WalletLedger_riderId_createdAt_idx" ON "WalletLedger"("riderId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DepositRecord_riderId_key" ON "DepositRecord"("riderId");

-- CreateIndex
CREATE UNIQUE INDEX "DepositRecord_transactionId_key" ON "DepositRecord"("transactionId");

-- CreateIndex
CREATE INDEX "DepositRecord_status_idx" ON "DepositRecord"("status");

-- CreateIndex
CREATE INDEX "DepositRecord_riderId_idx" ON "DepositRecord"("riderId");

-- CreateIndex
CREATE INDEX "RentalLease_riderId_leaseDate_idx" ON "RentalLease"("riderId", "leaseDate");

-- CreateIndex
CREATE INDEX "RentalLease_vehicleId_leaseDate_idx" ON "RentalLease"("vehicleId", "leaseDate");

-- CreateIndex
CREATE INDEX "RentalLease_status_idx" ON "RentalLease"("status");

-- CreateIndex
CREATE INDEX "RentalLease_riderId_status_idx" ON "RentalLease"("riderId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "RentalLease_vehicleId_shiftId_leaseDate_key" ON "RentalLease"("vehicleId", "shiftId", "leaseDate");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_idempotencyKey_key" ON "Transaction"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Transaction_status_idx" ON "Transaction"("status");

-- CreateIndex
CREATE INDEX "Transaction_riderId_idx" ON "Transaction"("riderId");

-- CreateIndex
CREATE INDEX "Transaction_purpose_idx" ON "Transaction"("purpose");

-- CreateIndex
CREATE INDEX "Transaction_createdAt_idx" ON "Transaction"("createdAt");

-- CreateIndex
CREATE INDEX "Transaction_idempotencyKey_idx" ON "Transaction"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Transaction_riderId_status_idx" ON "Transaction"("riderId", "status");

-- CreateIndex
CREATE INDEX "Transaction_riderId_createdAt_idx" ON "Transaction"("riderId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SupportTicket_ticketId_key" ON "SupportTicket"("ticketId");

-- CreateIndex
CREATE INDEX "SupportTicket_status_idx" ON "SupportTicket"("status");

-- CreateIndex
CREATE INDEX "SupportTicket_riderId_idx" ON "SupportTicket"("riderId");

-- CreateIndex
CREATE INDEX "SupportTicket_priority_idx" ON "SupportTicket"("priority");

-- CreateIndex
CREATE INDEX "SupportTicket_assignedTo_idx" ON "SupportTicket"("assignedTo");

-- CreateIndex
CREATE INDEX "SupportTicket_riderId_status_idx" ON "SupportTicket"("riderId", "status");

-- CreateIndex
CREATE INDEX "TicketMessage_ticketId_idx" ON "TicketMessage"("ticketId");

-- CreateIndex
CREATE INDEX "TicketMessage_senderId_idx" ON "TicketMessage"("senderId");

-- CreateIndex
CREATE INDEX "Notification_riderId_idx" ON "Notification"("riderId");

-- CreateIndex
CREATE INDEX "Notification_isRead_idx" ON "Notification"("isRead");

-- CreateIndex
CREATE INDEX "Notification_type_idx" ON "Notification"("type");

-- CreateIndex
CREATE INDEX "Notification_priority_idx" ON "Notification"("priority");

-- CreateIndex
CREATE INDEX "Notification_riderId_isRead_idx" ON "Notification"("riderId", "isRead");

-- CreateIndex
CREATE INDEX "NotificationDelivery_riderId_idx" ON "NotificationDelivery"("riderId");

-- CreateIndex
CREATE INDEX "NotificationDelivery_status_idx" ON "NotificationDelivery"("status");

-- CreateIndex
CREATE INDEX "NotificationDelivery_notificationId_idx" ON "NotificationDelivery"("notificationId");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_expiresAt_idx" ON "AuditLog"("expiresAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_action_idx" ON "AuditLog"("entity", "entityId", "action");

-- CreateIndex
CREATE INDEX "SyncQueue_riderId_idx" ON "SyncQueue"("riderId");

-- CreateIndex
CREATE INDEX "SyncQueue_status_idx" ON "SyncQueue"("status");

-- CreateIndex
CREATE UNIQUE INDEX "FileRecord_storageKey_key" ON "FileRecord"("storageKey");

-- CreateIndex
CREATE INDEX "FileRecord_ownerType_ownerId_idx" ON "FileRecord"("ownerType", "ownerId");

-- CreateIndex
CREATE INDEX "FileRecord_ownerId_idx" ON "FileRecord"("ownerId");

-- CreateIndex
CREATE INDEX "FileRecord_purpose_idx" ON "FileRecord"("purpose");

-- CreateIndex
CREATE INDEX "FileRecord_status_idx" ON "FileRecord"("status");

-- CreateIndex
CREATE INDEX "FileRecord_ownerId_status_idx" ON "FileRecord"("ownerId", "status");

-- CreateIndex
CREATE INDEX "FileRecord_ownerId_purpose_idx" ON "FileRecord"("ownerId", "purpose");

-- CreateIndex
CREATE UNIQUE INDEX "coupons_code_key" ON "coupons"("code");

-- CreateIndex
CREATE UNIQUE INDEX "settings_key_key" ON "settings"("key");

-- CreateIndex
CREATE UNIQUE INDEX "system_settings_key_key" ON "system_settings"("key");

-- CreateIndex
CREATE INDEX "system_settings_category_idx" ON "system_settings"("category");

-- CreateIndex
CREATE INDEX "system_settings_key_idx" ON "system_settings"("key");

-- CreateIndex
CREATE UNIQUE INDEX "legal_documents_type_key" ON "legal_documents"("type");

-- CreateIndex
CREATE INDEX "AnnouncementDelivery_announcementId_idx" ON "AnnouncementDelivery"("announcementId");

-- CreateIndex
CREATE INDEX "AnnouncementDelivery_riderId_idx" ON "AnnouncementDelivery"("riderId");

-- CreateIndex
CREATE INDEX "AnnouncementDelivery_status_idx" ON "AnnouncementDelivery"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Incident_incidentId_key" ON "Incident"("incidentId");

-- CreateIndex
CREATE INDEX "Incident_riderId_idx" ON "Incident"("riderId");

-- CreateIndex
CREATE INDEX "Incident_vehicleId_idx" ON "Incident"("vehicleId");

-- CreateIndex
CREATE INDEX "Incident_status_idx" ON "Incident"("status");

-- CreateIndex
CREATE INDEX "Incident_type_idx" ON "Incident"("type");

-- CreateIndex
CREATE INDEX "Incident_severity_idx" ON "Incident"("severity");

-- CreateIndex
CREATE INDEX "Incident_createdAt_idx" ON "Incident"("createdAt");

-- CreateIndex
CREATE INDEX "RiderEarning_riderId_idx" ON "RiderEarning"("riderId");

-- CreateIndex
CREATE INDEX "RiderEarning_date_idx" ON "RiderEarning"("date");

-- CreateIndex
CREATE INDEX "RiderEarning_platform_idx" ON "RiderEarning"("platform");

-- CreateIndex
CREATE INDEX "RiderEarning_riderId_date_idx" ON "RiderEarning"("riderId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "RiderScore_riderId_key" ON "RiderScore"("riderId");

-- CreateIndex
CREATE INDEX "RiderScore_compositeScore_idx" ON "RiderScore"("compositeScore");

-- CreateIndex
CREATE INDEX "RiderScore_riskLevel_idx" ON "RiderScore"("riskLevel");

-- CreateIndex
CREATE UNIQUE INDEX "TrafficFine_fineId_key" ON "TrafficFine"("fineId");

-- CreateIndex
CREATE INDEX "TrafficFine_riderId_idx" ON "TrafficFine"("riderId");

-- CreateIndex
CREATE INDEX "TrafficFine_fineId_idx" ON "TrafficFine"("fineId");

-- CreateIndex
CREATE INDEX "TrafficFine_status_idx" ON "TrafficFine"("status");

-- CreateIndex
CREATE INDEX "DeviceViolation_riderId_idx" ON "DeviceViolation"("riderId");

-- CreateIndex
CREATE INDEX "DeviceViolation_status_idx" ON "DeviceViolation"("status");

-- CreateIndex
CREATE INDEX "DeviceViolation_riderId_status_idx" ON "DeviceViolation"("riderId", "status");

-- CreateIndex
CREATE INDEX "UserContact_riderId_idx" ON "UserContact"("riderId");

-- CreateIndex
CREATE INDEX "UserCallLog_riderId_idx" ON "UserCallLog"("riderId");

-- CreateIndex
CREATE INDEX "UserCallLog_riderId_timestamp_idx" ON "UserCallLog"("riderId", "timestamp");

-- CreateIndex
CREATE INDEX "UserLocation_riderId_idx" ON "UserLocation"("riderId");

-- CreateIndex
CREATE INDEX "UserLocation_riderId_timestamp_idx" ON "UserLocation"("riderId", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "OtpCode_phone_key" ON "OtpCode"("phone");

-- CreateIndex
CREATE INDEX "OtpCode_expiresAt_idx" ON "OtpCode"("expiresAt");

-- CreateIndex
CREATE INDEX "OtpCode_phone_idx" ON "OtpCode"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "RateLimitBucket_key_key" ON "RateLimitBucket"("key");

-- CreateIndex
CREATE INDEX "RateLimitBucket_resetAt_idx" ON "RateLimitBucket"("resetAt");

-- CreateIndex
CREATE INDEX "RateLimitBucket_key_idx" ON "RateLimitBucket"("key");

-- CreateIndex
CREATE INDEX "OutboxEvent_status_idx" ON "OutboxEvent"("status");

-- CreateIndex
CREATE INDEX "OutboxEvent_eventType_idx" ON "OutboxEvent"("eventType");

-- CreateIndex
CREATE INDEX "OutboxEvent_createdAt_idx" ON "OutboxEvent"("createdAt");

-- CreateIndex
CREATE INDEX "OutboxEvent_status_createdAt_idx" ON "OutboxEvent"("status", "createdAt");

-- CreateIndex
CREATE INDEX "OutboxEvent_status_eventType_idx" ON "OutboxEvent"("status", "eventType");

-- CreateIndex
CREATE UNIQUE INDEX "ReconciliationReport_reportDate_key" ON "ReconciliationReport"("reportDate");

-- CreateIndex
CREATE INDEX "ReconciliationReport_reportDate_idx" ON "ReconciliationReport"("reportDate");

-- CreateIndex
CREATE INDEX "ReconciliationReport_createdAt_idx" ON "ReconciliationReport"("createdAt");

-- CreateIndex
CREATE INDEX "BackupSchedule_enabled_idx" ON "BackupSchedule"("enabled");

-- CreateIndex
CREATE INDEX "BackupSchedule_nextRunAt_idx" ON "BackupSchedule"("nextRunAt");

-- CreateIndex
CREATE INDEX "BackupJob_status_idx" ON "BackupJob"("status");

-- CreateIndex
CREATE INDEX "BackupJob_type_idx" ON "BackupJob"("type");

-- CreateIndex
CREATE INDEX "BackupJob_scheduleType_idx" ON "BackupJob"("scheduleType");

-- CreateIndex
CREATE INDEX "BackupJob_createdAt_idx" ON "BackupJob"("createdAt");

-- CreateIndex
CREATE INDEX "BackupJob_createdByAdminId_idx" ON "BackupJob"("createdByAdminId");

-- CreateIndex
CREATE INDEX "RestoreJob_backupJobId_idx" ON "RestoreJob"("backupJobId");

-- CreateIndex
CREATE INDEX "RestoreJob_status_idx" ON "RestoreJob"("status");

-- CreateIndex
CREATE INDEX "RestoreJob_createdAt_idx" ON "RestoreJob"("createdAt");

-- AddForeignKey
ALTER TABLE "AdminSession" ADD CONSTRAINT "AdminSession_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_hubId_fkey" FOREIGN KEY ("hubId") REFERENCES "Hub"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rider" ADD CONSTRAINT "Rider_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleReturn" ADD CONSTRAINT "VehicleReturn_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "Rider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleReturn" ADD CONSTRAINT "VehicleReturn_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KycProfile" ADD CONSTRAINT "KycProfile_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "Rider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Guarantor" ADD CONSTRAINT "Guarantor_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "Rider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "Rider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletLedger" ADD CONSTRAINT "WalletLedger_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletLedger" ADD CONSTRAINT "WalletLedger_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "Rider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletLedger" ADD CONSTRAINT "WalletLedger_txnId_fkey" FOREIGN KEY ("txnId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepositRecord" ADD CONSTRAINT "DepositRecord_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "Rider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepositRecord" ADD CONSTRAINT "DepositRecord_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalLease" ADD CONSTRAINT "RentalLease_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalLease" ADD CONSTRAINT "RentalLease_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "Rider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalLease" ADD CONSTRAINT "RentalLease_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "Rider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionBreakdown" ADD CONSTRAINT "TransactionBreakdown_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "Rider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketMessage" ADD CONSTRAINT "TicketMessage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "Rider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rewards" ADD CONSTRAINT "rewards_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "Rider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnouncementDelivery" ADD CONSTRAINT "AnnouncementDelivery_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "Announcement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnouncementDelivery" ADD CONSTRAINT "AnnouncementDelivery_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "Rider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "Rider"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiderEarning" ADD CONSTRAINT "RiderEarning_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "Rider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiderScore" ADD CONSTRAINT "RiderScore_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "Rider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrafficFine" ADD CONSTRAINT "TrafficFine_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "Rider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceViolation" ADD CONSTRAINT "DeviceViolation_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "Rider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserContact" ADD CONSTRAINT "UserContact_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "Rider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCallLog" ADD CONSTRAINT "UserCallLog_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "Rider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserLocation" ADD CONSTRAINT "UserLocation_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "Rider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BackupJob" ADD CONSTRAINT "BackupJob_createdByAdminId_fkey" FOREIGN KEY ("createdByAdminId") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestoreJob" ADD CONSTRAINT "RestoreJob_backupJobId_fkey" FOREIGN KEY ("backupJobId") REFERENCES "BackupJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

