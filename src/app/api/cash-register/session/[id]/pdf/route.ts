import React from "react";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import {
  assertBranchConfiguredForPDF,
  BranchNotConfiguredError,
} from "@/lib/branch";
import { resolveSealBuffer } from "@/lib/pdf/components/document-footer";
import { CortePDF } from "@/lib/pdf/templates/corte-pdf";
import type { CortePDFData, CorteDenominacion } from "@/lib/pdf/templates/corte-pdf";

interface SessionUser {
  id: string;
  branchId: string;
  role: string;
  name?: string;
}

function formatDateTime(date: Date): string {
  return date.toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  // 1. Auth — solo MANAGER y ADMIN pueden imprimir comprobantes de corte
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { role, branchId: sessionBranchId } =
    session.user as unknown as SessionUser;

  if (role === "SELLER" || role === "TECHNICIAN") {
    return NextResponse.json(
      { error: "Sin permisos para imprimir comprobantes de corte" },
      { status: 403 },
    );
  }

  const { id } = await params;

  // 2. Cargar sesión con relaciones
  const cashSession = await prisma.cashRegisterSession.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true } },
      authorizedBy: { select: { id: true, name: true } },
      branch: true,
      transactions: true,
      closeAuthorization: {
        include: {
          approver: { select: { name: true } },
        },
      },
    },
  });

  if (!cashSession) {
    return NextResponse.json({ error: "Sesión no encontrada" }, { status: 404 });
  }

  // MANAGER solo puede ver sesiones de su sucursal
  if (role === "MANAGER" && cashSession.branchId !== sessionBranchId) {
    return NextResponse.json(
      { error: "Sin acceso a esta sesión" },
      { status: 403 },
    );
  }

  // 3. Validar que la sesión esté cerrada
  if (!cashSession.closedAt) {
    return NextResponse.json(
      { error: "La sesión de caja aún está abierta" },
      { status: 409 },
    );
  }

  // 4. Validar configuración de sucursal
  let branch;
  try {
    branch = await assertBranchConfiguredForPDF(cashSession.branchId, "ticket");
  } catch (err) {
    if (err instanceof BranchNotConfiguredError) {
      return NextResponse.json(
        { error: err.message, missingFields: err.missingFields },
        { status: 412 },
      );
    }
    throw err;
  }

  // 5. Calcular resumen financiero desde transacciones
  let ventasEfectivo = 0;
  let entradasEfectivo = 0;
  let gastosEfectivo = 0;
  let retirosEfectivo = 0;
  let reembolsosEfectivo = 0;

  for (const tx of cashSession.transactions) {
    const amt = Number(tx.amount);
    if (tx.type === "PAYMENT_IN" && tx.method === "CASH" && tx.collectionStatus === "COLLECTED") {
      ventasEfectivo += amt;
    } else if (tx.type === "CASH_DEPOSIT") {
      entradasEfectivo += amt;
    } else if (tx.type === "EXPENSE_OUT" && tx.method === "CASH") {
      gastosEfectivo += amt;
    } else if (tx.type === "WITHDRAWAL") {
      retirosEfectivo += amt;
    } else if (tx.type === "REFUND_OUT" && tx.method === "CASH") {
      reembolsosEfectivo += amt;
    }
  }

  const saldoInicial = Number(cashSession.openingAmt);
  const efectivoContado = Number(cashSession.closingAmt);
  const diferencia = Number(cashSession.diferencia);
  // Recalcular desde transacciones (misma fórmula canónica que el endpoint de cierre)
  const efectivoEsperado =
    saldoInicial +
    ventasEfectivo +
    entradasEfectivo -
    gastosEfectivo -
    retirosEfectivo -
    reembolsosEfectivo;

  // 6. Parsear denominationsJson
  let denominaciones: CorteDenominacion[] | null = null;
  if (cashSession.denominationsJson !== null) {
    const raw = cashSession.denominationsJson as Record<string, number>;
    denominaciones = Object.entries(raw)
      .map(([key, cantidad]) => {
        const denominacion = parseInt(key, 10);
        return { denominacion, cantidad, subtotal: denominacion * cantidad };
      })
      .filter((d) => d.cantidad > 0)
      .sort((a, b) => b.denominacion - a.denominacion);
  }

  // 7. Autorización de diferencia
  let autorizacion: { autorizadoPor: string; motivo: string } | null = null;
  if (cashSession.closeAuthorization !== null) {
    const auth = cashSession.closeAuthorization;
    const aprobadoPor =
      auth.approver?.name ?? cashSession.authorizedBy?.name ?? "—";
    const motivo = auth.motivo ?? "Sin motivo registrado";
    autorizacion = { autorizadoPor: aprobadoPor, motivo };
  } else if (cashSession.authorizedById !== null && cashSession.authorizedBy !== null) {
    // Auto-autorización (MANAGER/ADMIN que cerró con diferencia sin AuthorizationRequest)
    autorizacion = {
      autorizadoPor: cashSession.authorizedBy.name ?? "—",
      motivo: "Autorización directa",
    };
  }

  // 8. Resolver sello
  const sealSrc =
    cashSession.branch.sealImageUrl != null
      ? await resolveSealBuffer(cashSession.branch.sealImageUrl)
      : null;

  // 9. Construir data del PDF
  const folioCorto = id.slice(-8).toUpperCase();
  const operador = cashSession.user.name ?? "—";
  const cerradoPor = cashSession.authorizedBy?.name ?? operador;

  const corteData: CortePDFData = {
    branch,
    folio: id,
    operador,
    apertura: {
      fecha: formatDateTime(cashSession.openedAt),
      montoInicial: saldoInicial,
    },
    cierre: {
      fecha: formatDateTime(cashSession.closedAt),
      cerradoPor,
    },
    resumen: {
      saldoInicial,
      ventasEfectivo,
      entradasEfectivo,
      gastosEfectivo,
      retirosEfectivo,
      reembolsosEfectivo,
      efectivoEsperado,
      efectivoContado,
      diferencia,
    },
    denominaciones,
    autorizacion,
    sealImagePath: cashSession.branch.sealImageUrl ?? null,
  };

  // 10. Renderizar PDF
  const element = React.createElement(CortePDF, {
    data: corteData,
    sealSrc,
  }) as unknown as React.ReactElement<DocumentProps>;

  const buffer = await renderToBuffer(element);

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="Corte-${folioCorto}.pdf"`,
    },
  });
}
