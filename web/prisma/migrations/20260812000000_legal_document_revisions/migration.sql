-- P1-2 (2026-08-05 legal/device audit): legal version history.
-- Every legal-document upsert previously overwrote the row with no way to
-- recover an accidental clear. Revisions are written on each save; the
-- legal_documents row remains the current pointer.

-- CreateTable
CREATE TABLE "legal_document_revisions" (
    "id" TEXT NOT NULL,
    "legalDocumentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "legal_document_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "legal_document_revisions_legalDocumentId_createdAt_idx" ON "legal_document_revisions"("legalDocumentId", "createdAt");

-- AddForeignKey
ALTER TABLE "legal_document_revisions" ADD CONSTRAINT "legal_document_revisions_legalDocumentId_fkey" FOREIGN KEY ("legalDocumentId") REFERENCES "legal_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
