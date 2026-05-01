// Smoke D.4.b — verifica las 3 queries del reporte /reportes/saldo-favor.

import { prisma } from "@/lib/prisma";
import {
  SALDO_REPORT_SECTION_LIMIT,
  SALDO_SIN_USO_DEFAULT_DAYS,
  SALDO_VENCIMIENTO_PROXIMO_DEFAULT_DAYS,
} from "@/lib/config/saldo";

async function main(): Promise<void> {
  const now = new Date();

  // ── 1. Próximos vencimientos (default) ────────────────────────────────────
  const venceCutoff = new Date(
    now.getTime() + SALDO_VENCIMIENTO_PROXIMO_DEFAULT_DAYS * 24 * 60 * 60 * 1000,
  );
  const prox = await prisma.customerCredit.findMany({
    where: {
      expiredAt: null,
      balance: { gt: 0 },
      expiresAt: { lte: venceCutoff },
    },
    orderBy: { expiresAt: "asc" },
    take: SALDO_REPORT_SECTION_LIMIT,
    select: { id: true, balance: true, expiresAt: true, customer: { select: { name: true } } },
  });
  const proxTotal = prox.reduce((s, c) => s + Number(c.balance), 0);
  console.log(
    `[1] Próximos ${SALDO_VENCIMIENTO_PROXIMO_DEFAULT_DAYS}d: ${prox.length} créditos, total $${proxTotal.toFixed(2)}`,
  );

  // ── 2. Sin uso > 90d (default) ───────────────────────────────────────────
  const sinUsoCutoff = new Date(
    now.getTime() - SALDO_SIN_USO_DEFAULT_DAYS * 24 * 60 * 60 * 1000,
  );
  const sinUso = await prisma.customerCredit.findMany({
    where: {
      expiredAt: null,
      balance: { gt: 0 },
      createdAt: { lt: sinUsoCutoff },
    },
    orderBy: { createdAt: "asc" },
    take: SALDO_REPORT_SECTION_LIMIT,
    select: { id: true, balance: true, createdAt: true, alertSentAt: true, customer: { select: { name: true } } },
  });
  const sinUsoTotal = sinUso.reduce((s, c) => s + Number(c.balance), 0);
  console.log(
    `[2] Sin uso > ${SALDO_SIN_USO_DEFAULT_DAYS}d: ${sinUso.length} créditos, total $${sinUsoTotal.toFixed(2)}`,
  );

  // ── 3. Saldo perdido del mes actual ──────────────────────────────────────
  const monthFrom = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthTo = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const vencidoMes = await prisma.customerCredit.findMany({
    where: {
      expiredAt: { gte: monthFrom, lt: monthTo },
      balance: { gt: 0 },
    },
    orderBy: { expiredAt: "desc" },
    take: SALDO_REPORT_SECTION_LIMIT,
    select: { id: true, balance: true, expiredAt: true, customer: { select: { name: true } } },
  });
  const perdidoTotal = vencidoMes.reduce((s, c) => s + Number(c.balance), 0);
  console.log(
    `[3] Vencido en ${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}: ${vencidoMes.length} créditos, perdido $${perdidoTotal.toFixed(2)}`,
  );

  // ── 4. Sanity: total activos del sistema (para context) ───────────────────
  const activos = await prisma.customerCredit.aggregate({
    where: { expiredAt: null, balance: { gt: 0 } },
    _sum: { balance: true },
    _count: true,
  });
  console.log(
    `\n[OK] Total créditos activos en sistema: ${activos._count}, suma $${Number(activos._sum.balance ?? 0).toFixed(2)}`,
  );

  // ── 5. Verifica que el reporte expone un subset coherente ────────────────
  if (prox.length > activos._count) {
    console.error(`[FAIL] prox.length (${prox.length}) > total activos (${activos._count})`);
    process.exit(1);
  }
  if (sinUso.length > activos._count) {
    console.error(`[FAIL] sinUso.length (${sinUso.length}) > total activos (${activos._count})`);
    process.exit(1);
  }
  console.log("[OK] secciones 1+2 son subsets de activos totales");

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
