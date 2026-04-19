import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

interface SessionUser {
  id: string;
  role: string;
  branchId: string;
}

const FORMA_PAGO = ["CONTADO", "CREDITO", "TRANSFERENCIA"] as const;
const ESTADO_PAGO = ["PAGADA", "PENDIENTE", "CREDITO"] as const;

const assemblyUnitSchema = z.object({
  batteryConfigurationId: z.string().min(1),
  coupled: z.boolean(),
  batterySerials: z.array(z.string().trim().min(1)).default([]),
});

const lineSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("variant"),
    productVariantId: z.string().min(1),
    quantity: z.number().int().positive(),
    precioUnitarioPagado: z.number().positive(),
    assemblyPlan: z.array(assemblyUnitSchema).optional(),
  }),
  z.object({
    kind: z.literal("simple"),
    simpleProductId: z.string().min(1),
    quantity: z.number().int().positive(),
    precioUnitarioPagado: z.number().positive(),
  }),
]);

const receiptSchema = z
  .object({
    proveedor: z.string().min(1, "Proveedor requerido"),
    folioFacturaProveedor: z.string().trim().min(1).optional(),
    formaPagoProveedor: z.enum(FORMA_PAGO),
    estadoPago: z.enum(ESTADO_PAGO),
    fechaVencimiento: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Formato inválido (YYYY-MM-DD)")
      .optional(),
    notas: z.string().trim().min(1).optional(),
    items: z.array(lineSchema).min(1, "No hay productos en esta recepción"),
  })
  .superRefine((data, ctx) => {
    if (data.formaPagoProveedor === "CREDITO" && !data.fechaVencimiento) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["fechaVencimiento"],
        message: "Fecha de vencimiento requerida para pagos a crédito",
      });
    }
    if (data.formaPagoProveedor === "CONTADO" && data.estadoPago === "CREDITO") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["estadoPago"],
        message: "Pago de contado no puede tener estado CRÉDITO",
      });
    }
    if (data.estadoPago === "PAGADA" && data.fechaVencimiento) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["fechaVencimiento"],
        message: "Una recepción PAGADA no debe tener fecha de vencimiento",
      });
    }
  });

