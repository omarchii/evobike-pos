// Perfil 360° del cliente (BRIEF §7.4 — Sub-fase E).
// Server component: carga datos vía getCustomerProfileData y delega
// el shell + tabs al cliente.
//
// Soft-merge: si el cliente tiene mergedIntoId, redirect 308 al target
// (BRIEF §6.1).

import { redirect, notFound, permanentRedirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAuthedUser } from "@/lib/auth-helpers";
import { getCustomerProfileData } from "@/lib/customers/profile-data";
import { CustomerProfileShell } from "@/components/customers/profile/profile-shell";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CustomerProfilePage({
  params,
}: PageProps): Promise<React.JSX.Element> {
  const session = await getServerSession(authOptions);
  const user = getAuthedUser(session);
  if (!user) redirect("/login");

  const { id } = await params;
  const data = await getCustomerProfileData(id);
  if (!data) notFound();

  if (data.mergedTargetId) {
    permanentRedirect(`/customers/${data.mergedTargetId}`);
  }

  return <CustomerProfileShell data={data} role={user.role} />;
}
