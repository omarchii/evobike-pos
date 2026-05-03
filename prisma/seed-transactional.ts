/**
 * Datos transaccionales de prueba — Fase P2, Sesión 2.
 *
 * Replica la lógica de las API Routes (sales, pedidos, service-orders, batteries/lots,
 * inventory/receipts, assembly/complete) sin acoplarse al código.
 *
 * Idempotencia: cada tarea chequea un marcador (Customer sentinel, count por sucursal, etc.)
 * y skipea si ya corrió. Para re-seedear, truncar las tablas manualmente.
 */
import {
  findConfigsByModelVoltage,
  resolveConfigForBike,
} from "@/lib/battery-configurations";
import {
  PrismaClient,
  Prisma,
  MovementType,
  BatteryStatus,
  AssemblyStatus,
  PaymentMethod,
  CollectionStatus,
  SaleStatus,
  SaleType,
  OrderType,
  ServiceOrderStatus,
  CommissionStatus,
  CommissionType,
  QuotationStatus,
  FormaPagoProveedor,
  EstadoPagoProveedor,
  WarrantyPolicyStatus,
  ModeloCategoria,
} from "@prisma/client";
import { generatePublicToken } from "../src/lib/workshop";

type Tx = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pickRandom<T>(arr: readonly T[]): T {
  if (arr.length === 0) throw new Error("pickRandom: empty array");
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomDateInLastMonths(months: number): Date {
  const now = Date.now();
  const span = months * 30 * 24 * 60 * 60 * 1000;
  return new Date(now - Math.floor(Math.random() * span));
}

function toYMD(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function branchPrefix(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9]/g, "")
    .substring(0, 3)
    .toUpperCase();
}

function dec(value: number): Prisma.Decimal {
  return new Prisma.Decimal(value.toFixed(2));
}

async function nextSaleFolio(
  tx: Tx,
  branchId: string,
  typeChar: "V" | "A" | "B" | "T",
): Promise<string> {
  // NOTA: la API real usa `branch.name`. En seed usamos `branch.code` para evitar
  // colisión cuando dos sucursales comparten prefix (ej. "Sucursal Leo" y "Sucursal Av 135"
  // ambos normalizan a "SUC"). Los folios resultantes quedan como "LEOV-0001" / "AV1V-0001".
  const updated = await tx.branch.update({
    where: { id: branchId },
    data: { lastSaleFolioNumber: { increment: 1 } },
    select: { lastSaleFolioNumber: true, code: true },
  });
  const codePrefix = branchPrefix(updated.code);
  return `${codePrefix}${typeChar}-${String(updated.lastSaleFolioNumber).padStart(4, "0")}`;
}

async function nextQuotationFolio(tx: Tx, branchId: string): Promise<string> {
  const updated = await tx.branch.update({
    where: { id: branchId },
    data: { lastQuotationFolioNumber: { increment: 1 } },
    select: { lastQuotationFolioNumber: true, code: true },
  });
  return `${updated.code}-COT-${String(updated.lastQuotationFolioNumber).padStart(4, "0")}`;
}

// ─── Entry point ──────────────────────────────────────────────────────────────

interface SeedContext {
  prisma: PrismaClient;
  leoBranchId: string;
  av135BranchId: string;
  adminUserId: string;
}

export async function seedTransactional(prisma: PrismaClient): Promise<void> {
  console.log("\n💼 Iniciando seed transaccional (Fase P2 Sesión 2)...");

  const [leoBranch, av135Branch, adminUser] = await Promise.all([
    prisma.branch.findUniqueOrThrow({ where: { code: "LEO" } }),
    prisma.branch.findUniqueOrThrow({ where: { code: "AV135" } }),
    prisma.user.findUniqueOrThrow({ where: { email: "admin@evobike.mx" } }),
  ]);

  const ctx: SeedContext = {
    prisma,
    leoBranchId: leoBranch.id,
    av135BranchId: av135Branch.id,
    adminUserId: adminUser.id,
  };

  await seedCustomers(ctx);
  await seedVehicleStock(ctx);
  await seedBatteryLots(ctx);
  await seedCashSessions(ctx);
  await seedCommissionRules(ctx);
  await seedAssemblyOrders(ctx);
  await seedSales(ctx);
  await seedPedidos(ctx);
  await seedServiceOrders(ctx);
  await seedMobileDashboardFixture(ctx);
  await seedQuotations(ctx);
  await seedPurchaseReceipts(ctx);
  await seedSuppliers(ctx);
  await seedWarrantyPolicies(ctx);

  console.log("✅ Seed transaccional completado.\n");
}

// ─── T1 Customers ─────────────────────────────────────────────────────────────

const CUSTOMER_FIRST_NAMES = [
  "Juan","María","José","Ana","Carlos","Laura","Pedro","Lucía","Miguel","Sofía",
  "Luis","Elena","Jorge","Isabel","Diego","Fernanda","Raúl","Paula","Andrés","Verónica",
  "Roberto","Claudia","Gabriel","Mónica","Héctor","Regina","Víctor","Daniela","Óscar","Patricia",
];

const CUSTOMER_LAST_NAMES = [
  "García","Martínez","López","Hernández","González","Rodríguez","Pérez","Sánchez",
  "Ramírez","Torres","Flores","Rivera","Gómez","Díaz","Vargas","Castro",
];

async function seedCustomers(ctx: SeedContext): Promise<void> {
  // Customer.phone dejó de ser @unique (BRIEF.md §3.1); usamos findFirst.
  const existingSentinel = await ctx.prisma.customer.findFirst({
    where: { phone: "9981111001" },
  });
  if (existingSentinel) {
    console.log("  ⏭️  Customers de prueba ya existen, skip.");
    return;
  }

  const customers: Prisma.CustomerCreateInput[] = [];

  // 15 completos
  for (let i = 0; i < 15; i++) {
    customers.push({
      name: `${pickRandom(CUSTOMER_FIRST_NAMES)} ${pickRandom(CUSTOMER_LAST_NAMES)}`,
      phone: `998111${String(1000 + i).padStart(4, "0")}`,
      email: `cliente${i + 1}@example.com`,
      shippingStreet: `Calle ${randomBetween(1, 80)}`,
      shippingExtNum: String(randomBetween(100, 999)),
      shippingColonia: pickRandom(["Centro", "SM 21", "SM 25", "SM 50"]),
      shippingCity: "Cancún",
      shippingState: "Quintana Roo",
      shippingZip: String(77500 + randomBetween(0, 30)),
      rfc: `XAXX${String(randomBetween(100000, 999999))}${pickRandom(["X1A", "Y2B", "Z3C"])}`,
      razonSocial: `Razón Social ${i + 1} SA de CV`,
      regimenFiscal: pickRandom(["601", "603", "612", "626"]),
      usoCFDI: pickRandom(["G03", "P01", "G01"]),
      emailFiscal: `fiscal${i + 1}@example.com`,
    });
  }
  // 10 básicos
  for (let i = 0; i < 10; i++) {
    customers.push({
      name: `${pickRandom(CUSTOMER_FIRST_NAMES)} ${pickRandom(CUSTOMER_LAST_NAMES)}`,
      phone: `998111${String(2000 + i).padStart(4, "0")}`,
      email: `basico${i + 1}@example.com`,
    });
  }
  // 5 sin balance directo — el saldo a favor se inyecta vía CustomerCredit abajo.
  const saldoSeedCount = 5;
  for (let i = 0; i < saldoSeedCount; i++) {
    customers.push({
      name: `${pickRandom(CUSTOMER_FIRST_NAMES)} ${pickRandom(CUSTOMER_LAST_NAMES)}`,
      phone: `998111${String(3000 + i).padStart(4, "0")}`,
      email: `saldo${i + 1}@example.com`,
    });
  }

  let created = 0;
  const saldoCustomerIds: string[] = [];
  for (const data of customers) {
    try {
      const c = await ctx.prisma.customer.create({ data });
      created++;
      if (typeof data.email === "string" && data.email.startsWith("saldo")) {
        saldoCustomerIds.push(c.id);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`  ❌ Customer ${data.phone}: ${msg}`);
    }
  }
  console.log(`  ✅ Customers creados: ${created}`);

  // Saldo a favor para los 5 customers "saldo*" — vía CustomerCredit (Pack D).
  const oneYearMs = 365 * 24 * 60 * 60 * 1000;
  for (const customerId of saldoCustomerIds) {
    const monto = dec(randomBetween(500, 5000));
    await ctx.prisma.customerCredit.create({
      data: {
        customerId,
        monto,
        balance: monto,
        origenTipo: "AJUSTE_MANAGER",
        notes: "seed transactional",
        expiresAt: new Date(Date.now() + oneYearMs),
      },
    });
  }
  if (saldoCustomerIds.length > 0) {
    console.log(`  ✅ CustomerCredit seedados: ${saldoCustomerIds.length}`);
  }
}

// ─── T2 Vehicle Stock ─────────────────────────────────────────────────────────

async function seedVehicleStock(ctx: SeedContext): Promise<void> {
  // Vehículos = ProductVariants cuyo modelo NO es "Batería"
  const variants = await ctx.prisma.productVariant.findMany({
    where: { isActive: true, modelo: { nombre: { not: "Batería" } } },
    select: { id: true },
  });

  const branches = [ctx.leoBranchId, ctx.av135BranchId];
  let created = 0;
  let skipped = 0;

  for (const v of variants) {
    for (const branchId of branches) {
      const existing = await ctx.prisma.stock.findUnique({
        where: { productVariantId_branchId: { productVariantId: v.id, branchId } },
      });
      if (existing) {
        skipped++;
        continue;
      }

      const qty = randomBetween(5, 15);
      try {
        await ctx.prisma.$transaction([
          ctx.prisma.stock.create({
            data: { productVariantId: v.id, branchId, quantity: qty },
          }),
          ctx.prisma.inventoryMovement.create({
            data: {
              productVariantId: v.id,
              branchId,
              userId: ctx.adminUserId,
              quantity: qty,
              type: MovementType.PURCHASE_RECEIPT,
              referenceId: "SEED_INITIAL",
            },
          }),
        ]);
        created++;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`  ❌ Stock variant ${v.id}/${branchId}: ${msg}`);
      }
    }
  }
  console.log(`  ✅ Stock vehículos: ${created} creados, ${skipped} preexistentes.`);
}

