import type { SessionUser } from "@/lib/auth-types";
import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSupplierStatement } from "@/lib/queries/supplier-statement";
import { SupplierStatementView } from "./statement-view";

export const dynamic = "force-dynamic";

const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  MENSAJERIA: "Mensajería",
  PAPELERIA: "Papelería",
  CONSUMO: "Consumo",
  MANTENIMIENTO: "Mantenimiento",
  PAGO_PROVEEDOR: "Pago a proveedor",
  LIMPIEZA: "Limpieza",
  AJUSTE_CAJA: "Ajuste de caja",
  OTRO: "Otro",
};

export default async function SupplierDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession(authOptions);
  const user = session?.user as unknown as SessionUser | undefined;
  if (!user) redirect("/login");
  if (user.role !== "ADMIN" && user.role !== "MANAGER") redirect("/");

  const { id } = await params;
  const supplier = await prisma.supplier.findUnique({ where: { id } });
  if (!supplier) notFound();

  const statement = await getSupplierStatement(id);

  return (
    <SupplierStatementView
      supplier={{
        id: supplier.id,
        nombre: supplier.nombre,
        rfc: supplier.rfc,
        contacto: supplier.contacto,
        telefono: supplier.telefono,
        email: supplier.email,
        direccion: supplier.direccion,
        notas: supplier.notas,
        isActive: supplier.isActive,
      }}
      statement={statement}
      categoryLabels={EXPENSE_CATEGORY_LABELS}
      backLink={
        <Link
          href="/suppliers"
          className="text-sm hover:underline"
          style={{ color: "var(--p)" }}
        >
          ← Proveedores
        </Link>
      }
    />
  );
}
