/**
 * QA SEED — Fase P5 (Autorizaciones)
 * --------------------------------------------------------------------
 * Deja todo listo para probar manualmente el módulo de autorizaciones:
 *   • 4 usuarios con prefijo `qa_` (ADMIN, SELLER LEO, MANAGER LEO, MANAGER AV135)
 *   • PINs precargados (bcrypt) en los managers
 *   • 1 venta sintética COMPLETED en LEO para probar cancelación
 *   • 6 AuthorizationRequest en distintos estados para bandeja + historial
 *
 * USO:
 *   npx tsx prisma/qa-p5.ts
 *
 * IDEMPOTENTE: re-correrlo limpia las AuthorizationRequest de los qa_users
 * y las recrea con timestamps frescos. Usuarios y venta sintética se
 * mantienen vía upsert; si la venta fue cancelada, se restaura a COMPLETED
 * para poder re-probar el flujo de cancelación.
 *
 * SEGURIDAD: no corre en NODE_ENV=production.
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// === Constantes de prueba ===
const QA = {
  admin: { email: "qa_admin@evobike.test", name: "QA Admin", password: "qa12345" },
  sellerLeo: {
    email: "qa_seller_leo@evobike.test",
    name: "QA Seller LEO",
    password: "qa12345",
  },
  managerLeo: {
    email: "qa_manager_leo@evobike.test",
    name: "QA Manager LEO",
    password: "qa12345",
    pin: "1234",
  },
  managerAv135: {
    email: "qa_manager_av135@evobike.test",
    name: "QA Manager AV135",
    password: "qa12345",
    pin: "5678",
  },
} as const;

const QA_CUSTOMER_PHONE = "qa-9999999999"; // sentinela de idempotencia
const QA_SALE_FOLIO = "QA-LEO-CANCEL-0001"; // sentinela de idempotencia
const QA_SESSION_OPENING = 500;

if (process.env.NODE_ENV === "production") {
  console.error("❌ Este script NO puede correr en producción.");
  process.exit(1);
}

async function upsertQaUser(opts: {
  email: string;
  name: string;
  password: string;
  role: "ADMIN" | "MANAGER" | "SELLER";
  branchId: string | null;
  pin?: string;
}) {
  const passwordHash = await bcrypt.hash(opts.password, 10);
  const pinHash = opts.pin ? await bcrypt.hash(opts.pin, 10) : null;

  return prisma.user.upsert({
    where: { email: opts.email },
    create: {
      email: opts.email,
      name: opts.name,
      password: passwordHash,
      role: opts.role,
      branchId: opts.branchId,
      isActive: true,
      pin: pinHash,
    },
    update: {
      name: opts.name,
      password: passwordHash,
      role: opts.role,
      branchId: opts.branchId,
      isActive: true,
      pin: pinHash,
    },
  });
}

async function main() {
  console.log("🌱 Iniciando QA seed P5...\n");

  // 1. Branches deben existir
  const leo = await prisma.branch.findUnique({ where: { code: "LEO" } });
  const av135 = await prisma.branch.findUnique({ where: { code: "AV135" } });
  if (!leo || !av135) {
    throw new Error(
      "Faltan sucursales LEO y/o AV135. Corre primero `npx prisma db seed`.",
    );
  }

  // 2. Usuarios qa_*
  console.log("👥 Upserting usuarios qa_*...");
  await upsertQaUser({
    email: QA.admin.email,
    name: QA.admin.name,
    password: QA.admin.password,
    role: "ADMIN",
    branchId: null,
  });
  const sellerLeo = await upsertQaUser({
    email: QA.sellerLeo.email,
    name: QA.sellerLeo.name,
    password: QA.sellerLeo.password,
    role: "SELLER",
    branchId: leo.id,
  });
  const managerLeo = await upsertQaUser({
    email: QA.managerLeo.email,
    name: QA.managerLeo.name,
    password: QA.managerLeo.password,
    role: "MANAGER",
    branchId: leo.id,
    pin: QA.managerLeo.pin,
  });
  await upsertQaUser({
    email: QA.managerAv135.email,
    name: QA.managerAv135.name,
    password: QA.managerAv135.password,
    role: "MANAGER",
    branchId: av135.id,
    pin: QA.managerAv135.pin,
  });
  console.log("   ✓ 4 usuarios listos\n");

  // 3. Customer sintético
  console.log("👤 Upserting customer sintético...");
  const customer = await prisma.customer.upsert({
    where: { phone: QA_CUSTOMER_PHONE },
    create: {
      name: "QA Cliente Cancelación",
      phone: QA_CUSTOMER_PHONE,
      email: "qa_customer@evobike.test",
    },
    update: {},
  });
  console.log(`   ✓ ${customer.name}\n`);

  // 4. CashRegisterSession abierta para qa_seller_leo
  console.log("💰 Asegurando CashRegisterSession abierta...");
  let session = await prisma.cashRegisterSession.findFirst({
    where: { userId: sellerLeo.id, status: "OPEN" },
  });
  if (!session) {
    session = await prisma.cashRegisterSession.create({
      data: {
        userId: sellerLeo.id,
        branchId: leo.id,
        openingAmt: QA_SESSION_OPENING,
        status: "OPEN",
      },
    });
    console.log(`   ✓ Sesión abierta nueva (id=${session.id.slice(0, 8)}...)\n`);
  } else {
    console.log(`   ✓ Sesión existente reutilizada\n`);
  }

  // 5. Venta sintética COMPLETED para probar cancelación
  console.log("🧾 Upserting venta sintética para cancelación...");
  const existingSale = await prisma.sale.findUnique({
    where: { folio: QA_SALE_FOLIO },
  });
  if (!existingSale) {
    await prisma.$transaction(async (tx) => {
      const created = await tx.sale.create({
        data: {
          folio: QA_SALE_FOLIO,
          branchId: leo.id,
          userId: sellerLeo.id,
          customerId: customer.id,
          subtotal: 1500,
          discount: 0,
          total: 1500,
          status: "COMPLETED",
          notes: "Venta QA — usar para probar cancelación de venta (P5-C)",
          warrantyDocReady: true,
          items: {
            create: {
              isFreeForm: true,
              description: "QA — concepto libre para test de cancelación",
              quantity: 1,
              price: 1500,
              discount: 0,
            },
          },
        },
      });
      await tx.cashTransaction.create({
        data: {
          sessionId: session!.id,
          saleId: created.id,
          type: "PAYMENT_IN",
          method: "CASH",
          amount: 1500,
          collectionStatus: "COLLECTED",
        },
      });
    });
    console.log(`   ✓ Venta nueva creada (folio=${QA_SALE_FOLIO})\n`);
  } else if (existingSale.status === "CANCELLED") {
    await prisma.sale.update({
      where: { id: existingSale.id },
      data: { status: "COMPLETED" },
    });
    console.log(`   ✓ Venta restaurada a COMPLETED (folio=${QA_SALE_FOLIO})\n`);
  } else {
    console.log(`   ✓ Venta existente reutilizada (folio=${QA_SALE_FOLIO})\n`);
  }

  // 6. AuthorizationRequests — wipe + recrear para timestamps frescos
  console.log("🔐 Recreando AuthorizationRequests para qa_*...");
  await prisma.authorizationRequest.deleteMany({
    where: { requestedBy: { in: [sellerLeo.id, managerLeo.id] } },
  });

  const now = new Date();
  const minFromNow = (m: number) => new Date(now.getTime() + m * 60_000);
  const daysAgo = (d: number) => new Date(now.getTime() - d * 24 * 60 * 60_000);

  // 6.1 PENDING remota — vence en 4 min (caso normal de bandeja)
  await prisma.authorizationRequest.create({
    data: {
      tipo: "DESCUENTO",
      status: "PENDING",
      mode: "REMOTA",
      branchId: leo.id,
      requestedBy: sellerLeo.id,
      monto: 350,
      motivo: "QA — descuento remoto pendiente (4 min restantes)",
      expiresAt: minFromNow(4),
    },
  });

  // 6.2 PENDING remota — vence en 30 segundos (test de auto-expire)
  await prisma.authorizationRequest.create({
    data: {
      tipo: "DESCUENTO",
      status: "PENDING",
      mode: "REMOTA",
      branchId: leo.id,
      requestedBy: sellerLeo.id,
      monto: 100,
      motivo: "QA — por expirar en 30s (test auto-expire en próximo poll)",
      expiresAt: new Date(now.getTime() + 30_000),
    },
  });

  // 6.3 PENDING remota — ya vencida (debería marcarse EXPIRED en próximo GET)
  await prisma.authorizationRequest.create({
    data: {
      tipo: "DESCUENTO",
      status: "PENDING",
      mode: "REMOTA",
      branchId: leo.id,
      requestedBy: sellerLeo.id,
      monto: 200,
      motivo: "QA — vencida, debe auto-marcarse EXPIRED al consultar bandeja",
      expiresAt: new Date(now.getTime() - 60_000),
    },
  });

  // 6.4 APPROVED presencial histórica
  await prisma.authorizationRequest.create({
    data: {
      tipo: "DESCUENTO",
      status: "APPROVED",
      mode: "PRESENCIAL",
      branchId: leo.id,
      requestedBy: sellerLeo.id,
      approvedBy: managerLeo.id,
      monto: 450,
      motivo: "QA — descuento aprobado histórico",
      createdAt: daysAgo(1),
      resolvedAt: daysAgo(1),
    },
  });

  // 6.5 REJECTED remota histórica
  await prisma.authorizationRequest.create({
    data: {
      tipo: "DESCUENTO",
      status: "REJECTED",
      mode: "REMOTA",
      branchId: leo.id,
      requestedBy: sellerLeo.id,
      approvedBy: managerLeo.id,
      monto: 1200,
      motivo: "QA — descuento solicitado",
      rejectReason: "Excede umbral permitido sin validación adicional",
      expiresAt: daysAgo(2),
      createdAt: daysAgo(2),
      resolvedAt: daysAgo(2),
    },
  });

  // 6.6 APPROVED cancelación histórica (sin saleId para no chocar con la venta sintética)
  await prisma.authorizationRequest.create({
    data: {
      tipo: "CANCELACION",
      status: "APPROVED",
      mode: "PRESENCIAL",
      branchId: leo.id,
      requestedBy: sellerLeo.id,
      approvedBy: managerLeo.id,
      motivo: "QA — cancelación aprobada histórica",
      createdAt: daysAgo(3),
      resolvedAt: daysAgo(3),
    },
  });

  console.log("   ✓ 6 AuthorizationRequest creadas\n");

  // === Resumen ===
  console.log("─".repeat(64));
  console.log("✅ QA seed P5 listo\n");
  console.log("Usuarios (password = 'qa12345' para todos):");
  console.log(`   • ${QA.admin.email}        (ADMIN)`);
  console.log(`   • ${QA.sellerLeo.email}    (SELLER LEO)`);
  console.log(`   • ${QA.managerLeo.email}   (MANAGER LEO,   PIN ${QA.managerLeo.pin})`);
  console.log(`   • ${QA.managerAv135.email} (MANAGER AV135, PIN ${QA.managerAv135.pin})\n`);
  console.log(`Venta para cancelar: folio ${QA_SALE_FOLIO} (LEO, $1,500, COMPLETED)`);
  console.log(`AuthorizationRequests: 3 PENDING (normal / 30s / vencida)`);
  console.log(`                       + 3 históricas (APPROVED, REJECTED, CANCELACION)\n`);
  console.log("Sigue el plan de QA del chat. Re-corre este script para resetear.");
  console.log("─".repeat(64));
}

main()
  .catch((e) => {
    console.error("❌ QA seed falló:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
