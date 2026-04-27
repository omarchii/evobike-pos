import type { BranchedSessionUser } from "@/lib/auth-types";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import {
  consumeAuthorization,
  AuthorizationConsumeError,
} from "@/lib/authorizations";
import { requireActiveUser, UserInactiveError } from "@/lib/auth-helpers";
import {
  getActiveSession,
  assertSessionFreshOrThrow,
  OrphanedCashSessionError,
} from "@/lib/cash-register";

const paymentMethodSchema = z.object({
  method: z.enum(["CASH", "CARD", "TRANSFER", "CREDIT_BALANCE", "ATRATO"]),
  amount: z.number().nonnegative(),
  reference: z.string().optional(),
});

const saleItemSchema = z.object({
  productVariantId: z.string().nullable().optional(),
  simpleProductId: z.string().nullable().optional(),
  quantity: z.number().int().positive(),
  price: z.number().nonnegative(),
  name: z.string(),
  isSerialized: z.boolean().optional(),
  serialNumber: z.string().optional(),
  customerBikeId: z.string().optional(),  // 4-C: select existing assembled bike
  voltageChange: z.object({ targetVoltajeId: z.string() }).optional(),  // 4-D: pre-sale voltage change
  batterySerials: z.array(z.string()).optional(),
  assemblyMode: z.boolean().optional(),
  isFreeForm: z.boolean().optional(),
}).superRefine((v, ctx) => {
  // Exactamente uno de: productVariantId | simpleProductId | isFreeForm
  const kinds = [v.productVariantId ? 1 : 0, v.simpleProductId ? 1 : 0, v.isFreeForm ? 1 : 0].reduce((a, b) => a + b, 0);
  if (kinds !== 1) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Cada línea debe ser productVariantId, simpleProductId o isFreeForm (exactamente uno)" });
  }
});

// Frozen items from quotation conversion (nullable productVariantId for free-form lines)
const frozenItemSchema = z.object({
  productVariantId: z.string().nullable().optional(),
  simpleProductId: z.string().nullable().optional(),
  description: z.string(),
  isFreeForm: z.boolean().default(false),
  quantity: z.number().int().positive(),
  unitPrice: z.number().nonnegative(),
});

const saleSchema = z.object({
  items: z.array(saleItemSchema).min(1, "El carrito está vacío"),
  total: z.number().nonnegative(),
  discount: z.number().nonnegative().optional(),
  paymentMethods: z.array(paymentMethodSchema),
  isLayaway: z.boolean().optional(),
  customerId: z.string().optional(),
  downPayment: z.number().nonnegative().optional(),
  internalNote: z.string().optional(),
  discountAmount: z.number().nonnegative().optional(),
  discountAuthorizedByUserId: z.string().optional(),
  discountAuthorizedByName: z.string().optional(),
  // P5-C: ID de la AuthorizationRequest(DESCUENTO) APPROVED. Requerido para SELLER si discountAmount > 0.
  discountAuthorizationId: z.string().optional(),
  // Optional quotation conversion fields (additive — does not affect existing callers)
  quotationId: z.string().optional(),
  frozenItems: z.array(frozenItemSchema).optional(),
});

// ── Commission generation ───────────────────────────────────────────────────

interface SaleItemForCommission {
  productVariantId: string | null;
  isFreeForm?: boolean;
  quantity: number;
  price: number | { toNumber(): number };
  discount?: number | { toNumber(): number };
}

type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

