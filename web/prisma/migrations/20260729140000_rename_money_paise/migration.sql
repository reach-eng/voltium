-- Migration to rename Int money fields to *InPaise for unit consistency

DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'transactions' AND column_name = 'amount'
    ) THEN
        ALTER TABLE "transactions" RENAME COLUMN "amount" TO "amountInPaise";
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'transaction_breakdowns' AND column_name = 'amount'
    ) THEN
        ALTER TABLE "transaction_breakdowns" RENAME COLUMN "amount" TO "amountInPaise";
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'RentalLease' AND column_name = 'basePrice'
    ) THEN
        ALTER TABLE "RentalLease" RENAME COLUMN "basePrice" TO "basePriceInPaise";
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'RentalLease' AND column_name = 'finalPrice'
    ) THEN
        ALTER TABLE "RentalLease" RENAME COLUMN "finalPrice" TO "finalPriceInPaise";
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'rental_plans' AND column_name = 'price'
    ) THEN
        ALTER TABLE "rental_plans" RENAME COLUMN "price" TO "priceInPaise";
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'rental_plans' AND column_name = 'securityDeposit'
    ) THEN
        ALTER TABLE "rental_plans" RENAME COLUMN "securityDeposit" TO "securityDepositInPaise";
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Coupon' AND column_name = 'discountValue'
    ) THEN
        ALTER TABLE "Coupon" RENAME COLUMN "discountValue" TO "discountValueInPaise";
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'wallets' AND column_name = 'securityDeposit'
    ) THEN
        ALTER TABLE "wallets" RENAME COLUMN "securityDeposit" TO "securityDepositInPaise";
    END IF;
END $$;
