import type { BranchedSessionUser } from "@/lib/auth-types";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { RecepcionForm } from "./recepcion-form";

export const dynamic = "force-dynamic";

export interface ConfigOption {
  configurationId: string;
  batteryVariantId: string;
  batterySku: string;
  label: string; // ej. "60V · 20Ah"
  quantity: number; // baterías por unidad
}

export interface VariantCatalogItem {
  id: string;
  sku: string;
  label: string;
  esBateria: boolean;
  costo: number;
  currentStock: number;
  configs: ConfigOption[]; // vacío si no es ensamblable
}

export interface SimpleCatalogItem {
  id: string;
  codigo: string;
  nombre: string;
  categoria: string;
  costoInterno: number;
  currentStock: number;
}

export default async function NuevaRecepcionPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  const { role, branchId } = session.user as unknown as BranchedSessionUser;
  if (role !== "ADMIN" && role !== "MANAGER") redirect("/");

  const params = await searchParams;
  const variantIdParam =
    typeof params.variantId === "string" ? params.variantId : null;
  const simpleIdParam =
    typeof params.simpleProductId === "string"
      ? params.simpleProductId
      : null;

  // variantId takes priority if both somehow arrive
  const preselectedVariantId = variantIdParam;
  const preselectedSimpleId = variantIdParam ? null : simpleIdParam;

  const [rawVariants, rawSimples] = await Promise.all([
    prisma.productVariant.findMany({
      where: { isActive: true },
      select: {
        id: true,
        sku: true,
        costo: true,
        modelo_id: true,
        voltaje_id: true,
        modelo: { select: { nombre: true, esBateria: true, requiere_vin: true } },
        color: { select: { nombre: true } },
        voltaje: { select: { label: true } },
        stocks: { where: { branchId }, select: { quantity: true } },
      },
      orderBy: [{ modelo: { nombre: "asc" } }, { sku: "asc" }],
    }),
    prisma.simpleProduct.findMany({
      where: { isActive: true },
      select: {
        id: true,
        codigo: true,
        nombre: true,
        categoria: true,
        costoInterno: true,
        stocks: { where: { branchId }, select: { quantity: true } },
      },
      orderBy: { nombre: "asc" },
    }),
  ]);

  // Cargar BatteryConfigurations para vehículos (no baterías). Una variante es
  // "ensamblable" si existe al menos una BatteryConfiguration para su modelo+voltaje.
  const vehicleVariants = rawVariants.filter((v) => !v.modelo.esBateria);
  const configRows = vehicleVariants.length
    ? await prisma.batteryConfiguration.findMany({
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
          batteryVariant: {
            select: {
              sku: true,
              voltaje: { select: { label: true } },
              capacidad: { select: { nombre: true } },
            },
          },
        },
      })
    : [];

  const configsByKey = new Map<string, ConfigOption[]>();
  for (const c of configRows) {
    const k = `${c.modeloId}:${c.voltajeId}`;
    const arr = configsByKey.get(k) ?? [];
    const ahLabel = c.batteryVariant.capacidad?.nombre ?? "—";
    arr.push({
      configurationId: c.id,
      batteryVariantId: c.batteryVariantId,
      batterySku: c.batteryVariant.sku,
      label: `${c.batteryVariant.voltaje.label} · ${ahLabel}`,
      quantity: c.quantity,
    });
    configsByKey.set(k, arr);
  }

  const variants: VariantCatalogItem[] = rawVariants.map((v) => ({
    id: v.id,
    sku: v.sku,
    label: `${v.modelo.nombre} ${v.color.nombre} ${v.voltaje.label}`,
    esBateria: v.modelo.esBateria,
    costo: Number(v.costo),
    currentStock: v.stocks[0]?.quantity ?? 0,
    configs: configsByKey.get(`${v.modelo_id}:${v.voltaje_id}`) ?? [],
  }));

  const simples: SimpleCatalogItem[] = rawSimples.map((s) => ({
    id: s.id,
    codigo: s.codigo,
    nombre: s.nombre,
    categoria: s.categoria,
    costoInterno: Number(s.costoInterno),
    currentStock: s.stocks[0]?.quantity ?? 0,
  }));

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      <div className="mb-4 shrink-0 flex items-center justify-between">
        <div>
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "1.5rem",
              fontWeight: 700,
              letterSpacing: "-0.01em",
              color: "var(--on-surf)",
            }}
          >
            Nueva Recepción
          </h1>
          <p
            style={{
              fontSize: "0.75rem",
              color: "var(--on-surf-var)",
              marginTop: "0.2rem",
            }}
          >
            Registra una entrada de mercancía al inventario de tu sucursal.
          </p>
        </div>
      </div>

      <RecepcionForm
        variants={variants}
        simples={simples}
        preselectedVariantId={preselectedVariantId}
        preselectedSimpleId={preselectedSimpleId}
      />
    </div>
  );
}
