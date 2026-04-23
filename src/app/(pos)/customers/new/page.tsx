import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getAuthedUser } from "@/lib/auth-helpers";
import { CustomerForm } from "@/components/customers/customer-form";

export const dynamic = "force-dynamic";

export default async function NewCustomerPage(): Promise<React.JSX.Element> {
  const session = await getServerSession(authOptions);
  const user = getAuthedUser(session);
  if (!user) redirect("/login");

  return <CustomerForm mode="create" initial={null} role={user.role} />;
}
