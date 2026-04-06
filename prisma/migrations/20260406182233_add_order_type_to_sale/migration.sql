-- CreateEnum
CREATE TYPE "OrderType" AS ENUM ('LAYAWAY', 'BACKORDER');

-- AlterTable
ALTER TABLE "Sale" ADD COLUMN     "expectedDeliveryDate" TIMESTAMP(3),
ADD COLUMN     "orderType" "OrderType";
