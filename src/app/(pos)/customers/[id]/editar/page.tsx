import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAuthedUser } from "@/lib/auth-helpers";
import { CustomerForm, type CustomerFormInitial } from "@/components/customers/customer-form";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditCustomerPage({ params }: PageProps): Promise<React.JSX.Element> {
  const session = await getServerSession(authOptions);
  const user = getAuthedUser(session);
  if (!user) redirect("/login");

  const { id } = await params;
  const customer = await prisma.customer.findUnique({ where: { id } });
  if (!customer) notFound();

  // Redirige a target si el registro está mergeado (BRIEF §6.1).
  if (customer.mergedIntoId) {
    redirect(`/customers/${customer.mergedIntoId}/editar`);
  }

  const initial: CustomerFormInitial = {
    id: customer.id,
    name: customer.name,
    phone: customer.phone,
    phone2: customer.phone2,
    email: customer.email,
    birthday: customer.birthday ? customer.birthday.toISOString().slice(0, 10) : null,
    isBusiness: customer.isBusiness,
    communicationConsent: customer.communicationConsent,
    rfc: customer.rfc,
    razonSocial: customer.razonSocial,
    regimenFiscal: customer.regimenFiscal,
    usoCFDI: customer.usoCFDI,
    emailFiscal: customer.emailFiscal,
    direccionFiscal: customer.direccionFiscal,
    shippingStreet: customer.shippingStreet,
    shippingExtNum: customer.shippingExtNum,
    shippingIntNum: customer.shippingIntNum,
    shippingColonia: customer.shippingColonia,
    shippingCity: customer.shippingCity,
    shippingState: customer.shippingState,
    shippingZip: customer.shippingZip,
    shippingRefs: customer.shippingRefs,
  };

  return <CustomerForm mode="edit" initial={initial} role={user.role} />;
}
