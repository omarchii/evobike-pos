import type { PrismaClient } from "@prisma/client";
import { prisma as globalPrisma } from "@/lib/prisma";
import type { JobResult } from "./saldo-favor";

// Drift detector — Pack D.1 G10/Decisión 17.
//
// Compara `Customer.balance` vs `SUM(CustomerCredit.balance) WHERE expiredAt IS NULL`
// por cliente. Drift > 0 indica que shadow-write divergió o que un callsite legacy
// no migró a helper.
//
// Registrado en `/api/cron/runs/daily` desde D.5 (post-sweep). Drift > 0 ahora
// es bug real: todos los wires legacy fueron canalizados a helpers
// (rechargeCustomerCredit / applyCustomerCredit / mergeCustomerCredit).

const DRIFT_EPSILON = 0.005;

type DriftRow = {
  customerId: string;
  balance: number;
  sumCredit: number;
};

export async function detectCustomerCreditDrift(
  prisma: PrismaClient | typeof globalPrisma = globalPrisma,
  _opts?: { now?: Date },
): Promise<JobResult> {
  const rows = await prisma.$queryRaw<DriftRow[]>`
    SELECT
      c.id AS "customerId",
      c.balance::float AS balance,
      COALESCE(SUM(cc.balance) FILTER (WHERE cc."expiredAt" IS NULL), 0)::float AS "sumCredit"
    FROM "Customer" c
    LEFT JOIN "CustomerCredit" cc ON cc."customerId" = c.id
    WHERE c.balance > 0 OR cc.id IS NOT NULL
    GROUP BY c.id, c.balance
  `;

  const drifts = rows.filter(
    (r) => Math.abs(r.balance - r.sumCredit) > DRIFT_EPSILON,
  );

  let errorMessage: string | null = null;
  if (drifts.length > 0) {
    const totalAbs = drifts.reduce(
      (sum, r) => sum + Math.abs(r.balance - r.sumCredit),
      0,
    );
    errorMessage = `Drift en ${drifts.length}/${rows.length} clientes. Total absoluto $${totalAbs.toFixed(2)}. Investigar shadow-write o callsite no migrado.`;
  }

  return {
    processedCount: rows.length,
    errorCount: drifts.length,
    errorMessage,
  };
}
