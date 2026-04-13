import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import PosTerminal from "./pos-terminal";

export const dynamic = "force-dynamic";

interface AuthUser {
  id: string;
  name?: string | null;
  email?: string | null;
  role: string;
  branchId: string;
  branchName: string;
}

export default async function PointOfSalePage() {
  const session = await getServerSession(authOptions);
  const authUser = session?.user as AuthUser | undefined;
  const branchId = authUser?.branchId ?? "";

  // Vehicle variants only — baterías standalone se venden vía SimpleProduct,
  // no desde el grid de unidades.
  const rawVariants = await prisma.productVariant.findMany({
    where: { modelo: { esBateria: false } },
    include: {
      modelo: true,
      color: true,
      voltaje: true,
      stocks: true,
    },
    orderBy: { sku: "asc" },
  });

  // Group variants by modelo, compute branch stock
  const modeloMap = new Map<
    string,
    {
      id: string;
      nombre: string;
      descripcion: string | null;
      imageUrl: string | null;
      requiere_vin: boolean;
      categoria: "BICICLETA" | "TRICICLO" | "SCOOTER" | "JUGUETE" | "CARGA";
      variants: {
        id: string;
        sku: string;
        precio: number;
        costo: number;
        stockInBranch: number;
        colorId: string;
        colorNombre: string;
        voltajeId: string;
        voltajeValor: number;
        voltajeLabel: string;
      }[];
    }
  >();

  for (const v of rawVariants) {
    if (!modeloMap.has(v.modelo_id)) {
      modeloMap.set(v.modelo_id, {
        id: v.modelo.id,
        nombre: v.modelo.nombre,
        descripcion: v.modelo.descripcion,
        imageUrl: v.modelo.imageUrl,
        requiere_vin: v.modelo.requiere_vin,
        categoria: v.modelo.categoria,
        variants: [],
      });
    }
    const stockInBranch = branchId
      ? (v.stocks.find((s) => s.branchId === branchId)?.quantity ?? 0)
      : v.stocks.reduce((a, s) => a + s.quantity, 0);

    modeloMap.get(v.modelo_id)!.variants.push({
      id: v.id,
      sku: v.sku,
      precio: Number(v.precioPublico),
      costo: Number(v.costo),
      stockInBranch,
      colorId: v.color_id,
      colorNombre: v.color.nombre,
      voltajeId: v.voltaje_id,
      voltajeValor: v.voltaje.valor,
      voltajeLabel: v.voltaje.label,
    });
  }

  const modelos = Array.from(modeloMap.values()).map((m) => ({
    ...m,
    minPrice: m.variants.length > 0 ? Math.min(...m.variants.map((v) => v.precio)) : 0,
    totalStockInBranch: m.variants.reduce((a, v) => a + v.stockInBranch, 0),
  }));

  // Customers
  const rawCustomers = await prisma.customer.findMany({ orderBy: { name: "asc" } });
  const customers = rawCustomers.map((c) => ({
    id: c.id,
    name: c.name,
    phone: c.phone,
    phone2: c.phone2,
    email: c.email,
    balance: Number(c.balance),
    creditLimit: Number(c.creditLimit),
  }));

  // Battery configurations
  const rawBatteryConfigs = await prisma.batteryConfiguration.findMany({
    select: { modeloId: true, voltajeId: true, quantity: true },
  });
  const batteryConfigs = rawBatteryConfigs.map((bc) => ({
    modeloId: bc.modeloId,
    voltajeId: bc.voltajeId,
    quantity: bc.quantity,
  }));

  // Available batteries in this branch
  const availableBatteriesCount = branchId
    ? await prisma.battery.count({ where: { status: "IN_STOCK", branchId } })
    : 0;

  // SimpleProducts (accesorios, cargadores, refacciones, baterías standalone) + stock por sucursal
  const rawSimpleProducts = await prisma.simpleProduct.findMany({
    where: { isActive: true },
    include: { stocks: true },
    orderBy: { nombre: "asc" },
  });
  const simpleProducts = rawSimpleProducts.map((sp) => {
    const stockInBranch = branchId
      ? (sp.stocks.find((s) => s.branchId === branchId)?.quantity ?? 0)
      : sp.stocks.reduce((a, s) => a + s.quantity, 0);
    return {
      id: sp.id,
      codigo: sp.codigo,
      nombre: sp.nombre,
      descripcion: sp.descripcion,
      categoria: sp.categoria,
      modeloAplicable: sp.modeloAplicable,
      precioPublico: Number(sp.precioPublico),
      imageUrl: sp.imageUrl,
      stockInBranch,
    };
  });

  const sellerName = authUser?.name ?? "";
  const branchName = authUser?.branchName ?? "";
  const userRole = authUser?.role ?? "SELLER";

  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden">
      <PosTerminal
        modelos={modelos}
        customers={customers}
        batteryConfigs={batteryConfigs}
        availableBatteriesCount={availableBatteriesCount}
        simpleProducts={simpleProducts}
        branchId={branchId}
        sellerName={sellerName}
        branchName={branchName}
        userRole={userRole}
      />
    </div>
  );
}
