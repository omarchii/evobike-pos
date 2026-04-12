import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { RecepcionForm } from "./recepcion-form";

export const dynamic = "force-dynamic";

interface SessionUser {
  role: string;
  branchId: string;
}

export interface VariantCatalogItem {
  id: string;
  sku: string;
  label: string;
  esBateria: boolean;
  costo: number;
  currentStock: number;
}

export interface SimpleCatalogItem {
  id: string;
  codigo: string;
  nombre: string;
  categoria: string;
  precioMayorista: number;
  currentStock: number;
}

export default async function NuevaRecepcionPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  const { role, branchId } = session.user as unknown as SessionUser;
  if (role !== "ADMIN" && role !== "MANAGER") redirect("/dashboard");

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

  const [rawVariants, rawSimples, distinctProveedores] = await Promise.all([
    prisma.productVariant.findMany({
      where: { isActive: true },
      select: {
        id: true,
        sku: true,
        costo: true,
        modelo: { select: { nombre: true, esBateria: true } },
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
        precioMayorista: true,
        stocks: { where: { branchId }, select: { quantity: true } },
      },
      orderBy: { nombre: "asc" },
    }),
    prisma.purchaseReceipt.findMany({
      where: { branchId },
      select: { proveedor: true },
      distinct: ["proveedor"],
      orderBy: { proveedor: "asc" },
    }),
  ]);

  const variants: VariantCatalogItem[] = rawVariants.map((v) => ({
    id: v.id,
    sku: v.sku,
    label: `${v.modelo.nombre} ${v.color.nombre} ${v.voltaje.label}`,
    esBateria: v.modelo.esBateria,
    costo: Number(v.costo),
    currentStock: v.stocks[0]?.quantity ?? 0,
  }));

  const simples: SimpleCatalogItem[] = rawSimples.map((s) => ({
    id: s.id,
    codigo: s.codigo,
    nombre: s.nombre,
    categoria: s.categoria,
    precioMayorista: Number(s.precioMayorista),
    currentStock: s.stocks[0]?.quantity ?? 0,
  }));

  const proveedores = distinctProveedores.map((p) => p.proveedor);

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
        proveedores={proveedores}
        preselectedVariantId={preselectedVariantId}
        preselectedSimpleId={preselectedSimpleId}
      />
    </div>
  );
}