// ─── T3 Battery Lots ──────────────────────────────────────────────────────────

async function seedBatteryLots(ctx: SeedContext): Promise<void> {
  // Battery variants = los referenciados como batteryVariantId en BatteryConfiguration
  const configs = await ctx.prisma.batteryConfiguration.findMany({
    select: { batteryVariantId: true },
    distinct: ["batteryVariantId"],
  });
  const batteryVariantIds = Array.from(new Set(configs.map((c) => c.batteryVariantId)));
  if (batteryVariantIds.length === 0) {
    console.log("  ⏭️  No hay BatteryConfigurations, skip lotes.");
    return;
  }

  const branches = [
    { id: ctx.leoBranchId, code: "LEO" },
    { id: ctx.av135BranchId, code: "AV135" },
  ];

  let lotsCreated = 0;
  let batteriesCreated = 0;
  let skippedLots = 0;

  for (const branch of branches) {
    for (const variantId of batteryVariantIds) {
      for (let lotNum = 1; lotNum <= 3; lotNum++) {
        const reference = `SEED-${branch.code}-${variantId.substring(0, 6)}-${String(lotNum).padStart(3, "0")}`;
        const existing = await ctx.prisma.batteryLot.findFirst({
          where: { reference, branchId: branch.id },
          select: { id: true },
        });
        if (existing) {
          skippedLots++;
          continue;
        }

        const serialCount = randomBetween(8, 15);
        const serials = Array.from({ length: serialCount }, (_, i) =>
          `BAT-${branch.code}-${variantId.substring(0, 6)}-${String(lotNum).padStart(3, "0")}-${String(i + 1).padStart(3, "0")}`,
        );

        try {
          await ctx.prisma.$transaction(async (tx) => {
            const lot = await tx.batteryLot.create({
              data: {
                productVariantId: variantId,
                branchId: branch.id,
                userId: ctx.adminUserId,
                reference,
                supplier: "Proveedor Semilla SA",
              },
            });
            await tx.battery.createMany({
              data: serials.map((s) => ({
                serialNumber: s,
                lotId: lot.id,
                branchId: branch.id,
                status: BatteryStatus.IN_STOCK,
              })),
            });
            await tx.stock.upsert({
              where: {
                productVariantId_branchId: {
                  productVariantId: variantId,
                  branchId: branch.id,
                },
              },
              update: { quantity: { increment: serials.length } },
              create: {
                productVariantId: variantId,
                branchId: branch.id,
                quantity: serials.length,
              },
            });
            await tx.inventoryMovement.create({
              data: {
                productVariantId: variantId,
                branchId: branch.id,
                userId: ctx.adminUserId,
                quantity: serials.length,
                type: MovementType.PURCHASE_RECEIPT,
                referenceId: reference,
              },
            });
          });
          lotsCreated++;
          batteriesCreated += serialCount;
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error(`  ❌ Lote ${reference}: ${msg}`);
        }
      }
    }
  }
  console.log(
    `  ✅ BatteryLots: ${lotsCreated} creados (${batteriesCreated} baterías), ${skippedLots} preexistentes.`,
  );
}

// ─── T4 Cash Sessions ─────────────────────────────────────────────────────────
// Requerido antes de ventas. Crea sesiones cerradas históricas + 1 abierta actual por sucursal.

async function seedCashSessions(ctx: SeedContext): Promise<void> {
  const branches = [
    { id: ctx.leoBranchId, label: "LEO" },
    { id: ctx.av135BranchId, label: "AV135" },
  ];

  // Usuarios de cada sucursal (SELLER y MANAGER), excluyendo admin
  for (const branch of branches) {
    const existing = await ctx.prisma.cashRegisterSession.findFirst({
      where: { branchId: branch.id, status: "OPEN" },
      select: { id: true },
    });
    if (existing) {
      continue; // ya hay sesión abierta, skip
    }

    const users = await ctx.prisma.user.findMany({
      where: {
        branchId: branch.id,
        role: { in: ["SELLER", "MANAGER"] },
        isActive: true,
      },
      select: { id: true },
    });
    if (users.length === 0) continue;

    // 3 sesiones cerradas históricas + 1 abierta
    for (let i = 0; i < 3; i++) {
      const openedAt = randomDateInLastMonths(6);
      const closedAt = new Date(openedAt.getTime() + randomBetween(6, 10) * 60 * 60 * 1000);
      await ctx.prisma.cashRegisterSession.create({
        data: {
          branchId: branch.id,
          userId: pickRandom(users).id,
          openedAt,
          closedAt,
          openingAmt: dec(1000),
          closingAmt: dec(randomBetween(2000, 15000)),
          status: "CLOSED",
        },
      });
    }

    await ctx.prisma.cashRegisterSession.create({
      data: {
        branchId: branch.id,
        userId: pickRandom(users).id,
        openingAmt: dec(1000),
        status: "OPEN",
      },
    });
  }
  console.log("  ✅ CashRegisterSessions listas (cerradas históricas + 1 abierta por sucursal).");
}

// ─── T5 Commission Rules (mínimas) ────────────────────────────────────────────

async function seedCommissionRules(ctx: SeedContext): Promise<void> {
  const branches = [ctx.leoBranchId, ctx.av135BranchId];
  for (const branchId of branches) {
    const existing = await ctx.prisma.commissionRule.findFirst({
      where: { branchId, modeloId: null, role: "SELLER" },
    });
    if (existing) continue;

    // Regla genérica por sucursal: 3% a SELLER, 1% a MANAGER
    await ctx.prisma.commissionRule.createMany({
      data: [
        {
          branchId,
          role: "SELLER",
          commissionType: CommissionType.PERCENTAGE,
          value: new Prisma.Decimal("3.0000"),
          modeloId: null,
        },
        {
          branchId,
          role: "MANAGER",
          commissionType: CommissionType.PERCENTAGE,
          value: new Prisma.Decimal("1.0000"),
          modeloId: null,
        },
      ],
    });
  }
  console.log("  ✅ CommissionRules genéricas por sucursal.");
}

// ─── T6 Assembly Orders + CustomerBikes ──────────────────────────────────────

async function seedAssemblyOrders(ctx: SeedContext): Promise<void> {
  const existingCount = await ctx.prisma.assemblyOrder.count();
  if (existingCount > 0) {
    console.log(`  ⏭️  AssemblyOrders ya existen (${existingCount}), skip.`);
    return;
  }

  const branches = [
    { id: ctx.leoBranchId, code: "LEO" },
    { id: ctx.av135BranchId, code: "AV135" },
  ];

  let pendingCount = 0;
  let completedCount = 0;

  for (const branch of branches) {
    // Variantes ensamblables: tienen BatteryConfiguration para (modelo_id, voltaje_id).
    // Se ignora `modelo.requiere_vin` porque el seed de catálogo lo deja en false por upsert-drift.
    const variants = await ctx.prisma.productVariant.findMany({
      where: {
        isActive: true,
        modelo: { nombre: { not: "Batería" }, esBateria: false },
      },
      select: {
        id: true,
        modelo: { select: { id: true, nombre: true } },
        voltaje: { select: { id: true, label: true } },
        color: { select: { nombre: true } },
        capacidad: { select: { nombre: true } },
      },
    });

    const variantsWithConfig: typeof variants = [];
    for (const v of variants) {
      const cfgs = await findConfigsByModelVoltage(v.modelo.id, v.voltaje.id, ctx.prisma);
      if (cfgs.length > 0) variantsWithConfig.push(v);
    }

    if (variantsWithConfig.length === 0) continue;

    // 5-10 PENDING por sucursal, 60% COMPLETED
    const totalOrders = randomBetween(5, 10);

    for (let i = 0; i < totalOrders; i++) {
      const variant = pickRandom(variantsWithConfig);
      const shouldComplete = Math.random() < 0.6;

      try {
        await ctx.prisma.$transaction(async (tx) => {
          const order = await tx.assemblyOrder.create({
            data: {
              branchId: branch.id,
              productVariantId: variant.id,
              status: AssemblyStatus.PENDING,
              receiptReference: "SEED_RECEPCION",
            },
          });
          if (!shouldComplete) return;

          // Completar: crear CustomerBike + asignar baterías
          const vin = `EVB-${branch.code}-${variant.modelo.nombre.replace(/\s+/g, "").toUpperCase()}-${String(i + 1).padStart(4, "0")}`;
          const bike = await tx.customerBike.create({
            data: {
              branchId: branch.id,
              productVariantId: variant.id,
              serialNumber: vin,
              brand: "EVOBIKE",
              model: variant.modelo.nombre,
              voltaje: variant.voltaje.label + (variant.capacidad ? ` · ${variant.capacidad.nombre}` : ""),
              color: variant.color.nombre,
            },
          });

          // I10 deterministic seed (Pack A.2 §1.3.6): pick lowest-Ah capacidad and
          // verify via resolveConfigForBike. Validates helper end-to-end — primer
          // caller real post-sweep. Pre-I10 era findFirst({m,v}) arbitrario,
          // bug ACTIVO Evotank multi-config desde 2026-04-19.
          const candidates = await tx.batteryConfiguration.findMany({
            where: { modeloId: variant.modelo.id, voltajeId: variant.voltaje.id },
            include: {
              batteryVariant: { select: { capacidad: { select: { id: true, valorAh: true } } } },
            },
            orderBy: { batteryVariant: { capacidad: { valorAh: "asc" } } },
          });
          const deterministicCapacidadId = candidates[0]?.batteryVariant?.capacidad?.id ?? null;
          const cfg = deterministicCapacidadId
            ? await resolveConfigForBike(
                {
                  modeloId: variant.modelo.id,
                  voltajeId: variant.voltaje.id,
                  batteryCapacidadId: deterministicCapacidadId,
                },
                tx,
              )
            : (candidates[0] ?? null);
          if (!cfg) {
            await tx.assemblyOrder.update({
              where: { id: order.id },
              data: { customerBikeId: bike.id, status: AssemblyStatus.COMPLETED, assembledByUserId: ctx.adminUserId, completedAt: new Date() },
            });
            return;
          }

          // Tomar baterías IN_STOCK del tipo correcto en esta sucursal
          const available = await tx.battery.findMany({
            where: {
              branchId: branch.id,
              status: BatteryStatus.IN_STOCK,
              lot: { productVariantId: cfg.batteryVariantId },
            },
            take: cfg.quantity,
            select: { id: true },
          });
          if (available.length < cfg.quantity) {
            // No hay suficientes → dejar PENDING, pero ya creamos la CustomerBike
            // Revertir: mejor borrar la bike y dejar la order como PENDING
            await tx.customerBike.delete({ where: { id: bike.id } });
            return;
          }

          const batteryIds = available.map((b) => b.id);
          await tx.batteryAssignment.createMany({
            data: batteryIds.map((bid) => ({
              batteryId: bid,
              customerBikeId: bike.id,
              assemblyOrderId: order.id,
              assignedByUserId: ctx.adminUserId,
              isCurrent: true,
            })),
          });
          await tx.battery.updateMany({
            where: { id: { in: batteryIds } },
            data: { status: BatteryStatus.INSTALLED },
          });
          await tx.assemblyOrder.update({
            where: { id: order.id },
            data: {
              customerBikeId: bike.id,
              status: AssemblyStatus.COMPLETED,
              assembledByUserId: ctx.adminUserId,
              completedAt: new Date(),
            },
          });
        });
        if (shouldComplete) completedCount++;
        else pendingCount++;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`  ❌ AssemblyOrder ${branch.code} #${i}: ${msg}`);
      }
    }
  }
  console.log(`  ✅ AssemblyOrders: ${pendingCount} PENDING, ${completedCount} COMPLETED.`);
}

