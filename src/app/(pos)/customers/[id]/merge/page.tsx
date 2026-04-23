// Wizard de fusión de clientes (BRIEF §7.5 — Sub-fase J).
// MANAGER+ only. Carga el cliente origen y delega al cliente para elegir
// destino + previsualizar FKs + confirmar.

import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAuthedUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { isManagerPlus } from "@/lib/customers/service";
import { MergeWizard } from "@/components/customers/profile/merge-wizard";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CustomerMergePage({
  params,
}: PageProps): Promise<React.JSX.Element> {
  const session = await getServerSession(authOptions);
  const user = getAuthedUser(session);
  if (!user) redirect("/login");
  if (!isManagerPlus(user.role)) {
    redirect(`/customers/${(await params).id}`);
  }

  const { id } = await params;
  const source = await prisma.customer.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      rfc: true,
      isBusiness: true,
      razonSocial: true,
      balance: true,
      creditLimit: true,
      mergedIntoId: true,
      deletedAt: true,
    },
  });

  if (!source) notFound();

  if (source.mergedIntoId) {
    redirect(`/customers/${source.mergedIntoId}`);
  }

  return (
    <MergeWizard
      source={{
        id: source.id,
        name: source.name,
        phone: source.phone,
        email: source.email,
        rfc: source.rfc,
        isBusiness: source.isBusiness,
        razonSocial: source.razonSocial,
        balance: Number(source.balance),
        creditLimit: Number(source.creditLimit),
      }}
    />
  );
}
