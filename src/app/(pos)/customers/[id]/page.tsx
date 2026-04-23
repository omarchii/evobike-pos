// Perfil 360° del cliente (BRIEF §7.4 — Sub-fases E/F/G).
// Server component: carga datos vía getCustomerProfileData + loaders de los
// tabs pesados (bicis/ventas/taller/cotizaciones) en paralelo y delega el
// render al shell de cliente.
//
// Soft-merge: si el cliente tiene mergedIntoId, redirect 308 al target
// (BRIEF §6.1).

import { redirect, notFound, permanentRedirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAuthedUser } from "@/lib/auth-helpers";
import { getCustomerProfileData } from "@/lib/customers/profile-data";
import {
  getCustomerBikesTabData,
  getCustomerSalesTabData,
  getCustomerServiceOrdersTabData,
  getCustomerQuotationsTabData,
} from "@/lib/customers/profile-tabs-data";
import {
  getCustomerFinanzasData,
  getCustomerDatosData,
} from "@/lib/customers/profile-finanzas-data";
import { isManagerPlus } from "@/lib/customers/service";
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

  const viewerIsManagerPlus = isManagerPlus(user.role);

  const [bikes, sales, serviceOrders, quotations, finanzas, datos] = await Promise.all([
    getCustomerBikesTabData(id),
    getCustomerSalesTabData(id),
    getCustomerServiceOrdersTabData(id),
    getCustomerQuotationsTabData(id),
    viewerIsManagerPlus
      ? getCustomerFinanzasData(id)
      : Promise.resolve(null),
    getCustomerDatosData(id, user.id, viewerIsManagerPlus),
  ]);

  return (
    <CustomerProfileShell
      data={data}
      role={user.role}
      bikes={bikes}
      sales={sales}
      serviceOrders={serviceOrders}
      quotations={quotations}
      finanzas={finanzas}
      datos={datos}
    />
  );
}
