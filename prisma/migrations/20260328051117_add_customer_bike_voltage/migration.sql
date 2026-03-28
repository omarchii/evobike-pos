-- AlterTable
ALTER TABLE "CustomerBike" ADD COLUMN     "voltaje" TEXT;

-- CreateTable
CREATE TABLE "VoltageChangeLog" (
    "id" TEXT NOT NULL,
    "customerBikeId" TEXT NOT NULL,
    "fromVoltage" TEXT NOT NULL,
    "toVoltage" TEXT NOT NULL,
    "reason" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VoltageChangeLog_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "VoltageChangeLog" ADD CONSTRAINT "VoltageChangeLog_customerBikeId_fkey" FOREIGN KEY ("customerBikeId") REFERENCES "CustomerBike"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
