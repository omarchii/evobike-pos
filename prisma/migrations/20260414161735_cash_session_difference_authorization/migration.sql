-- AlterEnum
ALTER TYPE "AuthorizationType" ADD VALUE 'CIERRE_DIFERENCIA';

-- AlterTable
ALTER TABLE "AuthorizationRequest" ADD COLUMN     "cashSessionId" TEXT;

-- AlterTable
ALTER TABLE "CashRegisterSession" ADD COLUMN     "authorizedById" TEXT,
ADD COLUMN     "diferencia" DECIMAL(10,2);

-- CreateIndex
CREATE UNIQUE INDEX "AuthorizationRequest_cashSessionId_key" ON "AuthorizationRequest"("cashSessionId");

-- AddForeignKey
ALTER TABLE "CashRegisterSession" ADD CONSTRAINT "CashRegisterSession_authorizedById_fkey" FOREIGN KEY ("authorizedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthorizationRequest" ADD CONSTRAINT "AuthorizationRequest_cashSessionId_fkey" FOREIGN KEY ("cashSessionId") REFERENCES "CashRegisterSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
