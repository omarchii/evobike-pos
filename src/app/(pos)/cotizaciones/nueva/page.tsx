import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import QuotationForm from "./quotation-form";
import type { ModeloOption, CustomerOption, ManagerOption } from "./quotation-form";

export const dynamic = "force-dynamic";

interface SessionUser {
  id: string;
  branchId: string;
  role: string;
}

export default async function NuevaCotizacionPage() {
  const session = await getServerSession(authOptions);
  const user = session?.user as SessionUser | undefined;
  if (!user?.branchId) redirect("/dashboard");

  const { branchId } = user;

  const [rawVariants, rawCustomers, rawManagers] = await Promise.all([
    // Variantes con modelo, voltaje, color — para los selectores en cascada
    prisma.productVariant.findMany({
      select: {
        id: true,
        precioPublico: true,
        modelo: { select: { id: true, nombre: true } },
        color: { select: { id: true, nombre: true } },
        voltaje: { select: { id: true, label: true } },
      },
      orderBy: [{ modelo: { nombre: "asc" } }, { voltaje: { valor: "asc" } }],
    }),

    // Clientes de la sucursal
    prisma.customer.findMany({
      select: { id: true, name: true, phone: true },
      orderBy: { name: "asc" },
      take: 500,
    }),

    // Gerentes activos de la sucursal
    prisma.user.findMany({
      where: {
        branchId,
        role: { in: ["MANAGER", "ADMIN"] },
      },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  // ── Build cascading modelo structure ──────────────────────────────────────

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
    if (!mEntry.voltajesMap.has(v.voltaje.id)) {
      mEntry.voltajesMap.set(v.voltaje.id, {
        id: v.voltaje.id,
        label: v.voltaje.label,
        colores: [],
      });
    }
    mEntry.voltajesMap.get(v.voltaje.id)!.colores.push({
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

  return (
    <div>
      {/* Back nav */}
      <div className="mb-5">
        <Link
          href="/cotizaciones"
          className="inline-flex items-center gap-1.5 text-sm transition-colors hover:opacity-70"
          style={{ color: "var(--on-surf-var)" }}
        >
          <ChevronLeft className="h-4 w-4" />
          Cotizaciones
        </Link>
      </div>

      <h1
        className="text-3xl font-bold tracking-tight mb-6"
        style={{ fontFamily: "var(--font-display)", color: "var(--on-surf)" }}
      >
        Nueva cotización
      </h1>

      <QuotationForm
        mode="create"
        modelos={modelos}
        customers={customers}
        managers={managers}
      />
    </div>
  );
}
