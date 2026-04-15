-- AlterTable
ALTER TABLE "CashTransaction" ADD COLUMN "userId" TEXT;

-- Backfill: asignar userId al opener del turno (mejor aproximación histórica)
UPDATE "CashTransaction" ct
SET "userId" = s."userId"
FROM "CashRegisterSession" s
WHERE ct."sessionId" = s."id" AND ct."userId" IS NULL;

-- AddForeignKey
ALTER TABLE "CashTransaction" ADD CONSTRAINT "CashTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
