-- Add soft delete fields to core models

-- Rider soft delete
ALTER TABLE "Rider" ADD COLUMN "deletedAt" TIMESTAMP,
ADD COLUMN "deletedBy" TEXT,
ADD COLUMN "deletionReason" TEXT;

CREATE INDEX "Rider_deletedAt_idx" ON "Rider"("deletedAt");
CREATE INDEX "Rider_deletedAt_lifecycleStatus_idx" ON "Rider"("deletedAt", "lifecycleStatus");

-- Transaction soft delete
ALTER TABLE "Transaction" ADD COLUMN "deletedAt" TIMESTAMP,
ADD COLUMN "deletedBy" TEXT,
ADD COLUMN "deletionReason" TEXT;

CREATE INDEX "Transaction_deletedAt_idx" ON "Transaction"("deletedAt");
CREATE INDEX "Transaction_deletedAt_status_idx" ON "Transaction"("deletedAt", "status");

-- Admin soft delete
ALTER TABLE "Admin" ADD COLUMN "deletedAt" TIMESTAMP,
ADD COLUMN "deletedBy" TEXT,
ADD COLUMN "deletionReason" TEXT;

CREATE INDEX "Admin_deletedAt_idx" ON "Admin"("deletedAt");

-- SupportTicket soft delete
ALTER TABLE "SupportTicket" ADD COLUMN "deletedAt" TIMESTAMP,
ADD COLUMN "deletedBy" TEXT,
ADD COLUMN "deletionReason" TEXT;

CREATE INDEX "SupportTicket_deletedAt_idx" ON "SupportTicket"("deletedAt");
CREATE INDEX "SupportTicket_deletedAt_status_idx" ON "SupportTicket"("deletedAt", "status");

-- Vehicle soft delete
ALTER TABLE "Vehicle" ADD COLUMN "deletedAt" TIMESTAMP,
ADD COLUMN "deletedBy" TEXT,
ADD COLUMN "deletionReason" TEXT;

CREATE INDEX "Vehicle_deletedAt_idx" ON "Vehicle"("deletedAt");
CREATE INDEX "Vehicle_deletedAt_status_idx" ON "Vehicle"("deletedAt", "status");

-- Hub soft delete
ALTER TABLE "Hub" ADD COLUMN "deletedAt" TIMESTAMP,
ADD COLUMN "deletedBy" TEXT,
ADD COLUMN "deletionReason" TEXT;

CREATE INDEX "Hub_deletedAt_idx" ON "Hub"("deletedAt");

-- RentalLease soft delete
ALTER TABLE "RentalLease" ADD COLUMN "deletedAt" TIMESTAMP,
ADD COLUMN "deletedBy" TEXT,
ADD COLUMN "deletionReason" TEXT;

CREATE INDEX "RentalLease_deletedAt_idx" ON "RentalLease"("deletedAt");
CREATE INDEX "RentalLease_deletedAt_status_idx" ON "RentalLease"("deletedAt", "status");

-- Guarantor soft delete
ALTER TABLE "Guarantor" ADD COLUMN "deletedAt" TIMESTAMP,
ADD COLUMN "deletedBy" TEXT,
ADD COLUMN "deletionReason" TEXT;

CREATE INDEX "Guarantor_deletedAt_idx" ON "Guarantor"("deletedAt");
