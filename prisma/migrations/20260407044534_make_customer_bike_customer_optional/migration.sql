-- DropForeignKey
ALTER TABLE "CustomerBike" DROP CONSTRAINT "CustomerBike_customerId_fkey";

-- AlterTable
ALTER TABLE "CustomerBike" ALTER COLUMN "customerId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "CustomerBike" ADD CONSTRAINT "CustomerBike_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