const ESTADO_PAGO_VALUES: readonly string[] = ESTADO_PAGO;

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
  }
  const { role, branchId } = session.user as unknown as SessionUser;

  if (role !== "ADMIN" && role !== "MANAGER") {
    return NextResponse.json(
      { success: false, error: "Solo MANAGER o ADMIN pueden consultar compras al proveedor" },
      { status: 403 },
    );
  }

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "20")));
  const skip = (page - 1) * limit;

  const estadoParam = searchParams.get("estadoPago");
  const vencDesdeParam = searchParams.get("vencimientoDesde");
  const vencHastaParam = searchParams.get("vencimientoHasta");
  const branchParam = searchParams.get("branchId");

  const where: Prisma.PurchaseReceiptWhereInput = {};
  // ADMIN puede filtrar por cualquier sucursal; el resto queda fijado a la suya.
  where.branchId = role === "ADMIN" ? (branchParam ?? undefined) : branchId;

  if (estadoParam && ESTADO_PAGO_VALUES.includes(estadoParam)) {
    where.estadoPago = estadoParam as (typeof ESTADO_PAGO)[number];
  }
  if (vencDesdeParam || vencHastaParam) {
    where.fechaVencimiento = {
      ...(vencDesdeParam ? { gte: vencDesdeParam } : {}),
      ...(vencHastaParam ? { lte: vencHastaParam } : {}),
    };
  }

  try {
    const [rows, total] = await Promise.all([
      prisma.purchaseReceipt.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        select: {
          id: true,
          proveedor: true,
          folioFacturaProveedor: true,
          facturaUrl: true,
          formaPagoProveedor: true,
          estadoPago: true,
          fechaVencimiento: true,
          fechaPago: true,
          totalPagado: true,
          createdAt: true,
          branch: { select: { id: true, name: true } },
          user: { select: { name: true } },
          _count: { select: { inventoryMovements: true, batteryLots: true } },
        },
      }),
      prisma.purchaseReceipt.count({ where }),
    ]);

    const data = rows.map((r) => ({
      id: r.id,
      proveedor: r.proveedor,
      folioFacturaProveedor: r.folioFacturaProveedor,
      facturaUrl: r.facturaUrl,
      formaPagoProveedor: r.formaPagoProveedor,
      estadoPago: r.estadoPago,
      fechaVencimiento: r.fechaVencimiento,
      fechaPago: r.fechaPago?.toISOString() ?? null,
      totalPagado: r.totalPagado.toString(),
      createdAt: r.createdAt.toISOString(),
      branch: r.branch,
      registeredBy: r.user.name,
      totalLineas: r._count.inventoryMovements,
      totalLotes: r._count.batteryLots,
    }));

    return NextResponse.json({
      success: true,
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error al listar recepciones";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
  }
  const { id: userId, role, branchId } = session.user as unknown as SessionUser;

  if (role !== "ADMIN" && role !== "MANAGER") {
    return NextResponse.json(
      { success: false, error: "Solo MANAGER o ADMIN pueden registrar compras al proveedor" },
      { status: 403 },
    );
  }
  if (!branchId) {
    return NextResponse.json(
      { success: false, error: "Usuario sin sucursal asignada" },
      { status: 400 },
    );
  }

  const body: unknown = await req.json();
  const parsed = receiptSchema.safeParse(body);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? "Datos inválidos";
    return NextResponse.json({ success: false, error: firstError }, { status: 422 });
  }
  const data = parsed.data;

  // Detectar duplicados de id dentro del mismo payload (variant repetido o simple repetido).
  const variantIds = data.items
    .filter((it): it is Extract<typeof it, { kind: "variant" }> => it.kind === "variant")
    .map((it) => it.productVariantId);
  const simpleIds = data.items
    .filter((it): it is Extract<typeof it, { kind: "simple" }> => it.kind === "simple")
    .map((it) => it.simpleProductId);

  if (new Set(variantIds).size !== variantIds.length || new Set(simpleIds).size !== simpleIds.length) {
    return NextResponse.json(
      { success: false, error: "No repitas el mismo producto en varias líneas; consolídalo en una" },
      { status: 422 },
    );
  }

  // Pre-cargar info de variantes para clasificar ensamblables (fuera de tx).
  interface ConfigOption {
    id: string;
    batteryVariantId: string;
    quantity: number;
  }
  const assembleableMap = new Map<string, boolean>();
  const variantConfigsMap = new Map<string, ConfigOption[]>();
  if (variantIds.length > 0) {
    const variantInfo = await prisma.productVariant.findMany({
      where: { id: { in: variantIds } },
      select: {
        id: true,
        modelo_id: true,
        voltaje_id: true,
        modelo: { select: { esBateria: true } },
      },
    });

    if (variantInfo.length !== variantIds.length) {
      return NextResponse.json(
        { success: false, error: "Uno o más productos variantes no existen" },
        { status: 422 },
      );
    }

    const vehicleVariants = variantInfo.filter((v) => !v.modelo.esBateria);
    if (vehicleVariants.length > 0) {
      const configs = await prisma.batteryConfiguration.findMany({
        where: {
          OR: vehicleVariants.map((v) => ({
            modeloId: v.modelo_id,
            voltajeId: v.voltaje_id,
          })),
        },
        select: {
          id: true,
          modeloId: true,
          voltajeId: true,
          batteryVariantId: true,
          quantity: true,
        },
      });
      const byKey = new Map<string, ConfigOption[]>();
      for (const c of configs) {
        const k = `${c.modeloId}:${c.voltajeId}`;
        const arr = byKey.get(k) ?? [];
        arr.push({
          id: c.id,
          batteryVariantId: c.batteryVariantId,
          quantity: c.quantity,
        });
        byKey.set(k, arr);
      }
      for (const v of vehicleVariants) {
        const opts = byKey.get(`${v.modelo_id}:${v.voltaje_id}`) ?? [];
        assembleableMap.set(v.id, opts.length > 0);
        variantConfigsMap.set(v.id, opts);
      }
    }
  }

  // Validar assemblyPlan y recolectar seriales para chequeo de unicidad global.
  const allSerials: string[] = [];
  interface PlannedUnit {
    configId: string;
    batteryVariantId: string;
    serials: string[] | null; // null => llega después
  }
  const plannedByVariant = new Map<string, PlannedUnit[]>();

  for (const item of data.items) {
    if (item.kind !== "variant") continue;
    const configs = variantConfigsMap.get(item.productVariantId) ?? [];
    const plan = item.assemblyPlan;
    if (configs.length === 0) {
      if (plan && plan.length > 0) {
        return NextResponse.json(
          { success: false, error: "Este producto no acepta configuración de batería" },
          { status: 422 },
        );
      }
      continue;
    }
    if (!plan) continue; // no se envió plan: ruta legacy (se crean AssemblyOrders sin config)

    if (plan.length !== item.quantity) {
      return NextResponse.json(
        { success: false, error: "El plan de ensamble no coincide con la cantidad recibida" },
        { status: 422 },
      );
    }

    const units: PlannedUnit[] = [];
    for (let i = 0; i < plan.length; i++) {
      const unit = plan[i]!;
      const cfg = configs.find((c) => c.id === unit.batteryConfigurationId);
      if (!cfg) {
        return NextResponse.json(
          { success: false, error: `Configuración inválida en unidad ${i + 1}` },
          { status: 422 },
        );
      }
      if (unit.coupled) {
        const normalized = unit.batterySerials
          .map((s) => s.trim())
          .filter((s) => s.length > 0);
        if (normalized.length !== cfg.quantity) {
          return NextResponse.json(
            {
              success: false,
              error: `Unidad ${i + 1}: se requieren ${cfg.quantity} serial(es) para esta configuración`,
            },
            { status: 422 },
          );
        }
        allSerials.push(...normalized);
        units.push({
          configId: cfg.id,
          batteryVariantId: cfg.batteryVariantId,
          serials: normalized,
        });
      } else {
        units.push({
          configId: cfg.id,
          batteryVariantId: cfg.batteryVariantId,
          serials: null,
        });
      }
    }
    plannedByVariant.set(item.productVariantId, units);
  }

  // Seriales únicos dentro del payload
  if (allSerials.length > 0) {
    const seen = new Set<string>();
    const dupes: string[] = [];
    for (const s of allSerials) {
      if (seen.has(s)) dupes.push(s);
      seen.add(s);
    }
    if (dupes.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Seriales duplicados en el payload: ${dupes.slice(0, 5).join(", ")}`,
        },
        { status: 422 },
      );
    }

    // Seriales únicos globalmente (DB)
    const existing = await prisma.battery.findMany({
      where: { serialNumber: { in: Array.from(seen) } },
      select: { serialNumber: true },
    });
    if (existing.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Seriales ya registrados: ${existing.slice(0, 5).map((b) => b.serialNumber).join(", ")}`,
        },
        { status: 409 },
      );
    }
  }

  if (simpleIds.length > 0) {
    const simpleCount = await prisma.simpleProduct.count({
      where: { id: { in: simpleIds } },
    });
    if (simpleCount !== simpleIds.length) {
      return NextResponse.json(
        { success: false, error: "Uno o más productos simples no existen" },
        { status: 422 },
      );
    }
  }

  // totalPagado server-side; ignorar lo que mande el cliente.
  const totalPagado = data.items.reduce(
    (acc, it) => acc + it.precioUnitarioPagado * it.quantity,
    0,
  );

  try {
    const result = await prisma.$transaction(async (tx) => {
      const receipt = await tx.purchaseReceipt.create({
        data: {
          branchId,
          userId,
          proveedor: data.proveedor,
          folioFacturaProveedor: data.folioFacturaProveedor ?? null,
          formaPagoProveedor: data.formaPagoProveedor,
          estadoPago: data.estadoPago,
          fechaVencimiento: data.fechaVencimiento ?? null,
          fechaPago: data.estadoPago === "PAGADA" ? new Date() : null,
          totalPagado: new Prisma.Decimal(totalPagado.toFixed(2)),
          notas: data.notas ?? null,
        },
        select: { id: true, totalPagado: true },
      });

      for (const item of data.items) {
        if (item.kind === "variant") {
          await tx.stock.upsert({
            where: {
              productVariantId_branchId: {
                productVariantId: item.productVariantId,
                branchId,
              },
            },
            update: { quantity: { increment: item.quantity } },
            create: {
              productVariantId: item.productVariantId,
              branchId,
              quantity: item.quantity,
            },
          });

          await tx.inventoryMovement.create({
            data: {
              productVariantId: item.productVariantId,
              branchId,
              userId,
              quantity: item.quantity,
              type: "PURCHASE_RECEIPT",
              referenceId: receipt.id,
              purchaseReceiptId: receipt.id,
              precioUnitarioPagado: new Prisma.Decimal(item.precioUnitarioPagado.toFixed(2)),
            },
          });

          if (assembleableMap.get(item.productVariantId) === true) {
            const plannedUnits = plannedByVariant.get(item.productVariantId);
            for (let u = 0; u < item.quantity; u++) {
              const unit = plannedUnits?.[u];
              const order = await tx.assemblyOrder.create({
                data: {
                  productVariantId: item.productVariantId,
                  branchId,
                  status: "PENDING",
                  receiptReference: receipt.id,
                  batteryConfigurationId: unit?.configId ?? null,
                },
                select: { id: true },
              });

              if (unit?.serials && unit.serials.length > 0) {
                const lot = await tx.batteryLot.create({
                  data: {
                    productVariantId: unit.batteryVariantId,
                    branchId,
                    userId,
                    supplier: data.proveedor,
                    reference: data.folioFacturaProveedor ?? null,
                    purchaseReceiptId: receipt.id,
                  },
                  select: { id: true },
                });

                await tx.battery.createMany({
                  data: unit.serials.map((serialNumber) => ({
                    serialNumber,
                    lotId: lot.id,
                    branchId,
                    status: "IN_STOCK" as const,
                    assemblyOrderId: order.id,
                  })),
                });

                await tx.stock.upsert({
                  where: {
                    productVariantId_branchId: {
                      productVariantId: unit.batteryVariantId,
                      branchId,
                    },
                  },
                  update: { quantity: { increment: unit.serials.length } },
                  create: {
                    productVariantId: unit.batteryVariantId,
                    branchId,
                    quantity: unit.serials.length,
                  },
                });

                await tx.inventoryMovement.create({
                  data: {
                    productVariantId: unit.batteryVariantId,
                    branchId,
                    userId,
                    quantity: unit.serials.length,
                    type: "PURCHASE_RECEIPT",
                    referenceId: receipt.id,
                    purchaseReceiptId: receipt.id,
                  },
                });
              }
            }
          }
        } else {
          await tx.stock.upsert({
            where: {
              simpleProductId_branchId: {
                simpleProductId: item.simpleProductId,
                branchId,
              },
            },
            update: { quantity: { increment: item.quantity } },
            create: {
              simpleProductId: item.simpleProductId,
              branchId,
              quantity: item.quantity,
            },
          });

          await tx.inventoryMovement.create({
            data: {
              simpleProductId: item.simpleProductId,
              branchId,
              userId,
              quantity: item.quantity,
              type: "PURCHASE_RECEIPT",
              referenceId: receipt.id,
              purchaseReceiptId: receipt.id,
              precioUnitarioPagado: new Prisma.Decimal(item.precioUnitarioPagado.toFixed(2)),
            },
          });
        }
      }

      return receipt;
    });

    return NextResponse.json(
      {
        success: true,
        data: { id: result.id, totalPagado: result.totalPagado.toString() },
      },
      { status: 201 },
    );
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        {
          success: false,
          error: `Ya existe una recepción con folio "${data.folioFacturaProveedor ?? ""}" del proveedor "${data.proveedor}" en esta sucursal`,
        },
        { status: 409 },
      );
    }
    const message = error instanceof Error ? error.message : "No se pudo registrar la mercancía";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
