-- DropForeignKey
ALTER TABLE "PurchaseReceipt" DROP CONSTRAINT "PurchaseReceipt_saleId_fkey";

-- AlterTable
ALTER TABLE "PurchaseReceipt" DROP COLUMN "saleId";