// ─── T7 Sales + Commissions ──────────────────────────────────────────────────

interface CommissionTarget {
  productVariantId: string;
  quantity: number;
  price: number;
  discount: number;
}

async function generateCommissionsForSale(
  tx: Tx,
  saleId: string,
  userId: string,
  branchId: string,
  items: CommissionTarget[],
): Promise<void> {
  const user = await tx.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (!user) return;

  for (const item of items) {
    const variant = await tx.productVariant.findUnique({
      where: { id: item.productVariantId },
      select: { modelo_id: true },
    });
    if (!variant) continue;

    const rule = await tx.commissionRule.findFirst({
      where: {
        branchId,
        role: user.role,
        isActive: true,
        OR: [{ modeloId: variant.modelo_id }, { modeloId: null }],
      },
      orderBy: { modeloId: "desc" },
    });
    if (!rule) continue;

    const lineTotal = item.price * item.quantity - item.discount;
    const value = Number(rule.value);
    const amount =
      rule.commissionType === CommissionType.PERCENTAGE
        ? lineTotal * (value / 100)
        : value;
    if (amount <= 0) continue;

    await tx.commissionRecord.create({
      data: {
        saleId,
        userId,
        ruleId: rule.id,
        amount: dec(amount),
        status: CommissionStatus.PENDING,
      },
    });
  }
}

