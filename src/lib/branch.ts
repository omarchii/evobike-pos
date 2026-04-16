import { prisma } from "@/lib/prisma";
import type { BranchPDFData } from "@/lib/pdf/types";

// Re-exportar para que los consumidores importen desde @/lib/branch
export type { BranchPDFData } from "@/lib/pdf/types";

export type TipoDocPDF = "cotizacion" | "pedido" | "ticket" | "poliza";

export class BranchNotConfiguredError extends Error {
  constructor(public readonly missingFields: string[]) {
    super(
      `Sucursal sin configurar: faltan ${missingFields.join(", ")}`,
    );
    this.name = "BranchNotConfiguredError";
  }
}

type BranchFieldKey =
  | "rfc"
  | "razonSocial"
  | "regimenFiscal"
  | "street"
  | "colonia"
  | "city"
  | "state"
  | "zip"
  | "phone"
  | "sealImageUrl"
  | "terminosCotizacion"
  | "terminosPedido"
  | "terminosPoliza";

// Campos comunes requeridos en todos los tipos de documento
const BASE_FIELDS: Array<{ key: BranchFieldKey; label: string }> = [
  { key: "rfc", label: "RFC" },
  { key: "razonSocial", label: "Razón social" },
  { key: "regimenFiscal", label: "Régimen fiscal" },
  { key: "street", label: "Calle" },
  { key: "colonia", label: "Colonia" },
  { key: "city", label: "Ciudad" },
  { key: "state", label: "Estado" },
  { key: "zip", label: "Código postal" },
  { key: "phone", label: "Teléfono" },
  { key: "sealImageUrl", label: "Sello de sucursal" },
];

const EXTRA_BY_TYPE: Record<
  Exclude<TipoDocPDF, "ticket">,
  { key: BranchFieldKey; label: string }
> = {
  cotizacion: { key: "terminosCotizacion", label: "Términos de cotización" },
  pedido: { key: "terminosPedido", label: "Términos de pedido" },
  poliza: { key: "terminosPoliza", label: "Términos de póliza" },
};

function isPlaceholder(value: string | null | undefined): boolean {
  if (!value) return true;
  const trimmed = value.trim();
  if (trimmed.length === 0) return true;
  if (/^CONFIGURAR\b/i.test(trimmed)) return true;
  return false;
}

/**
 * Valida que la sucursal tenga todos los datos necesarios para emitir un PDF.
 * Lanza `BranchNotConfiguredError` si faltan campos.
 * Devuelve un `BranchPDFData` ya tipado y listo para pasar a `<DocumentHeader>`.
 */
export async function assertBranchConfiguredForPDF(
  branchId: string,
  tipoDoc: TipoDocPDF,
): Promise<BranchPDFData> {
  const branch = await prisma.branch.findUnique({ where: { id: branchId } });
  if (!branch) {
    throw new BranchNotConfiguredError(["Sucursal no encontrada"]);
  }

  const requirements = [...BASE_FIELDS];
  if (tipoDoc !== "ticket") {
    requirements.push(EXTRA_BY_TYPE[tipoDoc]);
  }

  const record = branch as unknown as Record<string, string | null | undefined>;
  const missingFields = requirements
    .filter((f) => isPlaceholder(record[f.key]))
    .map((f) => f.label);

  if (missingFields.length > 0) {
    throw new BranchNotConfiguredError(missingFields);
  }

  return {
    id: branch.id,
    code: branch.code,
    name: branch.name,
    rfc: branch.rfc as string,
    razonSocial: branch.razonSocial as string,
    regimenFiscal: branch.regimenFiscal as string,
    street: branch.street as string,
    extNum: branch.extNum,
    intNum: branch.intNum,
    colonia: branch.colonia as string,
    city: branch.city as string,
    state: branch.state as string,
    zip: branch.zip as string,
    phone: branch.phone as string,
    email: branch.email,
    website: branch.website,
    sealImageUrl: branch.sealImageUrl,
    terminosCotizacion: branch.terminosCotizacion,
    terminosPedido: branch.terminosPedido,
    terminosPoliza: branch.terminosPoliza,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Tipos legacy — se conservan para que el código existente que importe
// BranchPDFDocType / BranchPDFGuardResult no rompa mientras se migra.
// TODO: limpiar en la siguiente sesión.
// ──────────────────────────────────────────────────────────────────────────────
/** @deprecated usar TipoDocPDF */
export type BranchPDFDocType = "COTIZACION" | "PEDIDO" | "POLIZA";

/** @deprecated assertBranchConfiguredForPDF ahora lanza en vez de retornar {ok} */
export type BranchPDFGuardResult =
  | { ok: true }
  | { ok: false; missingFields: string[] };
