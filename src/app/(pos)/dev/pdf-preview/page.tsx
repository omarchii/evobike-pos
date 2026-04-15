import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  assertBranchConfiguredForPDF,
  BranchNotConfiguredError,
} from "@/lib/branch";

export default async function PdfPreviewPage() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  const branch = await prisma.branch.findFirst({
    where: { id: { not: undefined } },
    orderBy: { code: "asc" },
  });

  if (!branch) {
    return (
      <div className="p-8 text-[var(--on-surf)]">
        <h1 className="text-xl font-bold mb-4">Dev: PDF Preview</h1>
        <p className="text-[var(--on-surf-var)]">No hay sucursales en la base de datos.</p>
      </div>
    );
  }

  let missingFields: string[] | null = null;

  try {
    await assertBranchConfiguredForPDF(branch.id, "cotizacion");
  } catch (err) {
    if (err instanceof BranchNotConfiguredError) {
      missingFields = err.missingFields;
    } else {
      throw err;
    }
  }

  if (missingFields !== null) {
    return (
      <div className="p-8 text-[var(--on-surf)]">
        <h1 className="text-xl font-bold mb-4">Dev: PDF Preview</h1>
        <p className="mb-2 text-[var(--on-surf-var)]">
          La sucursal <strong>{branch.name}</strong> no está configurada para emitir PDFs.
          Faltan los siguientes campos:
        </p>
        <ul className="list-disc list-inside space-y-1 text-sm text-[var(--ter)]">
          {missingFields.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-[var(--on-surf-var)]">
          Configura la sucursal en{" "}
          <a href="/configuracion/sucursal" className="underline">
            /configuracion/sucursal
          </a>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="p-8 text-[var(--on-surf)]">
      <h1 className="text-xl font-bold mb-2">Dev: PDF Preview — Cotización dummy</h1>
      <p className="text-sm text-[var(--on-surf-var)] mb-4">
        Sucursal: <strong>{branch.name}</strong> ({branch.id})
      </p>
      <iframe
        src={`/api/dev/pdf-preview?branchId=${branch.id}`}
        className="w-full border border-[var(--ghost-border)] rounded"
        style={{ height: "calc(100vh - 200px)" }}
        title="Preview cotización PDF"
      />
    </div>
  );
}