async function seedSales(ctx: SeedContext): Promise<void> {
  const branches = [
    { id: ctx.leoBranchId, code: "LEO" },
    { id: ctx.av135BranchId, code: "AV135" },
  ];

  for (const branch of branches) {
    const existing = await ctx.prisma.sale.count({ where: { branchId: branch.id } });
    if (existing > 0) {
      console.log(`  ⏭️  Sales ya existen en ${branch.code} (${existing}), skip.`);
      continue;
    }

    const sellers = await ctx.prisma.user.findMany({
      where: { branchId: branch.id, role: "SELLER", isActive: true },
      select: { id: true },
    });
    if (sellers.length === 0) continue;

    const customers = await ctx.prisma.customer.findMany({ select: { id: true } });
    if (customers.length === 0) continue;

    // Sesión abierta actual (para transacciones "actuales")
    const openSession = await ctx.prisma.cashRegisterSession.findFirst({
      where: { branchId: branch.id, status: "OPEN" },
      select: { id: true, userId: true },
    });
    const historicalSessions = await ctx.prisma.cashRegisterSession.findMany({
      where: { branchId: branch.id, status: "CLOSED" },
      select: { id: true, userId: true, openedAt: true },
    });

    // SimpleProducts con stock para ventas de accesorios
    const simpleProducts = await ctx.prisma.simpleProduct.findMany({
      where: {
        isActive: true,
        stocks: { some: { branchId: branch.id, quantity: { gt: 0 } } },
      },
      take: 50,
      select: { id: true, nombre: true, precioPublico: true },
    });

    // Variantes con stock disponible
    const variantsInStock = await ctx.prisma.stock.findMany({
      where: { branchId: branch.id, quantity: { gt: 2 }, productVariantId: { not: null } },
      select: {
        productVariantId: true,
        productVariant: {
          select: {
            id: true,
            precioPublico: true,
            modelo: { select: { id: true, nombre: true } },
            voltaje: { select: { id: true } },
          },
        },
      },
    });

    // Set de variantIds que son "ensamblables" (tienen BatteryConfiguration).
    // Usar este set en lugar de modelo.requiere_vin (deprecado por drift en seed).
    const assemblableVariantIds = new Set<string>();
    for (const row of variantsInStock) {
      if (!row.productVariant) continue;
      const cfgs = await findConfigsByModelVoltage(
        row.productVariant.modelo.id,
        row.productVariant.voltaje.id,
        ctx.prisma,
      );
      if (cfgs.length > 0) assemblableVariantIds.add(row.productVariant.id);
    }

    // CustomerBikes disponibles (ensambladas, sin dueño)
    const availableBikesAll = await ctx.prisma.customerBike.findMany({
      where: { branchId: branch.id, customerId: null },
      select: { id: true, productVariantId: true },
    });

    const TARGET = 50;
    let completed = 0;
    let cancelled = 0;

    for (let i = 0; i < TARGET; i++) {
      try {
        // QA P10-C: garantizar 3 casos deterministas de descuento en las primeras
        // ventas COMPLETED de esta sucursal. 0 = Sale.discount, 1 = SaleItem.discount,
        // 2 = combinado. El resto del loop sigue aleatorio.
        const qaDiscountCase = completed < 3 ? completed : null;
        const isCancelled = qaDiscountCase !== null ? false : Math.random() < 0.05;
        const sellerId = pickRandom(sellers).id;
        const customerId = pickRandom(customers).id;

        // Decidir items: 70% vehículo + accesorio, 30% solo accesorios
        const useVehicle = Math.random() < 0.7 && variantsInStock.length > 0;
        const saleItems: Array<{
          productVariantId: string;
          simpleProductId: string | null;
          quantity: number;
          price: number;
          description: string;
          customerBikeId?: string;
        }> = [];

        let chosenBikeId: string | undefined;
        if (useVehicle) {
          const stockItem = pickRandom(variantsInStock);
          if (!stockItem.productVariant || !stockItem.productVariantId) continue;
          const variantId = stockItem.productVariant.id;

          if (assemblableVariantIds.has(variantId)) {
            const availableBike = availableBikesAll.find((b) => b.productVariantId === variantId);
            if (availableBike) {
              chosenBikeId = availableBike.id;
              const idx = availableBikesAll.indexOf(availableBike);
              if (idx >= 0) availableBikesAll.splice(idx, 1);
            } else {
              continue; // no hay bike disponible, saltar
            }
          }

          saleItems.push({
            productVariantId: variantId,
            simpleProductId: null,
            quantity: 1,
            price: Number(stockItem.productVariant.precioPublico),
            description: stockItem.productVariant.modelo.nombre,
            customerBikeId: chosenBikeId,
          });
        }

        // Agregar 1-2 accesorios
        const accCount = randomBetween(useVehicle ? 0 : 1, 2);
        for (let j = 0; j < accCount; j++) {
          if (simpleProducts.length === 0) break;
          const sp = pickRandom(simpleProducts);
          saleItems.push({
            productVariantId: "", // marker: es simple product
            simpleProductId: sp.id,
            quantity: randomBetween(1, 2),
            price: Number(sp.precioPublico),
            description: sp.nombre,
          });
        }

        if (saleItems.length === 0) continue;

        // Descuentos por línea (QA cases 1 y 2): 10% del bruto de la primera línea.
        const lineDiscounts = saleItems.map(() => 0);
        if (
          (qaDiscountCase === 1 || qaDiscountCase === 2) &&
          saleItems.length > 0
        ) {
          const firstBruto = saleItems[0].price * saleItems[0].quantity;
          lineDiscounts[0] = Math.max(1, Math.round(firstBruto * 0.1));
        }

        // Invariante POS: Sale.subtotal = Σ(price × qty − SaleItem.discount) (neto de línea)
        const subtotal = saleItems.reduce(
          (acc, it, idx) => acc + it.price * it.quantity - lineDiscounts[idx],
          0,
        );
        const discount =
          qaDiscountCase === 0 || qaDiscountCase === 2
            ? Math.max(1, Math.round(subtotal * 0.05))
            : Math.random() < 0.1
              ? Math.round(subtotal * 0.05)
              : 0;
        const total = subtotal - discount;

        // Determinar sesión a usar: histórica para la mayoría, abierta para ~20%
        const useOpen = Math.random() < 0.2 || historicalSessions.length === 0;
        const session =
          useOpen && openSession
            ? { id: openSession.id, userId: openSession.userId, openedAt: null as Date | null }
            : historicalSessions.length > 0
              ? pickRandom(historicalSessions)
              : openSession
                ? { id: openSession.id, userId: openSession.userId, openedAt: null }
                : null;
        if (!session) continue;

        const saleDate =
          session.openedAt ?? randomDateInLastMonths(6);

        // Determinar métodos de pago
        const payments: Array<{ method: PaymentMethod; amount: number }> = [];
        const roll = Math.random();
        if (roll < 0.4) {
          payments.push({ method: PaymentMethod.CASH, amount: total });
        } else if (roll < 0.6) {
          payments.push({ method: PaymentMethod.CARD, amount: total });
        } else if (roll < 0.75) {
          payments.push({ method: PaymentMethod.TRANSFER, amount: total });
        } else if (roll < 0.85) {
          payments.push({ method: PaymentMethod.ATRATO, amount: total });
        } else {
          // combinado
          const half = Math.round(total / 2);
          payments.push({ method: PaymentMethod.CASH, amount: half });
          payments.push({ method: PaymentMethod.CARD, amount: total - half });
        }

        // Ejecutar la venta en una transacción
        const saleId = await ctx.prisma.$transaction(async (tx) => {
          const folio = await nextSaleFolio(tx, branch.id, "V");

          const sale = await tx.sale.create({
            data: {
              folio,
              branchId: branch.id,
              userId: sellerId,
              customerId,
              status: SaleStatus.COMPLETED,
              subtotal: dec(subtotal),
              discount: dec(discount),
              total: dec(total),
              createdAt: saleDate,
            },
          });

          // Crear SaleItems
          for (let idx = 0; idx < saleItems.length; idx++) {
            const it = saleItems[idx];
            await tx.saleItem.create({
              data: {
                saleId: sale.id,
                productVariantId: it.simpleProductId ? null : it.productVariantId,
                simpleProductId: it.simpleProductId,
                description: it.description,
                quantity: it.quantity,
                price: dec(it.price),
                discount: dec(lineDiscounts[idx]),
              },
            });
          }

          // Decrementar stock + InventoryMovement
          for (const it of saleItems) {
            if (it.simpleProductId) {
              await tx.stock.update({
                where: {
                  simpleProductId_branchId: {
                    simpleProductId: it.simpleProductId,
                    branchId: branch.id,
                  },
                },
                data: { quantity: { decrement: it.quantity } },
              });
              await tx.inventoryMovement.create({
                data: {
                  simpleProductId: it.simpleProductId,
                  branchId: branch.id,
                  userId: sellerId,
                  quantity: -it.quantity,
                  type: MovementType.SALE,
                  referenceId: sale.id,
                },
              });
            } else {
              await tx.stock.update({
                where: {
                  productVariantId_branchId: {
                    productVariantId: it.productVariantId,
                    branchId: branch.id,
                  },
                },
                data: { quantity: { decrement: it.quantity } },
              });
              await tx.inventoryMovement.create({
                data: {
                  productVariantId: it.productVariantId,
                  branchId: branch.id,
                  userId: sellerId,
                  quantity: -it.quantity,
                  type: MovementType.SALE,
                  referenceId: sale.id,
                },
              });
            }
          }

          // Asignar VIN (CustomerBike.customerId)
          if (chosenBikeId) {
            await tx.customerBike.update({
              where: { id: chosenBikeId },
              data: { customerId },
            });
          }

          // CashTransactions
          for (const p of payments) {
            if (p.amount <= 0) continue;
            await tx.cashTransaction.create({
              data: {
                sessionId: session.id,
                saleId: sale.id,
                type: "PAYMENT_IN",
                method: p.method,
                amount: dec(p.amount),
                collectionStatus:
                  p.method === PaymentMethod.ATRATO
                    ? CollectionStatus.PENDING
                    : CollectionStatus.COLLECTED,
                createdAt: saleDate,
              },
            });
          }

          // Comisiones (solo items con productVariant)
          const commissionItems: CommissionTarget[] = saleItems
            .map((it, idx) => ({ it, discount: lineDiscounts[idx] }))
            .filter(
              ({ it }) => !it.simpleProductId && it.productVariantId,
            )
            .map(({ it, discount }) => ({
              productVariantId: it.productVariantId,
              quantity: it.quantity,
              price: it.price,
              discount,
            }));
          await generateCommissionsForSale(
            tx,
            sale.id,
            sellerId,
            branch.id,
            commissionItems,
          );

          return sale.id;
        });

        if (isCancelled) {
          // Cancelar: revertir stock, REFUND_OUT, comisiones CANCELLED
          await ctx.prisma.$transaction(async (tx) => {
            for (const it of saleItems) {
              if (it.simpleProductId) {
                await tx.stock.update({
                  where: {
                    simpleProductId_branchId: {
                      simpleProductId: it.simpleProductId,
                      branchId: branch.id,
                    },
                  },
                  data: { quantity: { increment: it.quantity } },
                });
              } else {
                await tx.stock.update({
                  where: {
                    productVariantId_branchId: {
                      productVariantId: it.productVariantId,
                      branchId: branch.id,
                    },
                  },
                  data: { quantity: { increment: it.quantity } },
                });
              }
            }
            if (openSession) {
              for (const p of payments) {
                if (p.amount <= 0) continue;
                await tx.cashTransaction.create({
                  data: {
                    sessionId: openSession.id,
                    saleId,
                    type: "REFUND_OUT",
                    method: p.method,
                    amount: dec(p.amount),
                    reference: "Devolución por cancelación: seed",
                    collectionStatus: CollectionStatus.COLLECTED,
                  },
                });
              }
            }
            await tx.commissionRecord.updateMany({
              where: { saleId, status: { in: [CommissionStatus.PENDING, CommissionStatus.APPROVED] } },
              data: { status: CommissionStatus.CANCELLED },
            });
            // Revertir VIN
            if (chosenBikeId) {
              await tx.customerBike.update({
                where: { id: chosenBikeId },
                data: { customerId: null },
              });
              availableBikesAll.push({ id: chosenBikeId, productVariantId: saleItems[0].productVariantId });
            }
            await tx.sale.update({
              where: { id: saleId },
              data: {
                status: SaleStatus.CANCELLED,
                internalNote: "Cancelación: seed",
              },
            });
          });
          cancelled++;
        } else {
          completed++;
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`  ❌ Sale ${branch.code} #${i}: ${msg}`);
      }
    }
    console.log(
      `  ✅ Sales en ${branch.code}: ${completed} COMPLETED, ${cancelled} CANCELLED.`,
    );
  }
}

// ─── T8 Pedidos (LAYAWAY + BACKORDER) con abonos ─────────────────────────────

async function seedPedidos(ctx: SeedContext): Promise<void> {
  const branches = [
    { id: ctx.leoBranchId, code: "LEO" },
    { id: ctx.av135BranchId, code: "AV135" },
  ];

  for (const branch of branches) {
    const existing = await ctx.prisma.sale.count({
      where: { branchId: branch.id, orderType: { not: null } },
    });
    if (existing > 0) {
      console.log(`  ⏭️  Pedidos ya existen en ${branch.code} (${existing}), skip.`);
      continue;
    }

    const sellers = await ctx.prisma.user.findMany({
      where: { branchId: branch.id, role: "SELLER", isActive: true },
      select: { id: true },
    });
    const customers = await ctx.prisma.customer.findMany({ select: { id: true } });
    const openSession = await ctx.prisma.cashRegisterSession.findFirst({
      where: { branchId: branch.id, status: "OPEN" },
      select: { id: true },
    });
    if (!openSession || sellers.length === 0 || customers.length === 0) continue;

    const variantsInStock = await ctx.prisma.stock.findMany({
      where: { branchId: branch.id, quantity: { gt: 1 }, productVariantId: { not: null } },
      select: {
        productVariant: {
          select: { id: true, precioPublico: true, modelo: { select: { nombre: true } } },
        },
      },
    });
    if (variantsInStock.length === 0) continue;

    const TARGET = 15;
    let layaway = 0;
    let backorder = 0;

    for (let i = 0; i < TARGET; i++) {
      try {
        const isLayaway = Math.random() < 0.6;
        const orderType = isLayaway ? OrderType.LAYAWAY : OrderType.BACKORDER;
        const stockRow = pickRandom(variantsInStock);
        if (!stockRow.productVariant) continue;
        const variant = stockRow.productVariant;

        const unitPrice = Number(variant.precioPublico);
        const quantity = 1;
        const total = unitPrice * quantity;

        const deposit = Math.round(total * (0.3 + Math.random() * 0.4));
        const sellerId = pickRandom(sellers).id;
        const customerId = pickRandom(customers).id;

        const saleId = await ctx.prisma.$transaction(async (tx) => {
          // Stock decrement solo LAYAWAY
          if (isLayaway) {
            await tx.stock.update({
              where: {
                productVariantId_branchId: {
                  productVariantId: variant.id,
                  branchId: branch.id,
                },
              },
              data: { quantity: { decrement: quantity } },
            });
          }

          const folio = await nextSaleFolio(tx, branch.id, isLayaway ? "A" : "B");
          // Invariante Sale.type (ver schema.prisma): orderType != null →
          // type ∈ {LAYAWAY, BACKORDER} (match orderType).
          const sale = await tx.sale.create({
            data: {
              folio,
              branchId: branch.id,
              userId: sellerId,
              customerId,
              status: SaleStatus.LAYAWAY,
              orderType,
              type: orderType === OrderType.LAYAWAY ? SaleType.LAYAWAY : SaleType.BACKORDER,
              subtotal: dec(total),
              discount: dec(0),
              total: dec(total),
            },
          });
          await tx.saleItem.create({
            data: {
              saleId: sale.id,
              productVariantId: variant.id,
              description: variant.modelo.nombre,
              quantity,
              price: dec(unitPrice),
              discount: dec(0),
            },
          });
          await tx.cashTransaction.create({
            data: {
              sessionId: openSession.id,
              saleId: sale.id,
              type: "PAYMENT_IN",
              method: PaymentMethod.CASH,
              amount: dec(deposit),
              collectionStatus: CollectionStatus.COLLECTED,
            },
          });
          return sale.id;
        });

        // Abonos adicionales (1-3)
        const numExtraPayments = randomBetween(1, 3);
        let totalPaid = deposit;
        for (let p = 0; p < numExtraPayments && totalPaid < total; p++) {
          const pending = total - totalPaid;
          const payAmount = p === numExtraPayments - 1 && Math.random() < 0.5
            ? pending
            : Math.round(pending * (0.3 + Math.random() * 0.5));
          if (payAmount <= 0) break;

          await ctx.prisma.$transaction(async (tx) => {
            await tx.cashTransaction.create({
              data: {
                sessionId: openSession.id,
                saleId,
                type: "PAYMENT_IN",
                method: pickRandom([PaymentMethod.CASH, PaymentMethod.CARD, PaymentMethod.TRANSFER]),
                amount: dec(payAmount),
                collectionStatus: CollectionStatus.COLLECTED,
              },
            });
            if (totalPaid + payAmount >= total) {
              await tx.sale.update({
                where: { id: saleId },
                data: { status: SaleStatus.COMPLETED },
              });
            }
          });
          totalPaid += payAmount;
        }

        if (isLayaway) layaway++;
        else backorder++;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`  ❌ Pedido ${branch.code} #${i}: ${msg}`);
      }
    }
    console.log(
      `  ✅ Pedidos en ${branch.code}: ${layaway} LAYAWAY, ${backorder} BACKORDER.`,
    );
  }
}

