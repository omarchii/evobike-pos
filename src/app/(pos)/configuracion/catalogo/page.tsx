import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CatalogoClient } from "./catalogo-client";

export const dynamic = "force-dynamic";

interface SessionUser {
  id: string;
  role: string;
  branchId: string | null;
}

export default async function CatalogoPage() {
  const session = await getServerSession(authOptions);
  const user = session?.user as unknown as SessionUser | undefined;
  if (!user) redirect("/login");
  if (user.role !== "ADMIN" && user.role !== "MANAGER") redirect("/");

  const [modelos, colores, voltajes, variantes, batteryConfigs, simpleProducts, branches] =
    await Promise.all([
      prisma.modelo.findMany({
        include: { coloresDisponibles: { include: { color: true } } },
        orderBy: [{ isActive: "desc" }, { nombre: "asc" }],
      }),
      prisma.color.findMany({
        orderBy: [{ isActive: "desc" }, { nombre: "asc" }],
      }),
      prisma.voltaje.findMany({
        orderBy: [{ isActive: "desc" }, { valor: "asc" }],
      }),
      prisma.productVariant.findMany({
        include: {
          modelo: { select: { id: true, nombre: true, esBateria: true, isActive: true } },
          color: { select: { id: true, nombre: true, isActive: true } },
          voltaje: { select: { id: true, valor: true, label: true, isActive: true } },
        },
        orderBy: [{ isActive: "desc" }, { sku: "asc" }],
      }),
      prisma.batteryConfiguration.findMany({
        include: {
          modelo: { select: { id: true, nombre: true } },
          voltaje: { select: { id: true, valor: true, label: true } },
          batteryVariant: {
            select: {
              id: true,
              sku: true,
              modelo: { select: { id: true, nombre: true } },
            },
          },
        },
        orderBy: [{ modelo: { nombre: "asc" } }, { voltaje: { valor: "asc" } }],
      }),
      prisma.simpleProduct.findMany({
        orderBy: [{ isActive: "desc" }, { categoria: "asc" }, { nombre: "asc" }],
      }),
      prisma.branch.findMany({
        select: { id: true, code: true, name: true },
        orderBy: { code: "asc" },
      }),
    ]);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1
          className="text-3xl font-semibold"
          style={{ fontFamily: "var(--font-heading, 'Space Grotesk')" }}
        >
          Catálogo de productos
        </h1>
        <p className="text-sm text-[var(--on-surf-var)] mt-1">
          Modelos, variantes, baterías y refacciones. ADMIN edita; MANAGER solo ve alertas.
        </p>
      </div>

      <CatalogoClient
        role={user.role}
        userBranchId={user.branchId}
        initialData={{
          modelos: modelos.map((m) => ({
            id: m.id,
            nombre: m.nombre,
            descripcion: m.descripcion,
            requiere_vin: m.requiere_vin,
            categoria: m.categoria,
            esBateria: m.esBateria,
            isActive: m.isActive,
            imageUrl: m.imageUrl,
            colorIds: m.coloresDisponibles.map((mc) => mc.color_id),
          })),
          colores: colores.map((c) => ({
            id: c.id,
            nombre: c.nombre,
            isGeneric: c.isGeneric,
            isActive: c.isActive,
          })),
          voltajes: voltajes.map((v) => ({
            id: v.id,
            valor: v.valor,
            label: v.label,
            isActive: v.isActive,
          })),
          variantes: variantes.map((v) => ({
            id: v.id,
            sku: v.sku,
            modelo_id: v.modelo_id,
            modelo_nombre: v.modelo.nombre,
            modelo_esBateria: v.modelo.esBateria,
            color_id: v.color_id,
            color_nombre: v.color.nombre,
            voltaje_id: v.voltaje_id,
            voltaje_label: v.voltaje.label,
            precioPublico: Number(v.precioPublico),
            costo: Number(v.costo),
            precioDistribuidor: v.precioDistribuidor ? Number(v.precioDistribuidor) : null,
            precioDistribuidorConfirmado: v.precioDistribuidorConfirmado,
            stockMinimo: v.stockMinimo,
            stockMaximo: v.stockMaximo,
            imageUrl: v.imageUrl,
            isActive: v.isActive,
          })),
          batteryConfigs: batteryConfigs.map((bc) => ({
            id: bc.id,
            modeloId: bc.modeloId,
            modeloNombre: bc.modelo.nombre,
            voltajeId: bc.voltajeId,
            voltajeLabel: bc.voltaje.label,
            batteryVariantId: bc.batteryVariantId,
            batteryVariantSku: bc.batteryVariant.sku,
            batteryVariantModelo: bc.batteryVariant.modelo.nombre,
            quantity: bc.quantity,
          })),
          simpleProducts: simpleProducts.map((sp) => ({
            id: sp.id,
            codigo: sp.codigo,
            nombre: sp.nombre,
            descripcion: sp.descripcion,
            categoria: sp.categoria,
            modeloAplicable: sp.modeloAplicable,
            precioPublico: Number(sp.precioPublico),
            precioMayorista: Number(sp.precioMayorista),
            stockMinimo: sp.stockMinimo,
            stockMaximo: sp.stockMaximo,
            imageUrl: sp.imageUrl,
            isActive: sp.isActive,
          })),
          branches,
        }}
      />
    </div>
  );
}
