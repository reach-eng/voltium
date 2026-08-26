-- CreateEnum
CREATE TYPE "MdrBearer" AS ENUM ('RIDER', 'MERCHANT');

-- CreateTable
CREATE TABLE "payment_gateways" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'razorpay',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "keyId" TEXT,
    "keySecret" TEXT,
    "merchantId" TEXT,
    "webhookSecret" TEXT,
    "apiEndpoint" TEXT,
    "environment" TEXT NOT NULL DEFAULT 'TEST',
    "extraFeePercent" DOUBLE PRECISION NOT NULL DEFAULT 2.5,
    "mdrBearer" "MdrBearer" NOT NULL DEFAULT 'RIDER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_gateways_pkey" PRIMARY KEY ("id")
);