// ─── T9 ServiceOrders ────────────────────────────────────────────────────────

async function seedServiceOrders(ctx: SeedContext): Promise<void> {
  const branches = [
    { id: ctx.leoBranchId, code: "LEO" },
    { id: ctx.av135BranchId, code: "AV135" },
  ];

  for (const branch of branches) {
    const existing = await ctx.prisma.serviceOrder.count({ where: { branchId: branch.id } });
    if (existing > 0) {
      console.log(`  ⏭️  ServiceOrders ya existen en ${branch.code} (${existing}), skip.`);
      continue;
    }

    const technicians = await ctx.prisma.user.findMany({
      where: { branchId: branch.id, role: "TECHNICIAN", isActive: true },
      select: { id: true },
    });
    const customers = await ctx.prisma.customer.findMany({ select: { id: true } });
    const openSession = await ctx.prisma.cashRegisterSession.findFirst({
      where: { branchId: branch.id, status: "OPEN" },
      select: { id: true },
    });
    if (technicians.length === 0 || customers.length === 0) continue;

    const customerBikes = await ctx.prisma.customerBike.findMany({
      where: { branchId: branch.id, customerId: { not: null } },
      select: { id: true, customerId: true },
    });

    // ServiceCatalog — crear algunos si no existen
    let serviceCatalogs = await ctx.prisma.serviceCatalog.findMany({
      where: { branchId: branch.id, isActive: true },
      select: { id: true, name: true, basePrice: true },
    });
    if (serviceCatalogs.length === 0) {
      await ctx.prisma.serviceCatalog.createMany({
        data: [
          { name: "Mano de obra general", basePrice: dec(200), branchId: branch.id },
          { name: "Diagnóstico eléctrico", basePrice: dec(350), branchId: branch.id },
          { name: "Ajuste de frenos", basePrice: dec(150), branchId: branch.id },
          { name: "Cambio de llantas", basePrice: dec(250), branchId: branch.id },
          { name: "Revisión de batería", basePrice: dec(300), branchId: branch.id },
        ],
      });
      serviceCatalogs = await ctx.prisma.serviceCatalog.findMany({
        where: { branchId: branch.id, isActive: true },
        select: { id: true, name: true, basePrice: true },
      });
    }

    const simpleProducts = await ctx.prisma.simpleProduct.findMany({
      where: {
        categoria: "REFACCION",
        isActive: true,
        stocks: { some: { branchId: branch.id, quantity: { gt: 1 } } },
      },
      take: 30,
      select: { id: true, nombre: true, precioPublico: true },
    });

    const TARGET = 20;
    const counts = { PENDING: 0, IN_PROGRESS: 0, COMPLETED: 0, DELIVERED: 0 };

    for (let i = 0; i < TARGET; i++) {
      try {
        const r = Math.random();
        const targetStatus: ServiceOrderStatus =
          r < 0.25
            ? ServiceOrderStatus.PENDING
            : r < 0.5
              ? ServiceOrderStatus.IN_PROGRESS
              : r < 0.75
                ? ServiceOrderStatus.COMPLETED
                : ServiceOrderStatus.DELIVERED;

        const techId = pickRandom(technicians).id;
        const customerId = pickRandom(customers).id;
        const useBike = Math.random() < 0.5 && customerBikes.length > 0;
        const bike = useBike ? pickRandom(customerBikes) : null;

        const withItems = targetStatus !== ServiceOrderStatus.PENDING;
        const items: Array<{
          simpleProductId?: string;
          serviceCatalogId?: string;
          description: string;
          quantity: number;
          price: number;
        }> = [];
        if (withItems) {
          if (serviceCatalogs.length > 0) {
            const sc = pickRandom(serviceCatalogs);
            items.push({
              serviceCatalogId: sc.id,
              description: sc.name,
              quantity: 1,
              price: Number(sc.basePrice),
            });
          }
          if (simpleProducts.length > 0 && Math.random() < 0.7) {
            const sp = pickRandom(simpleProducts);
            items.push({
              simpleProductId: sp.id,
              description: sp.nombre,
              quantity: 1,
              price: Number(sp.precioPublico),
            });
          }
        }

        const total = items.reduce((a, it) => a + it.price * it.quantity, 0);

        const orderId = await ctx.prisma.$transaction(async (tx) => {
          const branchRow = await tx.branch.findUniqueOrThrow({
            where: { id: branch.id },
            select: { code: true },
          });
          // Folio de taller: {CODE}-SRV-0001 (incrementamos lastSaleFolioNumber)
          const updated = await tx.branch.update({
            where: { id: branch.id },
            data: { lastSaleFolioNumber: { increment: 1 } },
            select: { lastSaleFolioNumber: true },
          });
          const folio = `${branchRow.code}-SRV-${String(updated.lastSaleFolioNumber).padStart(4, "0")}`;

          const order = await tx.serviceOrder.create({
            data: {
              folio,
              branchId: branch.id,
              userId: techId,
              customerId,
              customerBikeId: bike?.id ?? null,
              bikeInfo: bike ? null : "Bici cliente genérica",
              diagnosis: "Diagnóstico de seed",
              subtotal: dec(total),
              total: dec(total),
              status:
                targetStatus === ServiceOrderStatus.DELIVERED
                  ? ServiceOrderStatus.COMPLETED // lo movemos manualmente abajo
                  : targetStatus,
              // Workshop redesign Sub-fase A: paridad dev con órdenes reales.
              publicToken: generatePublicToken(),
              // Si vamos a DELIVERED, simula el QA pasado para respetar el
              // gate del endpoint real cuando alguien prueba /deliver contra
              // órdenes de seed.
              ...(targetStatus === ServiceOrderStatus.DELIVERED
                ? { qaPassedAt: new Date(), qaPassedByUserId: techId }
                : {}),
            },
          });
          for (const it of items) {
            await tx.serviceOrderItem.create({
              data: {
                serviceOrderId: order.id,
                simpleProductId: it.simpleProductId ?? null,
                serviceCatalogId: it.serviceCatalogId ?? null,
                description: it.description,
                quantity: it.quantity,
                price: dec(it.price),
              },
            });
          }
          return order.id;
        });

        if (
          targetStatus === ServiceOrderStatus.DELIVERED ||
          (targetStatus === ServiceOrderStatus.COMPLETED && Math.random() < 0.5 && openSession)
        ) {
          // Flujo COBRAR + (si DELIVERED) ENTREGAR
          if (!openSession) continue;

          const saleId = await ctx.prisma.$transaction(async (tx) => {
            const folio = await nextSaleFolio(tx, branch.id, "T");
            // Invariante Sale.type (ver schema.prisma): serviceOrderId != null →
            // type=SERVICE. excludeFromRevenue=false porque el fixture simula cobro real.
            const sale = await tx.sale.create({
              data: {
                folio,
                branchId: branch.id,
                userId: techId,
                customerId,
                status: SaleStatus.COMPLETED,
                type: SaleType.SERVICE,
                excludeFromRevenue: false,
                subtotal: dec(total),
                discount: dec(0),
                total: dec(total),
                warrantyDocReady: true,
                serviceOrderId: orderId,
              },
            });
            await tx.cashTransaction.create({
              data: {
                sessionId: openSession.id,
                saleId: sale.id,
                type: "PAYMENT_IN",
                method: PaymentMethod.CASH,
                amount: dec(total),
                collectionStatus: CollectionStatus.COLLECTED,
              },
            });
            await tx.serviceOrder.update({
              where: { id: orderId },
              data: { prepaid: true },
            });
            return sale.id;
          });

          if (targetStatus === ServiceOrderStatus.DELIVERED) {
            await ctx.prisma.$transaction(async (tx) => {
              // Descontar stock de simpleProducts
              const orderItems = await tx.serviceOrderItem.findMany({
                where: { serviceOrderId: orderId, simpleProductId: { not: null } },
                select: { id: true, simpleProductId: true, quantity: true },
              });
              for (const oi of orderItems) {
                if (!oi.simpleProductId) continue;
                await tx.stock.update({
                  where: {
                    simpleProductId_branchId: {
                      simpleProductId: oi.simpleProductId,
                      branchId: branch.id,
                    },
                  },
                  data: { quantity: { decrement: oi.quantity } },
                });
                const mv = await tx.inventoryMovement.create({
                  data: {
                    simpleProductId: oi.simpleProductId,
                    branchId: branch.id,
                    userId: techId,
                    quantity: -oi.quantity,
                    type: MovementType.WORKSHOP_USAGE,
                    referenceId: orderId,
                  },
                });
                await tx.serviceOrderItem.update({
                  where: { id: oi.id },
                  data: { inventoryMovementId: mv.id },
                });
              }
              await tx.serviceOrder.update({
                where: { id: orderId },
                data: { status: ServiceOrderStatus.DELIVERED },
              });
            });
            counts.DELIVERED++;
          } else {
            counts.COMPLETED++;
          }
          void saleId;
        } else {
          counts[targetStatus]++;
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`  ❌ ServiceOrder ${branch.code} #${i}: ${msg}`);
      }
    }
    console.log(
      `  ✅ ServiceOrders ${branch.code}: PENDING=${counts.PENDING}, IN_PROGRESS=${counts.IN_PROGRESS}, COMPLETED=${counts.COMPLETED}, DELIVERED=${counts.DELIVERED}.`,
    );
  }
}

