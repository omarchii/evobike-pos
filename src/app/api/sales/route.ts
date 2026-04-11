import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

interface SessionUser {
  id: string;
  branchId: string;
}

const paymentMethodSchema = z.object({
  method: z.enum(["CASH", "CARD", "TRANSFER", "CREDIT_BALANCE", "ATRATO"]),
  amount: z.number().nonnegative(),
  reference: z.string().optional(),
});

const saleItemSchema = z.object({
  productVariantId: z.string().min(1),
  quantity: z.number().int().positive(),
  price: z.number().nonnegative(),
  name: z.string(),
  isSerialized: z.boolean().optional(),
  serialNumber: z.string().optional(),
  customerBikeId: z.string().optional(),  // 4-C: select existing assembled bike
  voltageChange: z.object({ targetVoltajeId: z.string() }).optional(),  // 4-D: pre-sale voltage change
  batterySerials: z.array(z.string()).optional(),
  assemblyMode: z.boolean().optional(),
});

// Frozen items from quotation conversion (nullable productVariantId for free-form lines)
const frozenItemSchema = z.object({
  productVariantId: z.string().nullable().optional(),
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
  // Optional quotation conversion fields (additive — does not affect existing callers)
  quotationId: z.string().optional(),
  frozenItems: z.array(frozenItemSchema).optional(),
});

// POST /api/sales — procesar una venta o apartado
export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
  }

  const { id: userId, branchId } = session.user as unknown as SessionUser;

  if (!branchId) {
    return NextResponse.json({ success: false, error: "Usuario sin sucursal asignada" }, { status: 400 });
  }

  const body: unknown = await req.json();
  const parsed = saleSchema.safeParse(body);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? "Datos inválidos";
    return NextResponse.json({ success: false, error: firstError }, { status: 400 });
  }

  const input = parsed.data;

  try {
    const activeSession = await prisma.cashRegisterSession.findFirst({
      where: { userId, branchId, status: "OPEN" },
    });
    if (!activeSession) {
      return NextResponse.json(
        { success: false, error: "Debes abrir caja antes de poder realizar ventas." },
        { status: 400 }
      );
    }

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

        // Stock check + decrement for catalog items only (skip isFreeForm)
        for (const item of input.frozenItems) {
          if (item.isFreeForm || !item.productVariantId) continue;
          const stock = await tx.stock.findUnique({
            where: { productVariantId_branchId: { productVariantId: item.productVariantId, branchId } },
          });
          if (!stock || stock.quantity < item.quantity) {
            throw new Error(`Stock insuficiente para: ${item.description}`);
          }
          await tx.stock.update({
            where: { id: stock.id },
            data: { quantity: { decrement: item.quantity } },
          });
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
                description: item.description,
                isFreeForm: item.isFreeForm,
                quantity: item.quantity,
                price: item.unitPrice,
                discount: 0,
              })),
            },
          },
        });

        // Inventory movements (skip free-form items)
        for (const item of input.frozenItems) {
          if (item.isFreeForm || !item.productVariantId) continue;
          await tx.inventoryMovement.create({
            data: {
              productVariantId: item.productVariantId,
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
              saleId: frozenSale.id,
              type: "PAYMENT_IN",
              method: pm.method,
              amount: pm.amount,
              reference: pm.reference,
              collectionStatus: pm.method === "ATRATO" ? "PENDING" : "COLLECTED",
            },
          });
        }

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

      // A. Verify and decrease stock
      for (const item of input.items) {
        if (item.assemblyMode) continue;

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
              productVariantId: item.productVariantId,
              quantity: item.quantity,
              price: item.price,
            })),
          },
        },
      });

      // D. Inventory movements (skip assembly-mode items)
      for (const item of input.items) {
        if (item.assemblyMode) continue;
        await tx.inventoryMovement.create({
          data: {
            productVariantId: item.productVariantId,
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
            saleId: sale.id,
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

      return sale;
    });

    return NextResponse.json({ success: true, data: { saleId: result.id, folio: result.folio } });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error al procesar la venta";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
