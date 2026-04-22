-- AlterTable
ALTER TABLE "ServiceOrder" ADD COLUMN     "checklist" JSONB,
ADD COLUMN     "expectedDeliveryDate" TEXT,
ADD COLUMN     "photoUrls" JSONB,
ADD COLUMN     "signatureData" TEXT,
ADD COLUMN     "signatureRejected" BOOLEAN NOT NULL DEFAULT false;