// ─── T9.b Dashboard móvil fixture (P13-G.2) ──────────────────────────────────
// Siembra ~12 órdenes ASIGNADAS a `tecnico.leo@evobike.mx` con distribución
// que cubra los 3 tabs del dashboard móvil ("Mi cola", "Esperando", "Listas").
// Idempotente: chequea si el técnico ya tiene órdenes con assignedTechId
// y skipea para no duplicar en re-seeds.
//
// No genera Sale/prepaid — el móvil no los distingue visualmente y evita
// tocar el invariante `sale_type_invariant`. Si en el futuro el móvil
// pinta "prepagada", extender este bloque puntualmente.

async function seedMobileDashboardFixture(ctx: SeedContext): Promise<void> {
  const tecnicoLeo = await ctx.prisma.user.findUnique({
    where: { email: "tecnico.leo@evobike.mx" },
    select: { id: true, branchId: true },
  });
  if (!tecnicoLeo || !tecnicoLeo.branchId) {
    console.log("  ⏭️  tecnico.leo no existe, skip fixture móvil.");
    return;
  }

  const alreadyAssigned = await ctx.prisma.serviceOrder.count({
    where: { assignedTechId: tecnicoLeo.id, branchId: tecnicoLeo.branchId },
  });
  if (alreadyAssigned > 0) {
    console.log(
      `  ⏭️  tecnico.leo ya tiene ${alreadyAssigned} órdenes asignadas, skip fixture móvil.`,
    );
    return;
  }

  const customers = await ctx.prisma.customer.findMany({
    select: { id: true },
    take: 12,
  });
  if (customers.length === 0) {
    console.log("  ⏭️  Sin customers para fixture móvil, skip.");
    return;
  }

  const customerBikes = await ctx.prisma.customerBike.findMany({
    where: { branchId: tecnicoLeo.branchId, customerId: { not: null } },
    select: { id: true, customerId: true },
  });

  const diagnoses = [
    "Falla intermitente del motor",
    "Frenos traseros con ruido",
    "Batería descarga rápido",
    "Cambios traseros sin ajuste",
    "Llanta delantera desbalanceada",
    "Pantalla no enciende",
    "Controlador con error E03",
    "Manubrio con holgura",
    "Cadena salta en marchas altas",
    "Luz trasera no funciona",
    "Llave de encendido fallando",
    "Asistencia eléctrica inconsistente",
  ];

  // Distribución objetivo (total 12):
  //   2 PENDING                              → tab "Mi cola" (baja)
  //   3 IN_PROGRESS, subStatus=null          → tab "Mi cola" (alta)
  //   2 IN_PROGRESS, subStatus=WAITING_PARTS ┐
  //   1 IN_PROGRESS, subStatus=WAITING_APPR. ├ tab "Esperando"
  //   1 IN_PROGRESS, subStatus=PAUSED        ┘
  //   3 COMPLETED                            → tab "Listas"
  const plan: Array<{
    status: ServiceOrderStatus;
    subStatus: "WAITING_PARTS" | "WAITING_APPROVAL" | "PAUSED" | null;
  }> = [
    { status: ServiceOrderStatus.PENDING, subStatus: null },
    { status: ServiceOrderStatus.PENDING, subStatus: null },
    { status: ServiceOrderStatus.IN_PROGRESS, subStatus: null },
    { status: ServiceOrderStatus.IN_PROGRESS, subStatus: null },
    { status: ServiceOrderStatus.IN_PROGRESS, subStatus: null },
    { status: ServiceOrderStatus.IN_PROGRESS, subStatus: "WAITING_PARTS" },
    { status: ServiceOrderStatus.IN_PROGRESS, subStatus: "WAITING_PARTS" },
    { status: ServiceOrderStatus.IN_PROGRESS, subStatus: "WAITING_APPROVAL" },
    { status: ServiceOrderStatus.IN_PROGRESS, subStatus: "PAUSED" },
    { status: ServiceOrderStatus.COMPLETED, subStatus: null },
    { status: ServiceOrderStatus.COMPLETED, subStatus: null },
    { status: ServiceOrderStatus.COMPLETED, subStatus: null },
  ];

  let created = 0;
  for (let i = 0; i < plan.length; i++) {
    const entry = plan[i];
    const customerId = customers[i % customers.length].id;
    const bike =
      customerBikes.length > 0 ? customerBikes[i % customerBikes.length] : null;
    const diagnosis = diagnoses[i % diagnoses.length];

    try {
      await ctx.prisma.$transaction(async (tx) => {
        const branchRow = await tx.branch.findUniqueOrThrow({
          where: { id: tecnicoLeo.branchId! },
          select: { code: true },
        });
        const updated = await tx.branch.update({
          where: { id: tecnicoLeo.branchId! },
          data: { lastSaleFolioNumber: { increment: 1 } },
          select: { lastSaleFolioNumber: true },
        });
        const folio = `${branchRow.code}-SRV-${String(updated.lastSaleFolioNumber).padStart(4, "0")}`;

        await tx.serviceOrder.create({
          data: {
            folio,
            branchId: tecnicoLeo.branchId!,
            userId: tecnicoLeo.id,
            assignedTechId: tecnicoLeo.id,
            customerId,
            customerBikeId: bike?.id ?? null,
            bikeInfo: bike ? null : "Bici cliente genérica",
            diagnosis,
            subtotal: dec(0),
            total: dec(0),
            status: entry.status,
            subStatus: entry.subStatus,
            publicToken: generatePublicToken(),
          },
        });
      });
      created++;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`  ❌ Fixture móvil #${i}: ${msg}`);
    }
  }

  console.log(
    `  ✅ Fixture móvil tecnico.leo: ${created} órdenes (2 PENDING, 3 IN_PROGRESS, 4 esperando, 3 COMPLETED).`,
  );
}

// ─── T10 Cotizaciones ────────────────────────────────────────────────────────

