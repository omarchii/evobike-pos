import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getAuthedUser } from "@/lib/auth-helpers";
import {
  listDirectoryCustomers,
  getDirectoryStats,
  type DirectoryFilters,
} from "@/lib/customers/directory-query";
import { CustomerDirectoryView } from "./customer-list";

export const dynamic = "force-dynamic";

const VALID_CHIPS = ["activos", "con-saldo", "empresas", "riesgo", "inactivos", "sin-consent"] as const;
type ChipFilter = (typeof VALID_CHIPS)[number];

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function getString(val: string | string[] | undefined): string | undefined {
  if (!val) return undefined;
  return Array.isArray(val) ? val[0] : val;
}

const PAGE_SIZE = 50;

export default async function CustomersPage({ searchParams }: PageProps): Promise<React.JSX.Element> {
  const session = await getServerSession(authOptions);
  const user = getAuthedUser(session);
  if (!user) redirect("/login");

  const params = await searchParams;
  const q = getString(params.q)?.trim() || undefined;
  const rawChip = getString(params.chip);
  const chip = (VALID_CHIPS as readonly string[]).includes(rawChip ?? "")
    ? (rawChip as ChipFilter)
    : null;
  const page = Math.max(1, Number(getString(params.page) ?? "1") || 1);
  const showDeleted = getString(params.showDeleted) === "1";
  const canSeeDeleted = user.role === "ADMIN" || user.role === "MANAGER";

  const filters: DirectoryFilters = {
    q,
    chip,
    includeDeleted: showDeleted && canSeeDeleted,
  };

  const [{ rows, total }, stats] = await Promise.all([
    listDirectoryCustomers({
      ...filters,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    }),
    getDirectoryStats(filters),
  ]);

  return (
    <CustomerDirectoryView
      rows={rows}
      total={total}
      stats={stats}
      page={page}
      pageSize={PAGE_SIZE}
      filters={{
        q: q ?? "",
        chip,
        showDeleted,
      }}
      canSeeDeleted={canSeeDeleted}
      role={user.role}
    />
  );
}
