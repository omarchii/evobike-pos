import { prisma } from "@/lib/prisma";

export type BranchPDFDocType = "COTIZACION" | "PEDIDO" | "POLIZA";

export type BranchPDFGuardResult =
  | { ok: true }
  | { ok: false; missingFields: string[] };

const BASE_FIELDS: Array<{ key: string; label: string }> = [
  { key: "rfc", label: "RFC" },
  { key: "razonSocial", label: "Razón social" },
  { key: "phone", label: "Teléfono" },
  { key: "email", label: "Email" },
  { key: "sealImageUrl", label: "Sello de sucursal" },
];

const EXTRA_FIELD_BY_DOC: Record<BranchPDFDocType, { key: string; label: string }> = {
  COTIZACION: { key: "terminosCotizacion", label: "Términos de cotización" },
  PEDIDO: { key: "terminosPedido", label: "Términos de pedido" },
  POLIZA: { key: "terminosPoliza", label: "Términos de póliza" },
};

function isPlaceholder(value: string | null | undefined): boolean {
  if (!value) return true;
  const trimmed = value.trim();
  if (trimmed.length === 0) return true;
  if (/^CONFIGURAR\b/i.test(trimmed)) return true;
  return false;
}

export async function assertBranchConfiguredForPDF(
  branchId: string,
  tipoDoc: BranchPDFDocType,
): Promise<BranchPDFGuardResult> {
  const branch = await prisma.branch.findUnique({ where: { id: branchId } });
  if (!branch) {
    return { ok: false, missingFields: ["Sucursal no encontrada"] };
  }

  const requirements = [...BASE_FIELDS];
  if (tipoDoc === "COTIZACION") {
    requirements.push(EXTRA_FIELD_BY_DOC.COTIZACION);
  } else if (tipoDoc === "PEDIDO") {
    requirements.push(EXTRA_FIELD_BY_DOC.COTIZACION);
    requirements.push(EXTRA_FIELD_BY_DOC.PEDIDO);
  } else {
    requirements.push(EXTRA_FIELD_BY_DOC.COTIZACION);
    requirements.push(EXTRA_FIELD_BY_DOC.POLIZA);
  }

  const record = branch as unknown as Record<string, string | null | undefined>;
  const missingFields = requirements
    .filter((f) => isPlaceholder(record[f.key]))
    .map((f) => f.label);

  if (missingFields.length > 0) {
    return { ok: false, missingFields };
  }
  return { ok: true };
}
