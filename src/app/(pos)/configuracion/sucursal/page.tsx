import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SucursalConfigForm } from "./sucursal-config-form";

export const dynamic = "force-dynamic";

interface SessionUser {
  id: string;
  role: string;
  branchId: string | null;
}

export default async function SucursalConfigPage({
  searchParams,
}: {
  searchParams: Promise<{ branchId?: string }>;
}) {
  const session = await getServerSession(authOptions);
  const user = session?.user as unknown as SessionUser | undefined;
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") redirect("/");

  const { branchId: queryBranchId } = await searchParams;

  const branches = await prisma.branch.findMany({
    orderBy: { code: "asc" },
    select: { id: true, code: true, name: true },
  });

  if (branches.length === 0) {
    return (
      <div className="max-w-5xl mx-auto">
        <h1
          className="text-3xl font-semibold mb-4"
          style={{ fontFamily: "var(--font-heading, 'Space Grotesk')" }}
        >
          Configuración de sucursal
        </h1>
        <p className="text-[var(--on-surf-var)]">No hay sucursales registradas.</p>
      </div>
    );
  }

  const selectedId =
    queryBranchId && branches.some((b) => b.id === queryBranchId)
      ? queryBranchId
      : branches[0].id;

  const branch = await prisma.branch.findUnique({ where: { id: selectedId } });
  if (!branch) redirect("/configuracion/sucursal");

  const initial = {
    id: branch.id,
    code: branch.code,
    name: branch.name,
    rfc: branch.rfc ?? "",
    razonSocial: branch.razonSocial ?? "",
    regimenFiscal: branch.regimenFiscal ?? "",
    street: branch.street ?? "",
    extNum: branch.extNum ?? "",
    intNum: branch.intNum ?? "",
    colonia: branch.colonia ?? "",
    city: branch.city ?? "",
    state: branch.state ?? "",
    zip: branch.zip ?? "",
    phone: branch.phone ?? "",
    email: branch.email ?? "",
    website: branch.website ?? "",
    sealImageUrl: branch.sealImageUrl,
    terminosCotizacion: branch.terminosCotizacion ?? "",
    terminosPedido: branch.terminosPedido ?? "",
    terminosPoliza: branch.terminosPoliza ?? "",
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1
            className="text-3xl font-semibold"
            style={{ fontFamily: "var(--font-heading, 'Space Grotesk')" }}
          >
            Configuración de sucursal
          </h1>
          <p className="text-sm text-[var(--on-surf-var)] mt-1">
            Datos fiscales, sello y términos legales que aparecerán en los PDFs.
          </p>
        </div>
        <BranchSwitcher branches={branches} selectedId={selectedId} />
      </div>

      <SucursalConfigForm initial={initial} />
    </div>
  );
}

function BranchSwitcher({
  branches,
  selectedId,
}: {
  branches: Array<{ id: string; code: string; name: string }>;
  selectedId: string;
}) {
  return (
    <form action="/configuracion/sucursal" method="get" className="flex items-center gap-2">
      <label
        htmlFor="branchId"
        className="text-xs uppercase tracking-widest text-[var(--on-surf-var)]"
      >
        Sucursal
      </label>
      <select
        id="branchId"
        name="branchId"
        defaultValue={selectedId}
        className="rounded-xl px-3 py-2 text-sm outline-none"
        style={{
          background: "var(--surf-high)",
          color: "var(--on-surf)",
          fontFamily: "var(--font-body, 'Inter')",
          appearance: "none",
          WebkitAppearance: "none",
        }}
      >
        {branches.map((b) => (
          <option key={b.id} value={b.id}>
            {b.code} — {b.name}
          </option>
        ))}
      </select>
      <button
        type="submit"
        className="text-xs font-medium px-3 py-2 rounded-xl"
        style={{ background: "var(--p)", color: "#ffffff" }}
      >
        Cambiar
      </button>
    </form>
  );
}