async function seedQuotations(ctx: SeedContext): Promise<void> {
  const branches = [
    { id: ctx.leoBranchId, code: "LEO" },
    { id: ctx.av135BranchId, code: "AV135" },
  ];

  for (const branch of branches) {
    const existing = await ctx.prisma.quotation.count({ where: { branchId: branch.id } });
    if (existing > 0) {
      console.log(`  ⏭️  Cotizaciones ya existen en ${branch.code} (${existing}), skip.`);
      continue;
    }

    const sellers = await ctx.prisma.user.findMany({
      where: { branchId: branch.id, role: { in: ["SELLER", "MANAGER"] }, isActive: true },
      select: { id: true },
    });
    const customers = await ctx.prisma.customer.findMany({ select: { id: true } });
    if (sellers.length === 0) continue;

    const variants = await ctx.prisma.productVariant.findMany({
      where: { isActive: true, modelo: { nombre: { not: "Batería" } } },
      take: 40,
      select: {
        id: true,
        precioPublico: true,
        modelo: { select: { nombre: true } },
      },
    });
    if (variants.length === 0) continue;

    const TARGET = 10;
    let counts = { DRAFT: 0, EN_ESPERA_CLIENTE: 0, EN_ESPERA_FABRICA: 0, PAGADA: 0, FINALIZADA: 0, RECHAZADA: 0, EXPIRED: 0 };

    for (let i = 0; i < TARGET; i++) {
      try {
        const r = Math.random();
        let status: QuotationStatus;
        let isExpired = false;
        if (r < 0.3) status = QuotationStatus.DRAFT;
        else if (r < 0.5) status = QuotationStatus.EN_ESPERA_CLIENTE;
        else if (r < 0.65) status = QuotationStatus.EN_ESPERA_FABRICA;
        else if (r < 0.75) status = QuotationStatus.PAGADA;
        else if (r < 0.9) status = QuotationStatus.FINALIZADA;
        else if (r < 0.95) status = QuotationStatus.RECHAZADA;
        else {
          status = QuotationStatus.EN_ESPERA_CLIENTE;
          isExpired = true;
        }

        const validUntil = isExpired
          ? new Date(Date.now() - 10 * 24 * 60 * 60 * 1000)
          : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

        const numItems = randomBetween(1, 3);
        const items: Array<{
          productVariantId: string;
          description: string;
          quantity: number;
          unitPrice: number;
        }> = [];
        for (let j = 0; j < numItems; j++) {
          const v = pickRandom(variants);
          items.push({
            productVariantId: v.id,
            description: v.modelo.nombre,
            quantity: 1,
            unitPrice: Number(v.precioPublico),
          });
        }
        const subtotal = items.reduce((a, it) => a + it.unitPrice * it.quantity, 0);

        await ctx.prisma.$transaction(async (tx) => {
          const folio = await nextQuotationFolio(tx, branch.id);
          const userId = pickRandom(sellers).id;
          const quotation = await tx.quotation.create({
            data: {
              folio,
              branchId: branch.id,
              userId,
              customerId: customers.length > 0 ? pickRandom(customers).id : null,
              status,
              validUntil,
              subtotal: dec(subtotal),
              discountAmount: dec(0),
              total: dec(subtotal),
              convertedAt: status === QuotationStatus.FINALIZADA ? new Date() : null,
              convertedByUserId: status === QuotationStatus.FINALIZADA ? userId : null,
              convertedInBranchId: status === QuotationStatus.FINALIZADA ? branch.id : null,
            },
          });
          for (const it of items) {
            await tx.quotationItem.create({
              data: {
                quotationId: quotation.id,
                productVariantId: it.productVariantId,
                description: it.description,
                quantity: it.quantity,
                unitPrice: dec(it.unitPrice),
                lineTotal: dec(it.unitPrice * it.quantity),
              },
            });
          }
        });

        if (isExpired) counts.EXPIRED++;
        else counts[status as keyof typeof counts]++;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`  ❌ Cotización ${branch.code} #${i}: ${msg}`);
      }
    }
    console.log(
      `  ✅ Cotizaciones ${branch.code}: DRAFT=${counts.DRAFT}, EN_ESPERA_CLIENTE=${counts.EN_ESPERA_CLIENTE}, EN_ESPERA_FABRICA=${counts.EN_ESPERA_FABRICA}, PAGADA=${counts.PAGADA}, FINALIZADA=${counts.FINALIZADA}, RECHAZADA=${counts.RECHAZADA}, EXPIRED=${counts.EXPIRED}.`,
    );
  }
}

// ─── T11 Purchase Receipts (Fase P4-A) ────────────────────────────────────────
// Cabecera histórica sintética por sucursal que agrupa TODAS las recepciones
// previas a P4 (vehículos, baterías, SimpleProducts). Luego 4 recepciones
// realistas adicionales por sucursal cubriendo los 3 estados de pago.

const HISTORIC_PROVIDER = "Histórico previo a P4";

async function seedPurchaseReceipts(ctx: SeedContext): Promise<void> {
  const branches = [
    { id: ctx.leoBranchId, code: "LEO" },
    { id: ctx.av135BranchId, code: "AV135" },
  ];

  for (const branch of branches) {
    const existing = await ctx.prisma.purchaseReceipt.findFirst({
      where: { branchId: branch.id, proveedor: HISTORIC_PROVIDER },
      select: { id: true },
    });
    if (existing) {
      console.log(`  ⏭️  PurchaseReceipts ${branch.code} ya sembrados, skip.`);
      continue;
    }

    // 1) Cabecera histórica agrupando todo lo previo.
    const historic = await ctx.prisma.purchaseReceipt.create({
      data: {
        branchId: branch.id,
        userId: ctx.adminUserId,
        proveedor: HISTORIC_PROVIDER,
        folioFacturaProveedor: null,
        formaPagoProveedor: FormaPagoProveedor.CONTADO,
        estadoPago: EstadoPagoProveedor.PAGADA,
        fechaPago: new Date(),
        totalPagado: dec(0),
        notas: "Recepciones registradas antes de la Fase P4 (vehículos, baterías y accesorios).",
      },
    });

    // 2) Backfill de InventoryMovement + BatteryLot sin cabecera.
    const [movUpdate, lotUpdate] = await Promise.all([
      ctx.prisma.inventoryMovement.updateMany({
        where: {
          branchId: branch.id,
          type: MovementType.PURCHASE_RECEIPT,
          purchaseReceiptId: null,
        },
        data: { purchaseReceiptId: historic.id },
      }),
      ctx.prisma.batteryLot.updateMany({
        where: { branchId: branch.id, purchaseReceiptId: null },
        data: { purchaseReceiptId: historic.id },
      }),
    ]);

    // 3) Recalcular totalPagado desde las líneas vinculadas, usando costo
    //    (ProductVariant) o costoInterno (SimpleProduct) como valor unitario.
    const linkedMovs = await ctx.prisma.inventoryMovement.findMany({
      where: { purchaseReceiptId: historic.id },
      select: {
        quantity: true,
        productVariant: { select: { costo: true } },
        simpleProduct: { select: { costoInterno: true } },
      },
    });
    let total = new Prisma.Decimal(0);
    for (const m of linkedMovs) {
      const unit = m.productVariant?.costo ?? m.simpleProduct?.costoInterno ?? null;
      if (!unit) continue;
      total = total.plus(unit.mul(m.quantity));
    }
    await ctx.prisma.purchaseReceipt.update({
      where: { id: historic.id },
      data: { totalPagado: total },
    });

    console.log(
      `  ✅ Histórico ${branch.code}: ${movUpdate.count} movimientos + ${lotUpdate.count} lotes vinculados, total $${total.toFixed(2)}.`,
    );

    // 4) Cuatro recepciones realistas adicionales.
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    const isLeo = branch.code === "LEO";

    type SyntheticReceipt = Omit<Prisma.PurchaseReceiptUncheckedCreateInput, "branchId" | "userId">;
    const sinteticas: SyntheticReceipt[] = [
      // PAGADA · CONTADO
      {
        proveedor: "Distribuidora Evo MX",
        folioFacturaProveedor: `FAC-2026-0${isLeo ? "123" : "456"}`,
        formaPagoProveedor: FormaPagoProveedor.CONTADO,
        estadoPago: EstadoPagoProveedor.PAGADA,
        fechaPago: new Date(now - 15 * day),
        totalPagado: dec(isLeo ? 48200 : 52750),
        notas: "Compra contado: lote de accesorios y refacciones.",
      },
      // PAGADA · TRANSFERENCIA
      {
        proveedor: "Baterías Power Plus",
        folioFacturaProveedor: `FAC-2026-0${isLeo ? "201" : "318"}`,
        formaPagoProveedor: FormaPagoProveedor.TRANSFERENCIA,
        estadoPago: EstadoPagoProveedor.PAGADA,
        fechaPago: new Date(now - 8 * day),
        totalPagado: dec(isLeo ? 95400 : 118600),
        notas: "Pago por transferencia — lote de baterías 60V/72V.",
      },
      // PENDIENTE · CONTADO
      {
        proveedor: "Accesorios del Sureste",
        folioFacturaProveedor: `FAC-2026-0${isLeo ? "277" : "402"}`,
        formaPagoProveedor: FormaPagoProveedor.CONTADO,
        estadoPago: EstadoPagoProveedor.PENDIENTE,
        fechaPago: null,
        totalPagado: dec(isLeo ? 14250 : 18900),
        notas: "Mercancía recibida; pago pendiente de ejecutar en caja.",
      },
      // CREDITO — LEO vencida; AV135 próxima a vencer.
      {
        proveedor: "Importaciones Orión SA",
        folioFacturaProveedor: `FAC-2026-0${isLeo ? "089" : "511"}`,
        formaPagoProveedor: FormaPagoProveedor.CREDITO,
        estadoPago: EstadoPagoProveedor.CREDITO,
        fechaVencimiento: toYMD(new Date(now + (isLeo ? -5 : 7) * day)),
        fechaPago: null,
        totalPagado: dec(isLeo ? 176800 : 142350),
        notas: isLeo
          ? "Crédito vencido — requiere gestión con el proveedor."
          : "Crédito a 7 días — vencimiento próximo.",
      },
    ];

    let createdExtras = 0;
    for (const r of sinteticas) {
      try {
        await ctx.prisma.purchaseReceipt.create({
          data: {
            ...r,
            branchId: branch.id,
            userId: ctx.adminUserId,
          },
        });
        createdExtras++;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`  ❌ PurchaseReceipt ${branch.code}/${r.proveedor}: ${msg}`);
      }
    }
    console.log(`  ✅ PurchaseReceipts realistas ${branch.code}: ${createdExtras} creados.`);
  }
}

// ─── T13 Suppliers (Pack D.bis C.3) ───────────────────────────────────────────
//
// Crea Supplier rows para los nombres reales del seed (linkados via UPDATE
// WHERE proveedor=name SET supplierId) + sintéticos extras sin link
// (CFE/Telmex/etc) para que UI tenga variedad de autocomplete/testing.
//
// Idempotente: skip si ya hay Supplier con nombre "Distribuidora Evo MX".

