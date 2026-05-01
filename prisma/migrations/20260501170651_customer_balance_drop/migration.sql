-- Pack D.6 — drop Customer.balance.
--
-- Saldo a favor migró 100% a CustomerCredit + CreditConsumption durante
-- Pack D.1..D.5. Los valores residuales en Customer.balance eran reflejo
-- shadow-write que ya no aplica.
--
-- AlterTable
ALTER TABLE "Customer" DROP COLUMN "balance";
