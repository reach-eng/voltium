-- CreateEnum
CREATE TYPE "LegalDocumentStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- AlterTable
ALTER TABLE "legal_documents" ADD COLUMN     "publishedAt" TIMESTAMP(3),
ADD COLUMN     "status" "LegalDocumentStatus" NOT NULL DEFAULT 'PUBLISHED';