async function seedSuppliers(ctx: SeedContext): Promise<void> {
  const sentinel = await ctx.prisma.supplier.findFirst({
    where: { nombre: "Distribuidora Evo MX" },
    select: { id: true },
  });
  if (sentinel) {
    console.log("  ⏭️  Suppliers ya sembrados, skip.");
    return;
  }

  type SupplierSeed = {
    nombre: string;
    rfc?: string;
    contacto?: string;
    telefono?: string;
    email?: string;
    direccion?: string;
    notas?: string;
    /** Si presente, se hace UPDATE en PurchaseReceipt + BatteryLot vinculando supplierId. */
    matchProveedorString?: string;
  };

  // Suppliers reales (linkados con strings legacy ya seedados arriba)
  const linked: SupplierSeed[] = [
    {
      nombre: "Distribuidora Evo MX",
      rfc: "DEM240115ABC",
      contacto: "Andrés Robles",
      telefono: "9985551101",
      email: "ventas@distribuidoraevomx.com",
      direccion: "Av. Industria 123, Cancún",
      matchProveedorString: "Distribuidora Evo MX",
    },
    {
      nombre: "Baterías Power Plus",
      rfc: "BPP180623XYZ",
      contacto: "Mariana Solís",
      telefono: "9985552202",
      email: "pedidos@bateriaspowerplus.mx",
      matchProveedorString: "Baterías Power Plus",
    },
    {
      nombre: "Accesorios del Sureste",
      rfc: "ASU200410QRT",
      contacto: "Roberto Mora",
      telefono: "9985553303",
      email: "facturacion@accesoriossureste.com",
      notas: "Crédito en gestión — pago pendiente.",
      matchProveedorString: "Accesorios del Sureste",
    },
    {
      nombre: "Importaciones Orión SA",
      rfc: "IOR150820HJK",
      contacto: "Sofía Vargas",
      telefono: "5512347890",
      email: "cuentas@importacionesorion.mx",
      direccion: "Insurgentes Sur 1500, CDMX",
      notas: "Crédito 30 días estándar.",
      matchProveedorString: "Importaciones Orión SA",
    },
    {
      nombre: "Proveedor Semilla SA",
      rfc: "PSE100101AAA",
      contacto: "Luis Pérez",
      telefono: "9985554404",
      notas: "Proveedor histórico de baterías.",
      matchProveedorString: "Proveedor Semilla SA",
    },
    {
      nombre: "Histórico previo a P4",
      notas: "Cabecera agregadora de movimientos previos a Fase P4. NO usar para nuevas recepciones.",
      matchProveedorString: "Histórico previo a P4",
    },
  ];

  // Suppliers sintéticos NO linkados — categorías típicas que aparecen en
  // CashTransaction (servicios, marketing, banca, etc.). Cliente confirma luego
  // si los mantiene.
  const unlinked: SupplierSeed[] = [
    { nombre: "CFE — Comisión Federal de Electricidad", rfc: "CFE370814QI0", notas: "Servicio eléctrico." },
    { nombre: "Telmex", rfc: "TME840315KT6", notas: "Telefonía e internet." },
    { nombre: "Aguakan", notas: "Servicio agua potable." },
    { nombre: "Telcel", rfc: "CFE370814S40", notas: "Líneas móviles equipo." },
    { nombre: "Facebook Ads", notas: "Marketing digital." },
  ];

  let created = 0;
  let linkedReceipts = 0;
  let linkedLots = 0;

  for (const s of [...linked, ...unlinked]) {
    const supplier = await ctx.prisma.supplier.create({
      data: {
        nombre: s.nombre,
        rfc: s.rfc ?? null,
        contacto: s.contacto ?? null,
        telefono: s.telefono ?? null,
        email: s.email ?? null,
        direccion: s.direccion ?? null,
        notas: s.notas ?? null,
      },
    });
    created++;

    if (s.matchProveedorString) {
      const [r1, r2] = await Promise.all([
        ctx.prisma.purchaseReceipt.updateMany({
          where: { proveedor: s.matchProveedorString, supplierId: null },
          data: { supplierId: supplier.id },
        }),
        ctx.prisma.batteryLot.updateMany({
          where: { supplier: s.matchProveedorString, supplierId: null },
          data: { supplierId: supplier.id },
        }),
      ]);
      linkedReceipts += r1.count;
      linkedLots += r2.count;
    }
  }

  console.log(
    `  ✅ Suppliers: ${created} creados (${linkedReceipts} PurchaseReceipts + ${linkedLots} BatteryLots vinculados).`,
  );
}

// ─── T14 Warranty Policies ───────────────────────────────────────────────────

const WARRANTY_DAYS_BY_CATEGORY: Partial<Record<ModeloCategoria, number>> = {
  BASE: 365,
  PLUS: 365,
  CARGA: 365,
  CARGA_PESADA: 365,
  TRICICLO: 365,
  SCOOTER: 180,
  JUGUETE: 90,
};

const WARRANTY_TERMS_SEED =
  "Esta póliza ampara al comprador contra defectos de fabricación en el motor eléctrico, " +
  "controlador, batería de litio y cuadro estructural, sujeto a uso normal y mantenimiento " +
  "según manual. No cubre: daños por agua, modificaciones, accidentes, desgaste natural de " +
  "frenos/llantas/vestidura. Para hacer válida la garantía, presentar esta póliza en cualquier " +
  "sucursal Evobike con la unidad y número de serie legible.";

async function seedWarrantyPolicies(ctx: SeedContext): Promise<void> {
  const existing = await ctx.prisma.warrantyPolicy.count();
  if (existing > 0) {
    console.log(`  ⏭️  WarrantyPolicies: ya existen ${existing}, skip.`);
    return;
  }

  // Step 1: backfill warrantyDays on modelos that have a category mapped above
  const modelos = await ctx.prisma.modelo.findMany({
    where: { requiere_vin: true, categoria: { not: null } },
    select: { id: true, categoria: true, warrantyDays: true },
  });

  let backfilled = 0;
  for (const m of modelos) {
    if (m.warrantyDays !== null) continue;
    const days = m.categoria ? WARRANTY_DAYS_BY_CATEGORY[m.categoria] : undefined;
    if (!days) continue;
    await ctx.prisma.modelo.update({
      where: { id: m.id },
      data: { warrantyDays: days },
    });
    backfilled++;
  }

  // Step 2: find assembled bikes (customerId=null) with warranty-eligible modelos
  // and create deterministic sale+policy fixtures for them
  const availableBikes = await ctx.prisma.customerBike.findMany({
    where: {
      customerId: null,
      productVariant: { modelo: { warrantyDays: { not: null }, categoria: { not: null } } },
    },
    select: {
      id: true,
      branchId: true,
      productVariantId: true,
      productVariant: {
        select: {
          id: true,
          precioPublico: true,
          modelo: { select: { id: true, nombre: true, categoria: true, warrantyDays: true } },
        },
      },
    },
    take: 8,
  });

  const customers = await ctx.prisma.customer.findMany({
    take: 8,
    select: { id: true },
  });
  if (customers.length === 0 || availableBikes.length === 0) {
    console.log("  ⏭️  WarrantyPolicies: no hay bikes/customers disponibles, skip.");
    return;
  }

  // Age distribution: 2 expired (old sales), 1 about to expire (within 30d), rest active
  const AGE_OFFSETS_DAYS = [400, 380, 350, 200, 90, 30, 10, 5];

  let created = 0;
  for (let i = 0; i < availableBikes.length; i++) {
    const bike = availableBikes[i];
    const pv = bike.productVariant;
    if (!pv?.modelo.warrantyDays || !pv.modelo.categoria) continue;

    const customer = customers[i % customers.length];
    const ageDays = AGE_OFFSETS_DAYS[i % AGE_OFFSETS_DAYS.length];
    const saleDate = new Date(Date.now() - ageDays * 86_400_000);
    const warrantyDays = pv.modelo.warrantyDays;
    const startedAt = saleDate;
    const expiresAt = new Date(startedAt.getTime() + warrantyDays * 86_400_000);
    const now = new Date();
    const status = expiresAt < now
      ? WarrantyPolicyStatus.EXPIRED
      : WarrantyPolicyStatus.ACTIVE;

    const session = await ctx.prisma.cashRegisterSession.findFirst({
      where: { branchId: bike.branchId },
      select: { id: true },
    });

    await ctx.prisma.$transaction(async (tx) => {
      const folio = await nextSaleFolio(tx, bike.branchId, "V");
      const sale = await tx.sale.create({
        data: {
          folio,
          branchId: bike.branchId,
          userId: ctx.adminUserId,
          customerId: customer.id,
          status: SaleStatus.COMPLETED,
          subtotal: pv.precioPublico,
          discount: dec(0),
          total: pv.precioPublico,
          createdAt: saleDate,
        },
      });
      const saleItem = await tx.saleItem.create({
        data: {
          saleId: sale.id,
          productVariantId: pv.id,
          description: pv.modelo.nombre,
          quantity: 1,
          price: pv.precioPublico,
          discount: dec(0),
        },
      });
      await tx.customerBike.update({
        where: { id: bike.id },
        data: { customerId: customer.id },
      });
      if (session) {
        await tx.cashTransaction.create({
          data: {
            sessionId: session.id,
            saleId: sale.id,
            type: "PAYMENT_IN",
            method: PaymentMethod.CASH,
            amount: pv.precioPublico,
            collectionStatus: CollectionStatus.COLLECTED,
            createdAt: saleDate,
          },
        });
      }
      await tx.warrantyPolicy.create({
        data: {
          saleId: sale.id,
          saleItemId: saleItem.id,
          customerBikeId: bike.id,
          modeloId: pv.modelo.id,
          modeloCategoria: pv.modelo.categoria!,
          warrantyDaysSnapshot: warrantyDays,
          startedAt,
          expiresAt,
          termsSnapshot: WARRANTY_TERMS_SEED,
          status,
          alertSentAt120: status === WarrantyPolicyStatus.EXPIRED
            ? new Date("1970-01-01") : null,
          alertSentAt173: status === WarrantyPolicyStatus.EXPIRED
            ? new Date("1970-01-01") : null,
        },
      });
    });
    created++;
  }

  console.log(
    `  ✅ WarrantyPolicies: ${backfilled} modelos con warrantyDays, ${created} pólizas creadas.`,
  );
}
