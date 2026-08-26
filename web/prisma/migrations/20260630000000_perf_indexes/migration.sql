-- CreateIndex
CREATE INDEX "RentalLease_createdAt_idx" ON "RentalLease"("createdAt");

-- CreateIndex
CREATE INDEX "RentalLease_status_createdAt_idx" ON "RentalLease"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Transaction_createdAt_idx" ON "Transaction"("createdAt");

-- CreateIndex
CREATE INDEX "Transaction_status_createdAt_idx" ON "Transaction"("status", "createdAt");
