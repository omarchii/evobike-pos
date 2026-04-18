import { prisma } from "@/lib/prisma";

export type DynamicLabelMatch = {
    /** Segmento del path hasta el id, p.ej. "/customers/abc123" */
    path: string;
    /** Label resuelto desde BD */
    label: string;
};

type ResolveContext = {
    role: string;
    branchId: string;
};

/**
 * Resuelve el label humano para un segmento dinámico (id) consultando la BD
 * con el branch filter correspondiente (salvo ADMIN, que es cross-branch).
 * Devuelve null si no encuentra la entidad → el llamador aplica `fallbackIdLabel`.
 */
export async function resolveDynamicLabel(
    segments: string[],
    idIndex: number,
    ctx: ResolveContext
): Promise<string | null> {
    const parent = segments.slice(0, idIndex).join("/");
    const id = segments[idIndex];
    if (!id) return null;

    const branchFilter = ctx.role === "ADMIN" ? {} : { branchId: ctx.branchId };

    switch (`/${parent}`) {
        case "/customers":
        case "/reportes/clientes": {
            const c = await prisma.customer.findUnique({
                where: { id },
                select: { name: true },
            });
            return c?.name ?? null;
        }
        case "/workshop": {
            const s = await prisma.serviceOrder.findFirst({
                where: { id, ...branchFilter },
                select: { folio: true },
            });
            return s?.folio ?? null;
        }
        case "/ventas":
        case "/pedidos": {
            const s = await prisma.sale.findFirst({
                where: { id, ...branchFilter },
                select: { folio: true },
            });
            return s?.folio ?? null;
        }
        case "/cotizaciones": {
            const q = await prisma.quotation.findFirst({
                where: { id, ...branchFilter },
                select: { folio: true },
            });
            return q?.folio ?? null;
        }
        case "/transferencias": {
            const branchFilter =
                ctx.role === "ADMIN"
                    ? {}
                    : {
                          OR: [
                              { fromBranchId: ctx.branchId },
                              { toBranchId: ctx.branchId },
                          ],
                      };
            const t = await prisma.stockTransfer.findFirst({
                where: { id, ...branchFilter },
                select: { folio: true },
            });
            return t?.folio ?? null;
        }
        case "/inventario/recepciones": {
            const r = await prisma.purchaseReceipt.findFirst({
                where: { id, ...branchFilter },
                select: { proveedor: true, folioFacturaProveedor: true },
            });
            if (!r) return null;
            return r.folioFacturaProveedor
                ? `${r.proveedor} · ${r.folioFacturaProveedor}`
                : r.proveedor;
        }
        default:
            return null;
    }
}

/** Fallback determinístico para ids no resueltos. */
export function fallbackIdLabel(id: string): string {
    return `#${id.slice(0, 6)}`;
}