async function generateCommissions(
  tx: TxClient,
  saleId: string,
  userId: string,
  branchId: string,
  items: SaleItemForCommission[],
): Promise<void> {
  const user = await tx.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (!user) return;

  for (const item of items) {
    // Comisiones solo por venta de vehículo (ProductVariant). SimpleProduct y free-form no comisionan.
    if (item.isFreeForm || !item.productVariantId) continue;

    const variant = await tx.productVariant.findUnique({
      where: { id: item.productVariantId },
      select: { modelo_id: true },
    });
    if (!variant) continue;

    // Match rule: specific modelo first, then generic (modeloId = null)
    const rule = await tx.commissionRule.findFirst({
      where: {
        branchId,
        role: user.role,
        isActive: true,
        OR: [
          { modeloId: variant.modelo_id },
          { modeloId: null },
        ],
      },
      orderBy: { modeloId: "desc" }, // not-null (specific) sorts before null (generic)
    });
    if (!rule) continue;

    const price = typeof item.price === "number" ? item.price : item.price.toNumber();
    const discount = item.discount
      ? typeof item.discount === "number" ? item.discount : item.discount.toNumber()
      : 0;
    const lineTotal = price * item.quantity - discount;

    const amount =
      rule.commissionType === "PERCENTAGE"
        ? lineTotal * (Number(rule.value) / 100)
        : Number(rule.value);

    if (amount <= 0) continue;

    await tx.commissionRecord.create({
      data: {
        saleId,
        userId,
        ruleId: rule.id,
        amount,
        status: "PENDING",
      },
    });
  }
}

