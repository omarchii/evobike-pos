/*
  Warnings:

  - Changed the type of `method` on the `CashTransaction` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CARD', 'TRANSFER', 'CREDIT_BALANCE', 'ATRATO');

-- CreateEnum
CREATE TYPE "CollectionStatus" AS ENUM ('COLLECTED', 'PENDING');

-- AlterTable
ALTER TABLE "CashTransaction" ADD COLUMN     "collectionStatus" "CollectionStatus" NOT NULL DEFAULT 'COLLECTED',
DROP COLUMN "method",
ADD COLUMN     "method" "PaymentMethod" NOT NULL;
