import type { BranchedSessionUser } from "@/lib/auth-types";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import PedidosList from "./pedidos-list";

export const dynamic = "force-dynamic";

export interface CustomerOption {
  id: string;
  name: string;
  phone: string | null;
}

export interface VariantOption {
  id: string;
  sku: string;
  label: string;        // "AGUILA Negro 48V"
  precio: number;
  modeloId: string;
  modeloNombre: string;
  voltajeId: string;
  voltajeLabel: string;
  colorId: string;
  colorNombre: string;
}

interface SerializedPayment {
  id: string;
  amount: number;
  method: string;
  createdAt: Date;
}

interface SerializedItem {
  id: string;
  quantity: number;
  price: number;
  discount: number;
  productName: string;
}

export interface SerializedPedido {
  id: string;
  folio: string;
  status: string;
  orderType: string | null;
  total: number;
  subtotal: number;
  discount: number;
  totalPaid: number;
  notes: string | null;
  expectedDeliveryDate: Date | null;
  createdAt: Date;
  customer: {
    id: string;
    name: string;
    phone: string | null;
  } | null;
  createdBy: string;
  items: SerializedItem[];
  payments: SerializedPayment[];
}

export default async function PedidosPage() {
  const session = await getServerSession(authOptions);
  const user = session?.user as BranchedSessionUser | undefined;

  if (!user?.branchId) {
    return <div>No tienes sucursal asignada</div>;
  }

  const { branchId, role } = user;
  // ADMIN ve todos los pedidos
  const branchFilter = role === "ADMIN" ? {} : { branchId };

  const [pedidos, customers, variants] = await Promise.all([
    // ── Pedidos ──────────────────────────────────────────────────────────────
    prisma.sale.findMany({
      where: { ...branchFilter, status: "LAYAWAY" },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        user: { select: { name: true } },
        payments: true,
        items: {
          include: {
            productVariant: {
              include: { modelo: true, color: true, voltaje: true, capacidad: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),

    // ── Clientes para el modal ────────────────────────────────────────────────
    prisma.customer.findMany({
      select: { id: true, name: true, phone: true },
      orderBy: { name: "asc" },
      take: 500,
    }),

    // ── Variantes de producto para el modal ───────────────────────────────────
    prisma.productVariant.findMany({
      select: {
        id: true,
        sku: true,
        precioPublico: true,
        modelo_id: true,
        color_id: true,
        voltaje_id: true,
        modelo: { select: { nombre: true } },
        color: { select: { nombre: true } },
        voltaje: { select: { label: true } },
        capacidad: { select: { nombre: true } },
      },
      orderBy: [{ modelo: { nombre: "asc" } }, { sku: "asc" }],
    }),
  ]);

  const serialized: SerializedPedido[] = pedidos.map((p) => {
    const totalPaid = p.payments.reduce((acc, pay) => acc + Number(pay.amount), 0);
    return {
      id: p.id,
      folio: p.folio,
      status: p.status,
      orderType: p.orderType,
      total: Number(p.total),
      subtotal: Number(p.subtotal),
      discount: Number(p.discount),
      totalPaid,
      notes: p.notes ?? null,
      expectedDeliveryDate: p.expectedDeliveryDate ?? null,
      createdAt: p.createdAt,
      customer: p.customer
        ? { id: p.customer.id, name: p.customer.name, phone: p.customer.phone ?? null }
        : null,
      createdBy: p.user.name ?? "–",
      payments: p.payments.map((pay) => ({
        id: pay.id,
        amount: Number(pay.amount),
        method: pay.method,
        createdAt: pay.createdAt,
      })),
      items: p.items.map((item) => {
        const pv = item.productVariant;
        const ahSuffix = pv?.capacidad ? ` · ${pv.capacidad.nombre}` : "";
        return {
          id: item.id,
          quantity: item.quantity,
          price: Number(item.price),
          discount: Number(item.discount),
          productName: pv
            ? `${pv.modelo.nombre} ${pv.color.nombre} ${pv.voltaje.label}${ahSuffix}`
            : "Producto",
        };
      }),
    };
  });

  const customerOptions: CustomerOption[] = customers.map((c) => ({
    id: c.id,
    name: c.name,
    phone: c.phone ?? null,
  }));

  const variantOptions: VariantOption[] = variants.map((v) => {
    const ahSuffix = v.capacidad ? ` · ${v.capacidad.nombre}` : "";
    return {
      id: v.id,
      sku: v.sku,
      label: `${v.modelo.nombre} ${v.color.nombre} ${v.voltaje.label}${ahSuffix}`,
      precio: Number(v.precioPublico),
      modeloId: v.modelo_id,
      modeloNombre: v.modelo.nombre,
      voltajeId: v.voltaje_id,
      voltajeLabel: v.voltaje.label,
      colorId: v.color_id,
      colorNombre: v.color.nombre,
    };
  });

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pedidos</h1>
          <p className="text-slate-500">
            Gestiona apartados y pedidos pendientes de entrega.
          </p>
        </div>
      </div>

      <PedidosList
        pedidos={serialized}
        customers={customerOptions}
        variants={variantOptions}
      />
    </div>
  );
}
