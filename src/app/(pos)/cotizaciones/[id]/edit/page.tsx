import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireBranchedUserOrRedirect } from "@/lib/auth-guards";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import QuotationForm from "../../nueva/quotation-form";
import type { ModeloOption, CustomerOption, ManagerOption, QuotationInitialData } from "../../nueva/quotation-form";
import { getEffectiveStatus } from "@/lib/quotations";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export default async function EditarCotizacionPage({ params }: RouteParams) {
  const session = await getServerSession(authOptions);
  const user = requireBranchedUserOrRedirect(session, "/");

  const { id } = await params;
  const { branchId, role } = user;

  const q = await prisma.quotation.findUnique({
    where: { id },
    include: {
      items: {
        select: {
          productVariantId: true,
          description: true,
          quantity: true,
          unitPrice: true,
          isFreeForm: true,
        },
      },
    },
  });

  if (!q) notFound();
  if (role !== "ADMIN" && q.branchId !== branchId) notFound();

  // Guard: only DRAFT/EN_ESPERA_CLIENTE are editable (computed effective status)
  const effectiveStatus = getEffectiveStatus({ status: q.status, validUntil: q.validUntil });
  if (effectiveStatus !== "DRAFT" && effectiveStatus !== "EN_ESPERA_CLIENTE") {
    redirect(`/cotizaciones/${id}`);
  }

  const [rawVariants, rawCustomers, rawManagers] = await Promise.all([
    prisma.productVariant.findMany({
      select: {
        id: true,
        precioPublico: true,
        modelo: { select: { id: true, nombre: true } },
        color: { select: { id: true, nombre: true } },
        voltaje: { select: { id: true, label: true } },
        capacidad: { select: { id: true, nombre: true } },
      },
      orderBy: [{ modelo: { nombre: "asc" } }, { voltaje: { valor: "asc" } }],
    }),

    prisma.customer.findMany({
      select: { id: true, name: true, phone: true },
      orderBy: { name: "asc" },
      take: 500,
    }),

    prisma.user.findMany({
      where: {
        branchId: q.branchId,
        role: { in: ["MANAGER", "ADMIN"] },
      },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  // Build cascading modelo structure
  const modeloMap = new Map<
    string,
    {
      id: string;
      nombre: string;
      voltajesMap: Map<
        string,
        {
          id: string;
          label: string;
          colores: { id: string; nombre: string; variantId: string; precio: number }[];
        }
      >;
    }
  >();

  for (const v of rawVariants) {
    if (!modeloMap.has(v.modelo.id)) {
      modeloMap.set(v.modelo.id, {
        id: v.modelo.id,
        nombre: v.modelo.nombre,
        voltajesMap: new Map(),
      });
    }
    const mEntry = modeloMap.get(v.modelo.id)!;
    const capKey = `${v.voltaje.id}:${v.capacidad?.id ?? ""}`;
    if (!mEntry.voltajesMap.has(capKey)) {
      const ahSuffix = v.capacidad ? ` · ${v.capacidad.nombre}` : "";
      mEntry.voltajesMap.set(capKey, {
        id: capKey,
        label: v.voltaje.label + ahSuffix,
        colores: [],
      });
    }
    mEntry.voltajesMap.get(capKey)!.colores.push({
      id: v.color.id,
      nombre: v.color.nombre,
      variantId: v.id,
      precio: Number(v.precioPublico),
    });
  }

  const modelos: ModeloOption[] = Array.from(modeloMap.values()).map((m) => ({
    id: m.id,
    nombre: m.nombre,
    voltajes: Array.from(m.voltajesMap.values()),
  }));

  const customers: CustomerOption[] = rawCustomers.map((c) => ({
    id: c.id,
    name: c.name,
    phone: c.phone ?? null,
  }));

  const managers: ManagerOption[] = rawManagers.map((m) => ({
    id: m.id,
    name: m.name ?? "Gerente",
  }));

  const initialData: QuotationInitialData = {
    id: q.id,
    customerId: q.customerId,
    anonymousCustomerName: q.anonymousCustomerName,
    anonymousCustomerPhone: q.anonymousCustomerPhone,
    discountAmount: Number(q.discountAmount),
    discountAuthorizedById: q.discountAuthorizedById,
    internalNote: q.internalNote,
    validUntil: q.validUntil.toISOString(),
    items: q.items.map((item) => ({
      productVariantId: item.productVariantId,
      description: item.description,
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice),
      isFreeForm: item.isFreeForm,
    })),
  };

  return (
    <div>
      <div className="mb-5">
        <Link
          href={`/cotizaciones/${id}`}
          className="inline-flex items-center gap-1.5 text-sm transition-colors hover:opacity-70"
          style={{ color: "var(--on-surf-var)" }}
        >
          <ChevronLeft className="h-4 w-4" />
          {q.folio}
        </Link>
      </div>

      <h1
        className="text-3xl font-bold tracking-tight mb-6"
        style={{ fontFamily: "var(--font-display)", color: "var(--on-surf)" }}
      >
        Editar cotización
      </h1>

      <QuotationForm
        mode="edit"
        quotationId={id}
        initialData={initialData}
        modelos={modelos}
        customers={customers}
        managers={managers}
      />
    </div>
  );
}
