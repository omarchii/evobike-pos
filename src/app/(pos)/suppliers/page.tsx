import type { SessionUser } from "@/lib/auth-types";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SuppliersManager } from "./suppliers-manager";

export const dynamic = "force-dynamic";

export default async function SuppliersPage() {
  const session = await getServerSession(authOptions);
  const user = session?.user as unknown as SessionUser | undefined;
  if (!user) redirect("/login");
  if (user.role !== "ADMIN" && user.role !== "MANAGER") redirect("/");

  const suppliers = await prisma.supplier.findMany({
    orderBy: [{ isActive: "desc" }, { nombre: "asc" }],
    select: {
      id: true,
      nombre: true,
      rfc: true,
      contacto: true,
      telefono: true,
      email: true,
      direccion: true,
      notas: true,
      isActive: true,
      _count: {
        select: {
          purchaseReceipts: true,
          cashTransactions: true,
        },
      },
    },
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1
          className="text-3xl font-semibold"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Proveedores
        </h1>
        <p className="text-sm text-[var(--on-surf-var)] mt-1">
          Catálogo de proveedores. Estado de cuenta por proveedor combina recepciones de inventario y gastos en caja. Los proveedores nunca se eliminan; se desactivan.
        </p>
      </div>
      <SuppliersManager
        initialSuppliers={suppliers.map((s) => ({
          id: s.id,
          nombre: s.nombre,
          rfc: s.rfc,
          contacto: s.contacto,
          telefono: s.telefono,
          email: s.email,
          direccion: s.direccion,
          notas: s.notas,
          isActive: s.isActive,
          receiptCount: s._count.purchaseReceipts,
          expenseCount: s._count.cashTransactions,
        }))}
      />
    </div>
  );
}
