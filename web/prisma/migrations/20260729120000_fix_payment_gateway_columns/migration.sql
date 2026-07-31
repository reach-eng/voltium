-- Fix payment_gateway columns for environments that applied the initial migration before column reconciliation

DO $$ 
BEGIN
    -- Rename apiKey to keyId if apiKey column exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'payment_gateways' AND column_name = 'apiKey'
    ) THEN
        ALTER TABLE "payment_gateways" RENAME COLUMN "apiKey" TO "keyId";
    END IF;

    -- Rename apiSecret to keySecret if apiSecret column exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'payment_gateways' AND column_name = 'apiSecret'
    ) THEN
        ALTER TABLE "payment_gateways" RENAME COLUMN "apiSecret" TO "keySecret";
    END IF;

    -- Add provider if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'payment_gateways' AND column_name = 'provider'
    ) THEN
        ALTER TABLE "payment_gateways" ADD COLUMN "provider" TEXT NOT NULL DEFAULT 'razorpay';
    END IF;

    -- Add apiEndpoint if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'payment_gateways' AND column_name = 'apiEndpoint'
    ) THEN
        ALTER TABLE "payment_gateways" ADD COLUMN "apiEndpoint" TEXT;
    END IF;

    -- Add createdAt if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'payment_gateways' AND column_name = 'createdAt'
    ) THEN
        ALTER TABLE "payment_gateways" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
    END IF;
END $$;
