-- CreateEnum
CREATE TYPE "AuthorizationType" AS ENUM ('CANCELACION', 'DESCUENTO');

-- CreateEnum
CREATE TYPE "AuthorizationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "AuthorizationMode" AS ENUM ('PRESENCIAL', 'REMOTA');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "pin" TEXT;

-- CreateTable
CREATE TABLE "AuthorizationRequest" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "tipo" "AuthorizationType" NOT NULL,
    "status" "AuthorizationStatus" NOT NULL DEFAULT 'PENDING',
    "mode" "AuthorizationMode" NOT NULL,
    "saleId" TEXT,
    "requestedBy" TEXT NOT NULL,
    "approvedBy" TEXT,
    "monto" DECIMAL(10,2),
    "motivo" TEXT,
    "rejectReason" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "AuthorizationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuthorizationRequest_branchId_status_idx" ON "AuthorizationRequest"("branchId", "status");

-- CreateIndex
CREATE INDEX "AuthorizationRequest_requestedBy_status_idx" ON "AuthorizationRequest"("requestedBy", "status");

-- CreateIndex
CREATE INDEX "AuthorizationRequest_saleId_idx" ON "AuthorizationRequest"("saleId");

-- AddForeignKey
ALTER TABLE "AuthorizationRequest" ADD CONSTRAINT "AuthorizationRequest_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthorizationRequest" ADD CONSTRAINT "AuthorizationRequest_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthorizationRequest" ADD CONSTRAINT "AuthorizationRequest_requestedBy_fkey" FOREIGN KEY ("requestedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthorizationRequest" ADD CONSTRAINT "AuthorizationRequest_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