// POST /api/sales — procesar una venta o apartado
export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
  }

  const { id: userId, branchId, role: userRole } = session.user as unknown as BranchedSessionUser;

  if (!branchId) {
    return NextResponse.json({ success: false, error: "Usuario sin sucursal asignada" }, { status: 400 });
  }

  const body: unknown = await req.json();
  const parsed = saleSchema.safeParse(body);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? "Datos inválidos";
    return NextResponse.json({ success: false, error: firstError }, { status: 400 });
  }

  // P5-C: SELLER no puede aplicar descuento sin autorización consumible.
  // MANAGER/ADMIN pueden autoaprobarse (el role es la autorización).
  if (
    parsed.data.discountAmount &&
    parsed.data.discountAmount > 0 &&
    !parsed.data.discountAuthorizationId &&
    userRole !== "MANAGER" &&
    userRole !== "ADMIN"
  ) {
    return NextResponse.json(
      { success: false, error: "Los descuentos requieren autorización de un gerente" },
      { status: 403 },
    );
  }

  const input = parsed.data;

  try {
    await requireActiveUser(session);

    const activeSession = await getActiveSession(branchId);
    if (!activeSession) {
      return NextResponse.json(
        { success: false, error: "Debes abrir caja antes de poder realizar ventas." },
        { status: 409 }
      );
    }
    assertSessionFreshOrThrow(activeSession);

    if (input.isLayaway) {
      if (!input.customerId) {
        return NextResponse.json(
          { success: false, error: "Un apartado requiere asignar un cliente" },
          { status: 400 }
        );
      }
      if (input.downPayment === undefined || input.downPayment < 0) {
        return NextResponse.json(
          { success: false, error: "Monto de abono inicial no válido" },
          { status: 400 }
        );
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      // ── QUOTATION CONVERSION PATH ──────────────────────────────────────────
      // When frozenItems is present, we use those items (from quotation) instead
      // of the normal POS items. This path is additive; the existing path below
      // is untouched and runs when frozenItems is absent.
      if (input.frozenItems && input.frozenItems.length > 0) {
        // Credit balance check (same as normal path)
        const creditPayment = input.paymentMethods.find((p) => p.method === "CREDIT_BALANCE");
        if (creditPayment) {
          if (!input.customerId) throw new Error("Se requiere un cliente para pagar con Saldo a Favor");
          const customer = await tx.customer.findUnique({ where: { id: input.customerId } });
          if (!customer || Number(customer.balance) < creditPayment.amount) {
            throw new Error(`Saldo insuficiente. El cliente tiene $${customer?.balance ?? 0} a favor.`);
          }
          await tx.customer.update({
            where: { id: input.customerId },
            data: { balance: { decrement: creditPayment.amount } },
          });
        }

        // Stock check + decrement for catalog items only (skip isFreeForm) — polimórfico
        for (const item of input.frozenItems) {
          if (item.isFreeForm) continue;
          if (item.productVariantId) {
            const stock = await tx.stock.findUnique({
              where: { productVariantId_branchId: { productVariantId: item.productVariantId, branchId } },
            });
            if (!stock || stock.quantity < item.quantity) {
              throw new Error(`Stock insuficiente para: ${item.description}`);
            }
            await tx.stock.update({ where: { id: stock.id }, data: { quantity: { decrement: item.quantity } } });
          } else if (item.simpleProductId) {
            const stock = await tx.stock.findUnique({
              where: { simpleProductId_branchId: { simpleProductId: item.simpleProductId, branchId } },
            });
            if (!stock || stock.quantity < item.quantity) {
              throw new Error(`Stock insuficiente para: ${item.description}`);
            }
            await tx.stock.update({ where: { id: stock.id }, data: { quantity: { decrement: item.quantity } } });
          }
        }

        // Build note
        let frozenNote = input.internalNote ?? "";
        if (input.discountAmount && input.discountAmount > 0 && input.discountAuthorizedByName) {
          const discountLine = `\nDescuento $${input.discountAmount.toFixed(2)} autorizado por ${input.discountAuthorizedByName}`;
          frozenNote = frozenNote ? `${frozenNote}${discountLine}` : discountLine.trimStart();
        }

        // Folio
        const subTotalFrozen = input.total - (input.discount ?? 0);
        const updatedBranchFrozen = await tx.branch.update({
          where: { id: branchId },
          data: { lastSaleFolioNumber: { increment: 1 } },
          select: { lastSaleFolioNumber: true, name: true },
        });
        const branchPrefixFrozen = updatedBranchFrozen.name
          .replace(/[^a-zA-Z0-9]/g, "")
          .substring(0, 3)
          .toUpperCase();
        const frozenFolio = `${branchPrefixFrozen}V-${String(updatedBranchFrozen.lastSaleFolioNumber).padStart(4, "0")}`;

        const frozenSale = await tx.sale.create({
          data: {
            folio: frozenFolio,
            branchId,
            userId,
            customerId: input.customerId ?? null,
            status: "COMPLETED",
            subtotal: subTotalFrozen,
            discount: input.discount ?? 0,
            total: input.total,
            internalNote: frozenNote || null,
            quotationId: input.quotationId ?? null,
            items: {
              create: input.frozenItems.map((item) => ({
                productVariantId: item.productVariantId ?? null,
                simpleProductId: item.simpleProductId ?? null,
                description: item.description,
                isFreeForm: item.isFreeForm,
                quantity: item.quantity,
                price: item.unitPrice,
                discount: 0,
              })),
            },
          },
        });

        // P5-C: consumir autorización de descuento si aplica (frozen path)
        if (input.discountAuthorizationId && input.discountAmount && input.discountAmount > 0) {
          await consumeAuthorization(tx, {
            tipo: "DESCUENTO",
            authorizationId: input.discountAuthorizationId,
            requestedBy: userId,
            saleId: frozenSale.id,
            monto: input.discountAmount,
          });
        }

        // Inventory movements (skip free-form items) — polimórfico
        for (const item of input.frozenItems) {
          if (item.isFreeForm) continue;
          if (!item.productVariantId && !item.simpleProductId) continue;
          await tx.inventoryMovement.create({
            data: {
              productVariantId: item.productVariantId ?? null,
              simpleProductId: item.simpleProductId ?? null,
              branchId,
              userId,
              type: "SALE",
              quantity: -item.quantity,
              referenceId: frozenSale.id,
            },
          });
        }

        // Cash transactions
        for (const pm of input.paymentMethods) {
          if (pm.amount <= 0) continue;
          await tx.cashTransaction.create({
            data: {
              sessionId: activeSession.id,
              userId,
              saleId: frozenSale.id,
              customerId: input.customerId ?? null,
              type: "PAYMENT_IN",
              method: pm.method,
              amount: pm.amount,
              reference: pm.reference,
              collectionStatus: pm.method === "ATRATO" ? "PENDING" : "COLLECTED",
            },
          });
        }

        // G. Commission generation (frozen path)
        await generateCommissions(tx, frozenSale.id, userId, branchId,
          input.frozenItems.map((fi) => ({
            productVariantId: fi.productVariantId ?? null,
            isFreeForm: fi.isFreeForm,
            quantity: fi.quantity,
            price: fi.unitPrice,
            discount: 0,
          })),
        );

        return frozenSale;
      }

      // ── NORMAL POS PATH (unchanged) ────────────────────────────────────────

      // CREDIT_BALANCE pre-flight check
      const creditPayment = input.paymentMethods.find((p) => p.method === "CREDIT_BALANCE");
      if (creditPayment) {
        if (!input.customerId) throw new Error("Se requiere un cliente para pagar con Saldo a Favor");
        const customer = await tx.customer.findUnique({ where: { id: input.customerId } });
        if (!customer || Number(customer.balance) < creditPayment.amount) {
          throw new Error(
            `Saldo insuficiente. El cliente tiene $${customer?.balance ?? 0} a favor.`
          );
        }
        await tx.customer.update({
          where: { id: input.customerId },
          data: { balance: { decrement: creditPayment.amount } },
        });
      }

      // Pre-flight: collect voltage change data (need sale.id, processed after sale creation)
      type VcPreFlight = {
        customerBikeId: string;
        targetVoltajeId: string;
        fromVoltage: string;
        bikeProductVariantId: string | null;
      };
      const vcPreFlights: VcPreFlight[] = [];

      // A. Verify and decrease stock (polimórfico: variant | simple)
      for (const item of input.items) {
        if (item.assemblyMode) continue;
        if (item.isFreeForm) continue;

        if (item.simpleProductId) {
          const stock = await tx.stock.findUnique({
            where: { simpleProductId_branchId: { simpleProductId: item.simpleProductId, branchId } },
          });
          if (!stock || stock.quantity < item.quantity) {
            throw new Error(`Stock insuficiente para: ${item.name}`);
          }
          await tx.stock.update({ where: { id: stock.id }, data: { quantity: { decrement: item.quantity } } });
          continue;
        }

        if (!item.productVariantId) continue;

        const stock = await tx.stock.findUnique({
          where: {
            productVariantId_branchId: { productVariantId: item.productVariantId, branchId },
          },
        });

        if (!stock || stock.quantity < item.quantity) {
          throw new Error(`Stock insuficiente para: ${item.name}`);
        }
        await tx.stock.update({
          where: { id: stock.id },
          data: { quantity: { decrement: item.quantity } },
        });

        // VIN assignment — 4-C: link existing assembled CustomerBike to customer
        if (item.customerBikeId) {
          if (!input.customerId) {
            throw new Error(`Esta unidad requiere asignar un cliente`);
          }
          const bike = await tx.customerBike.findUnique({
            where: { id: item.customerBikeId },
          });
          if (!bike) {
            throw new Error(`Unidad no encontrada: ${item.customerBikeId}`);
          }
          if (bike.customerId !== null) {
            throw new Error(`Esta unidad ya tiene un propietario registrado`);
          }
          if (bike.branchId !== branchId) {
            throw new Error(`Esta unidad no pertenece a esta sucursal`);
          }
          await tx.customerBike.update({
            where: { id: item.customerBikeId },
            data: { customerId: input.customerId },
          });
          // 4-D: collect voltage change pre-flight data
          if (item.voltageChange) {
            vcPreFlights.push({
              customerBikeId: item.customerBikeId,
              targetVoltajeId: item.voltageChange.targetVoltajeId,
              fromVoltage: bike.voltaje ?? "",
              bikeProductVariantId: bike.productVariantId,
            });
          }
        } else if (item.isSerialized && item.serialNumber) {
          // Legacy path: manually typed VIN (backward compat)
          if (!input.customerId) {
            throw new Error(`${item.name} requiere un número de serie — debes seleccionar un cliente.`);
          }
          const existingBike = await tx.customerBike.findFirst({
            where: { serialNumber: item.serialNumber, branchId },
          });
          if (existingBike) {
            throw new Error(`Número de serie ya registrado: ${item.serialNumber}`);
          }
          const variant = await tx.productVariant.findUnique({
            where: { id: item.productVariantId },
            include: { voltaje: true },
          });
          await tx.customerBike.create({
            data: {
              customerId: input.customerId,
              branchId,
              serialNumber: item.serialNumber,
              brand: "EVOBIKE",
              model: item.name,
              voltaje: variant?.voltaje.label ?? null,
              notes: "Venta original",
            },
          });
        }
      }

      // B. Build internal note
      let finalNote = input.internalNote ?? "";
      if (input.discountAmount && input.discountAmount > 0 && input.discountAuthorizedByName) {
        const discountLine = `\nDescuento $${input.discountAmount.toFixed(2)} autorizado por ${input.discountAuthorizedByName}`;
        finalNote = finalNote ? `${finalNote}${discountLine}` : discountLine.trimStart();
      }

      // C. Generate sequential folio
      const subTotalCalc = (input.total - (input.discount ?? 0)) / 1.16;
      const updatedBranch = await tx.branch.update({
        where: { id: branchId },
        data: { lastSaleFolioNumber: { increment: 1 } },
        select: { lastSaleFolioNumber: true, name: true },
      });
      const branchPrefix = updatedBranch.name
        .replace(/[^a-zA-Z0-9]/g, "")
        .substring(0, 3)
        .toUpperCase();
      const saleType = input.isLayaway ? "A" : "V";
      const folio = `${branchPrefix}${saleType}-${String(updatedBranch.lastSaleFolioNumber).padStart(4, "0")}`;

      const sale = await tx.sale.create({
        data: {
          folio,
          branchId,
          userId,
          customerId: input.customerId ?? null,
          status: input.isLayaway ? "LAYAWAY" : "COMPLETED",
          subtotal: subTotalCalc,
          discount: input.discount ?? 0,
          total: input.total,
          internalNote: finalNote || null,
          items: {
            create: input.items.map((item) => ({
              productVariantId: item.productVariantId ?? null,
              simpleProductId: item.simpleProductId ?? null,
              description: item.isFreeForm ? item.name : item.simpleProductId ? item.name : null,
              isFreeForm: !!item.isFreeForm,
              quantity: item.quantity,
              price: item.price,
            })),
          },
        },
      });

      // P5-C: consumir autorización de descuento si aplica (path normal)
      if (input.discountAuthorizationId && input.discountAmount && input.discountAmount > 0) {
        await consumeAuthorization(tx, {
          tipo: "DESCUENTO",
          authorizationId: input.discountAuthorizationId,
          requestedBy: userId,
          saleId: sale.id,
          monto: input.discountAmount,
        });
      }

      // D. Inventory movements (skip assembly-mode and free-form items) — polimórfico
      for (const item of input.items) {
        if (item.assemblyMode) continue;
        if (item.isFreeForm) continue;
        if (!item.productVariantId && !item.simpleProductId) continue;
        await tx.inventoryMovement.create({
          data: {
            productVariantId: item.productVariantId ?? null,
            simpleProductId: item.simpleProductId ?? null,
            branchId,
            userId,
            type: "SALE",
            quantity: -item.quantity,
            referenceId: sale.id,
          },
        });
      }

      // E. Cash transactions (one per payment method)
      const paymentTotal = input.isLayaway ? (input.downPayment ?? 0) : input.total;
      const paymentsToRegister =
        paymentTotal > 0 && input.paymentMethods.length > 0 ? input.paymentMethods : [];

      for (const pm of paymentsToRegister) {
        if (pm.amount <= 0) continue;
        await tx.cashTransaction.create({
          data: {
            sessionId: activeSession.id,
            userId,
            saleId: sale.id,
            customerId: input.customerId ?? null,
            type: "PAYMENT_IN",
            method: pm.method,
            amount: pm.amount,
            reference: pm.reference,
            collectionStatus: pm.method === "ATRATO" ? "PENDING" : "COLLECTED",
          },
        });
      }

      // H. Voltage changes (4-D) — post-sale, needs sale.id
      for (const vc of vcPreFlights) {
        const targetVoltaje = await tx.voltaje.findUnique({
          where: { id: vc.targetVoltajeId },
          select: { id: true, label: true },
        });
        if (!targetVoltaje) throw new Error(`Voltaje no encontrado: ${vc.targetVoltajeId}`);

        // Create VoltageChangeLog
        const changeLog = await tx.voltageChangeLog.create({
          data: {
            customerBikeId: vc.customerBikeId,
            fromVoltage: vc.fromVoltage,
            toVoltage: targetVoltaje.label,
            reason: "PRE_SALE",
            saleId: sale.id,
            userId,
          },
        });

        // Update CustomerBike.voltaje
        await tx.customerBike.update({
          where: { id: vc.customerBikeId },
          data: { voltaje: targetVoltaje.label },
        });

        // Uninstall current batteries (return to stock)
        const currentAssignments = await tx.batteryAssignment.findMany({
          where: { customerBikeId: vc.customerBikeId, isCurrent: true },
          select: { id: true, batteryId: true },
        });
        if (currentAssignments.length > 0) {
          await tx.batteryAssignment.updateMany({
            where: { id: { in: currentAssignments.map((a) => a.id) } },
            data: { isCurrent: false, unassignedAt: new Date(), unassignedByUserId: userId },
          });
          await tx.battery.updateMany({
            where: { id: { in: currentAssignments.map((a) => a.batteryId) } },
            data: { status: "IN_STOCK" },
          });
        }

        // Find target productVariant for reensamble (same model, target voltage)
        let targetProductVariantId: string | null = null;
        if (vc.bikeProductVariantId) {
          const currentVariant = await tx.productVariant.findUnique({
            where: { id: vc.bikeProductVariantId },
            select: { modelo_id: true },
          });
          if (currentVariant) {
            const targetVariant = await tx.productVariant.findFirst({
              where: {
                modelo_id: currentVariant.modelo_id,
                voltaje_id: vc.targetVoltajeId,
              },
              select: { id: true },
            });
            targetProductVariantId = targetVariant?.id ?? null;
          }
        }

        // Create AssemblyOrder (reensamble) PENDING
        await tx.assemblyOrder.create({
          data: {
            customerBikeId: vc.customerBikeId,
            productVariantId: targetProductVariantId,
            branchId,
            saleId: sale.id,
            voltageChangeLogId: changeLog.id,
            notes: `Reensamble por cambio de voltaje — venta ${sale.folio}`,
          },
        });
      }

      if (vcPreFlights.length > 0) {
        await tx.sale.update({
          where: { id: sale.id },
          data: { warrantyDocReady: false },
        });
      }

      // F. Battery assignments
      for (const item of input.items) {
        if (!item.batterySerials || item.batterySerials.length === 0) continue;
        if (!input.customerId) continue;

        const customerBike = item.serialNumber
          ? await tx.customerBike.findFirst({
              where: { serialNumber: item.serialNumber, branchId },
            })
          : null;

        if (!customerBike) continue;

        for (const batterySerial of item.batterySerials) {
          const battery = await tx.battery.findFirst({
            where: { serialNumber: batterySerial, branchId, status: "IN_STOCK" },
          });
          if (!battery) continue;

          await tx.batteryAssignment.create({
            data: {
              batteryId: battery.id,
              customerBikeId: customerBike.id,
              isCurrent: true,
              assignedByUserId: userId,
            },
          });

          await tx.battery.update({
            where: { id: battery.id },
            data: { status: "INSTALLED" },
          });
        }
      }

      // I. Commission generation (normal POS path)
      if (!input.isLayaway) {
        await generateCommissions(tx, sale.id, userId, branchId,
          input.items.map((it) => ({
            productVariantId: it.productVariantId ?? null,
            isFreeForm: it.isFreeForm,
            quantity: it.quantity,
            price: it.price,
            discount: 0,
          })),
        );
      }

      return sale;
    });

    return NextResponse.json({ success: true, data: { saleId: result.id, folio: result.folio } });
  } catch (error: unknown) {
    if (error instanceof UserInactiveError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 401 });
    }
    if (error instanceof OrphanedCashSessionError) {
      return NextResponse.json(
        {
          success: false,
          error: "La caja del día anterior debe cerrarse antes de registrar nuevas operaciones.",
        },
        { status: 409 },
      );
    }
    if (error instanceof AuthorizationConsumeError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
    console.error("[api/sales POST]", error);
    const message = error instanceof Error ? error.message : "Error al procesar la venta";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
