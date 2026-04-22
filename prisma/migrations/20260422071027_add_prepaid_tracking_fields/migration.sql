-- AlterTable
ALTER TABLE "ServiceOrder" ADD COLUMN     "prepaidAmount" DECIMAL(10,2),
ADD COLUMN     "prepaidAt" TIMESTAMP(3),
ADD COLUMN     "prepaidMethod" "PaymentMethod";
