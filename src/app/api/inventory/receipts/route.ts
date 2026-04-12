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

const lineSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("variant"),
    productVariantId: z.string().min(1),
    quantity: z.number().int().positive(),
    precioUnitarioPagado: z.number().positive(),
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
    fechaVencimiento: z.coerce.date().optional(),
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
  let assembleableMap = new Map<string, boolean>();
  if (variantIds.length > 0) {
    const variantInfo = await prisma.productVariant.findMany({
      where: { id: { in: variantIds } },
      select: {
        id: true,
        modelo_id: true,
        voltaje_id: true,
        modelo: { select: { requiere_vin: true } },
      },
    });

    if (variantInfo.length !== variantIds.length) {
      return NextResponse.json(
        { success: false, error: "Uno o más productos variantes no existen" },
        { status: 422 },
      );
    }

    const vinRequired = variantInfo.filter((v) => v.modelo.requiere_vin);
    if (vinRequired.length > 0) {
      const configs = await prisma.batteryConfiguration.findMany({
        where: {
          OR: vinRequired.map((v) => ({ modeloId: v.modelo_id, voltajeId: v.voltaje_id })),
        },
        select: { modeloId: true, voltajeId: true },
      });
      const keys = new Set(configs.map((c) => `${c.modeloId}:${c.voltajeId}`));
      for (const v of vinRequired) {
        assembleableMap.set(v.id, keys.has(`${v.modelo_id}:${v.voltaje_id}`));
      }
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
            const ordersData = Array.from({ length: item.quantity }, () => ({
              productVariantId: item.productVariantId,
              branchId,
              status: "PENDING" as const,
              receiptReference: receipt.id,
            }));
            await tx.assemblyOrder.createMany({ data: ordersData });
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
