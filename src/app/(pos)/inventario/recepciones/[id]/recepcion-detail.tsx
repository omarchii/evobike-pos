"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  FileText,
  Paperclip,
  Trash2,
  Upload,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ReceiptStatusBadge, daysUntil } from "@/components/inventario/receipt-status-badge";
import { parseLocalDate } from "@/lib/reportes/date-range";

// ── Types (exported so page.tsx can use them) ─────────────────────────────────

export interface VariantLine {
  movementId: string;
  productVariantId: string;
  sku: string;
  descripcion: string;
  quantity: number;
  precioUnitarioPagado: string | null;
}

export interface SimpleLine {
  movementId: string;
  simpleProductId: string;
  codigo: string;
  nombre: string;
  categoria: string;
  quantity: number;
  precioUnitarioPagado: string | null;
}

export interface BatteryLotLine {
  id: string;
  receivedAt: string;
  sku: string;
  modelo: string;
  totalBaterias: number;
}

export interface AssemblyUnit {
  orderId: string;
  configLabel: string | null;
  serials: string[];
}

export interface AssemblyGroupLine {
  variantSku: string;
  vehicleDesc: string;
  units: AssemblyUnit[];
}

export interface SerializedReceiptDetail {
  id: string;
  branch: { id: string; name: string };
  proveedor: string;
  folioFacturaProveedor: string | null;
  facturaUrl: string | null;
  formaPagoProveedor: string;
  estadoPago: string;
  fechaVencimiento: string | null;
  fechaPago: string | null;
  totalPagado: number;
  notas: string | null;
  createdAt: string;
  registeredBy: { id: string; name: string | null };
  variantLines: VariantLine[];
  simpleLines: SimpleLine[];
  batteryLots: BatteryLotLine[];
  assemblyGroups: AssemblyGroupLine[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatMXN(value: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: string): string {
  const d = parseLocalDate(value, false) ?? new Date(value);
  return d.toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

const FORMA_LABELS: Record<string, string> = {
  CONTADO: "Contado",
  CREDITO: "Crédito",
  TRANSFERENCIA: "Transferencia",
};

function isPdf(url: string): boolean {
  return url.toLowerCase().endsWith(".pdf");
}

// ── Section card wrapper ──────────────────────────────────────────────────────

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: "var(--surf-lowest)",
        borderRadius: "var(--r-xl)",
        boxShadow: "var(--shadow)",
        padding: "1.25rem 1.5rem",
      }}
    >
      <p
        style={{
          fontSize: "0.625rem",
          fontWeight: 500,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--on-surf-var)",
          fontFamily: "var(--font-body)",
          marginBottom: "1rem",
        }}
      >
        {title}
      </p>
      {children}
    </div>
  );
}

// ── Lines sub-table ───────────────────────────────────────────────────────────

function LinesTable({
  headers,
  rows,
  subtotal,
}: {
  headers: string[];
  rows: React.ReactNode[][];
  subtotal: number;
}) {
  const TD: React.CSSProperties = {
    fontSize: "0.75rem",
    color: "var(--on-surf)",
    padding: "0.5rem 0.5rem",
    fontFamily: "var(--font-body)",
  };
  const TD_VAR: React.CSSProperties = { ...TD, color: "var(--on-surf-var)" };

  return (
    <div
      style={{
        background: "var(--surf-low)",
        borderRadius: "var(--r-lg)",
        overflow: "hidden",
        marginBottom: "0.75rem",
      }}
    >
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {headers.map((h) => (
              <th
                key={h}
                style={{
                  ...TD_VAR,
                  fontSize: "0.6rem",
                  fontWeight: 500,
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                  borderBottom: "1px solid var(--ghost-border)",
                  textAlign: h === "Subtotal" || h === "Precio unit." ? "right" : "left",
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: "1px solid var(--ghost-border-soft)" }}>
              {row.map((cell, j) => (
                <td
                  key={j}
                  style={{
                    ...TD,
                    textAlign:
                      headers[j] === "Subtotal" || headers[j] === "Precio unit."
                        ? "right"
                        : "left",
                    fontWeight: headers[j] === "Subtotal" ? 600 : 400,
                    fontFamily:
                      headers[j] === "Subtotal"
                        ? "var(--font-display)"
                        : "var(--font-body)",
                  }}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
          {/* Subtotal row */}
          <tr>
            <td
              colSpan={headers.length - 1}
              style={{
                ...TD_VAR,
                fontSize: "0.625rem",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                textAlign: "right",
                paddingTop: "0.6rem",
              }}
            >
              Subtotal
            </td>
            <td
              style={{
                ...TD,
                fontWeight: 700,
                textAlign: "right",
                fontFamily: "var(--font-display)",
                paddingTop: "0.6rem",
              }}
            >
              {formatMXN(subtotal)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ── Factura section ───────────────────────────────────────────────────────────

function FacturaSection({
  receiptId,
  facturaUrl,
}: {
  receiptId: string;
  facturaUrl: string | null;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ): Promise<void> => {
    const file = e.target.files?.[0];
    if (!file) return;
    await handleUpload(file);
  };

  const handleUpload = async (file: File): Promise<void> => {
    const isPdfFile = file.type === "application/pdf";
    const maxBytes = isPdfFile ? 10 * 1024 * 1024 : 5 * 1024 * 1024;
    if (file.size > maxBytes) {
      toast.error(
        isPdfFile ? "El PDF excede 10 MB" : "La imagen excede 5 MB",
      );
      return;
    }

    setUploading(true);
    toast.loading("Subiendo factura…", { id: "factura-up" });
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(
        `/api/inventory/receipts/${receiptId}/invoice`,
        { method: "POST", body: fd },
      );
      type UpRes = { success: boolean; error?: string };
      const json = (await res.json()) as UpRes;
      if (!res.ok || !json.success) {
        toast.error(json.error ?? "Error al subir", { id: "factura-up" });
        return;
      }
      toast.success("Factura subida correctamente", { id: "factura-up" });
      router.refresh();
    } catch {
      toast.error("Error de red al subir", { id: "factura-up" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDelete = async (): Promise<void> => {
    setDeleting(true);
    toast.loading("Eliminando factura…", { id: "factura-del" });
    try {
      const res = await fetch(
        `/api/inventory/receipts/${receiptId}/invoice`,
        { method: "DELETE" },
      );
      type DelRes = { success: boolean; error?: string };
      const json = (await res.json()) as DelRes;
      if (!res.ok || !json.success) {
        toast.error(json.error ?? "Error al eliminar", { id: "factura-del" });
        return;
      }
      toast.success("Factura eliminada", { id: "factura-del" });
      router.refresh();
    } catch {
      toast.error("Error de red al eliminar", { id: "factura-del" });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <SectionCard title="Factura del proveedor">
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={handleFileChange}
      />

      {facturaUrl ? (
        <div className="space-y-4">
          {/* Preview */}
          {isPdf(facturaUrl) ? (
            <div>
              <embed
                src={facturaUrl}
                type="application/pdf"
                width="100%"
                height={600}
                style={{ borderRadius: "var(--r-lg)" }}
              />
              <p style={{ fontSize: "0.75rem", color: "var(--on-surf-var)", marginTop: "0.5rem" }}>
                ¿No se muestra el PDF?{" "}
                <a
                  href={facturaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "var(--p-mid)" }}
                >
                  Descargar factura
                </a>
              </p>
            </div>
          ) : (
            <div
              style={{
                background: "var(--surf-low)",
                borderRadius: "var(--r-lg)",
                overflow: "hidden",
                position: "relative",
                maxWidth: 800,
              }}
            >
              <Image
                src={facturaUrl}
                alt="Factura adjunta"
                width={800}
                height={600}
                unoptimized
                style={{ width: "100%", height: "auto", display: "block" }}
              />
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 flex-wrap">
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium"
              style={{
                background: "var(--surf-high)",
                color: "var(--on-surf)",
                border: "none",
                cursor: uploading ? "not-allowed" : "pointer",
                fontFamily: "var(--font-body)",
                opacity: uploading ? 0.6 : 1,
              }}
            >
              <Upload className="h-4 w-4" />
              {uploading ? "Subiendo…" : "Reemplazar factura"}
            </button>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button
                  type="button"
                  disabled={deleting}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium"
                  style={{
                    background: "var(--ter-container)",
                    color: "var(--on-ter-container)",
                    border: "none",
                    cursor: deleting ? "not-allowed" : "pointer",
                    fontFamily: "var(--font-body)",
                    opacity: deleting ? 0.6 : 1,
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                  {deleting ? "Eliminando…" : "Eliminar factura"}
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent
                style={{
                  background:
                    "color-mix(in srgb, var(--surf-bright) 88%, transparent)",
                  backdropFilter: "blur(20px)",
                  WebkitBackdropFilter: "blur(20px)",
                  boxShadow: "var(--shadow)",
                  borderRadius: "var(--r-xl)",
                  border: "none",
                }}
              >
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Eliminar factura?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta acción borrará el archivo adjunto y no se puede
                    deshacer. La recepción permanece sin cambios.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Eliminar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      ) : (
        /* Upload zone */
        <div
          className="flex flex-col items-center justify-center py-10 cursor-pointer"
          style={{
            background: "var(--surf-low)",
            borderRadius: "var(--r-lg)",
            border: "2px dashed rgba(178,204,192,0.4)",
          }}
          onClick={() => !uploading && fileInputRef.current?.click()}
        >
          <Paperclip
            className="h-8 w-8 mb-3"
            style={{ color: "var(--on-surf-var)", opacity: 0.5 }}
          />
          <p
            style={{
              fontSize: "0.875rem",
              fontWeight: 500,
              color: "var(--on-surf)",
              fontFamily: "var(--font-body)",
              marginBottom: "0.25rem",
            }}
          >
            {uploading ? "Subiendo…" : "Adjuntar factura"}
          </p>
          <p
            style={{
              fontSize: "0.75rem",
              color: "var(--on-surf-var)",
              fontFamily: "var(--font-body)",
            }}
          >
            PDF (máx. 10 MB) · Imagen PNG/JPEG/WebP (máx. 5 MB)
          </p>
        </div>
      )}
    </SectionCard>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function RecepcionDetail({ data }: { data: SerializedReceiptDetail }) {
  const router = useRouter();
  const [paying, setPaying] = useState(false);

  const handleMarcarPagada = async (): Promise<void> => {
    if (
      !window.confirm(
        "¿Confirmas que esta recepción fue pagada? Esta acción registra la fecha de pago como hoy.",
      )
    )
      return;

    setPaying(true);
    toast.loading("Registrando pago…", { id: "mark-paid" });
    try {
      const res = await fetch(
        `/api/inventory/receipts/${data.id}/pagar`,
        { method: "PATCH" },
      );
      type PagarRes = { success: boolean; error?: string };
      const json = (await res.json()) as PagarRes;
      if (res.status === 409) {
        toast.info("Esta recepción ya estaba registrada como pagada", {
          id: "mark-paid",
        });
        router.refresh();
        return;
      }
      if (!res.ok || !json.success) {
        toast.error(json.error ?? "Error al registrar el pago", {
          id: "mark-paid",
        });
        return;
      }
      toast.success("Recepción marcada como pagada", { id: "mark-paid" });
      router.refresh();
    } catch {
      toast.error("Error de red al registrar el pago", { id: "mark-paid" });
    } finally {
      setPaying(false);
    }
  };

  // Line subtotals
  const variantSubtotal = data.variantLines.reduce((acc, l) => {
    const p = l.precioUnitarioPagado !== null ? parseFloat(l.precioUnitarioPagado) : 0;
    return acc + p * l.quantity;
  }, 0);

  const simpleSubtotal = data.simpleLines.reduce((acc, l) => {
    const p = l.precioUnitarioPagado !== null ? parseFloat(l.precioUnitarioPagado) : 0;
    return acc + p * l.quantity;
  }, 0);

  const vencDays =
    data.fechaVencimiento !== null ? daysUntil(data.fechaVencimiento) : null;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* ── 1. Cabecera ─────────────────────────────────────────────────────── */}
      <SectionCard title="Datos de la recepción">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* Left */}
          <div className="space-y-3">
            <div>
              <p
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "1.25rem",
                  fontWeight: 700,
                  color: "var(--on-surf)",
                  lineHeight: 1.2,
                }}
              >
                {data.proveedor}
              </p>
              {data.folioFacturaProveedor && (
                <p
                  style={{
                    fontSize: "0.75rem",
                    color: "var(--on-surf-var)",
                    fontFamily: "var(--font-body)",
                    marginTop: "0.2rem",
                  }}
                >
                  Folio: {data.folioFacturaProveedor}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <ReceiptStatusBadge
                estadoPago={data.estadoPago}
                fechaVencimiento={data.fechaVencimiento}
              />
              <span
                style={{
                  fontSize: "0.625rem",
                  fontWeight: 500,
                  color: "var(--on-surf-var)",
                  fontFamily: "var(--font-body)",
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                }}
              >
                {FORMA_LABELS[data.formaPagoProveedor] ?? data.formaPagoProveedor}
              </span>
            </div>

            {data.notas && (
              <p
                style={{
                  fontSize: "0.75rem",
                  color: "var(--on-surf-var)",
                  fontFamily: "var(--font-body)",
                  fontStyle: "italic",
                }}
              >
                {data.notas}
              </p>
            )}
          </div>

          {/* Right: amounts + dates */}
          <div className="space-y-2">
            <DataRow label="Total pagado" value={formatMXN(data.totalPagado)} bold />
            <DataRow
              label="Fecha de recepción"
              value={formatDate(data.createdAt)}
            />
            {data.fechaPago && (
              <DataRow
                label="Fecha de pago"
                value={formatDate(data.fechaPago)}
              />
            )}
            {data.fechaVencimiento && (
              <DataRow
                label="Vence"
                value={formatDate(data.fechaVencimiento)}
                valueColor={
                  vencDays !== null
                    ? vencDays < 0
                      ? "var(--ter)"
                      : vencDays <= 7
                      ? "var(--warn)"
                      : undefined
                    : undefined
                }
              />
            )}
            <DataRow label="Sucursal" value={data.branch.name} />
            <DataRow
              label="Registró"
              value={data.registeredBy.name ?? "—"}
            />
          </div>
        </div>
      </SectionCard>

      {/* ── 2. Líneas ────────────────────────────────────────────────────────── */}
      {(data.variantLines.length > 0 ||
        data.simpleLines.length > 0 ||
        data.batteryLots.length > 0) && (
        <SectionCard title="Líneas de la recepción">
          {data.variantLines.length > 0 && (
            <>
              <p
                style={{
                  fontSize: "0.7rem",
                  fontWeight: 600,
                  color: "var(--on-surf-var)",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  fontFamily: "var(--font-body)",
                  marginBottom: "0.5rem",
                }}
              >
                Vehículos / Variantes
              </p>
              <LinesTable
                headers={["Descripción", "SKU", "Cant.", "Precio unit.", "Subtotal"]}
                rows={data.variantLines.map((l) => {
                  const p =
                    l.precioUnitarioPagado !== null
                      ? parseFloat(l.precioUnitarioPagado)
                      : null;
                  return [
                    l.descripcion,
                    <span
                      key="sku"
                      style={{ fontFamily: "var(--font-body)", fontSize: "0.7rem", color: "var(--on-surf-var)" }}
                    >
                      {l.sku}
                    </span>,
                    l.quantity,
                    p !== null ? formatMXN(p) : "—",
                    p !== null ? formatMXN(p * l.quantity) : "—",
                  ];
                })}
                subtotal={variantSubtotal}
              />
            </>
          )}

          {data.simpleLines.length > 0 && (
            <>
              <p
                style={{
                  fontSize: "0.7rem",
                  fontWeight: 600,
                  color: "var(--on-surf-var)",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  fontFamily: "var(--font-body)",
                  marginBottom: "0.5rem",
                  marginTop: data.variantLines.length > 0 ? "1rem" : 0,
                }}
              >
                Productos simples
              </p>
              <LinesTable
                headers={["Nombre", "Categoría", "Cant.", "Precio unit.", "Subtotal"]}
                rows={data.simpleLines.map((l) => {
                  const p =
                    l.precioUnitarioPagado !== null
                      ? parseFloat(l.precioUnitarioPagado)
                      : null;
                  return [
                    `${l.nombre} (${l.codigo})`,
                    l.categoria,
                    l.quantity,
                    p !== null ? formatMXN(p) : "—",
                    p !== null ? formatMXN(p * l.quantity) : "—",
                  ];
                })}
                subtotal={simpleSubtotal}
              />
            </>
          )}

          {data.batteryLots.length > 0 && (
            <>
              <p
                style={{
                  fontSize: "0.7rem",
                  fontWeight: 600,
                  color: "var(--on-surf-var)",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  fontFamily: "var(--font-body)",
                  marginBottom: "0.5rem",
                  marginTop:
                    data.variantLines.length > 0 || data.simpleLines.length > 0
                      ? "1rem"
                      : 0,
                }}
              >
                Lotes de baterías
              </p>
              <LinesTable
                headers={["Modelo", "SKU", "Baterías", "Recibido", "Subtotal"]}
                rows={data.batteryLots.map((l) => [
                  l.modelo,
                  l.sku,
                  l.totalBaterias,
                  formatDate(l.receivedAt),
                  "—",
                ])}
                subtotal={0}
              />
            </>
          )}

          {/* Grand total */}
          <div
            className="flex items-center justify-end gap-4 mt-2 pt-3"
            style={{ borderTop: "1px solid var(--ghost-border)" }}
          >
            <span
              style={{
                fontSize: "0.75rem",
                color: "var(--on-surf-var)",
                fontFamily: "var(--font-body)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Total registrado
            </span>
            <span
              style={{
                fontSize: "1.125rem",
                fontWeight: 700,
                color: "var(--on-surf)",
                fontFamily: "var(--font-display)",
              }}
            >
              {formatMXN(data.totalPagado)}
            </span>
          </div>
        </SectionCard>
      )}

      {/* ── 2b. Acoplamiento batería → vehículo (S3) ────────────────────────── */}
      {data.assemblyGroups.length > 0 && (
        <SectionCard title="Ensamblajes programados">
          <div className="space-y-3">
            {data.assemblyGroups.map((g) => (
              <div
                key={g.variantSku}
                style={{
                  background: "var(--surf-low)",
                  borderRadius: "var(--r-lg)",
                  padding: "0.75rem 0.9rem",
                }}
              >
                <div className="flex items-baseline justify-between mb-2">
                  <span
                    style={{
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      color: "var(--on-surf)",
                      fontFamily: "var(--font-body)",
                    }}
                  >
                    {g.vehicleDesc}
                  </span>
                  <span
                    style={{
                      fontSize: "0.65rem",
                      color: "var(--on-surf-var)",
                      fontFamily: "var(--font-body)",
                    }}
                  >
                    {g.variantSku} · {g.units.length} unidad{g.units.length > 1 ? "es" : ""}
                  </span>
                </div>
                <div className="space-y-1.5">
                  {g.units.map((u, idx) => (
                    <div
                      key={u.orderId}
                      className="flex items-center gap-3"
                      style={{
                        fontSize: "0.72rem",
                        fontFamily: "var(--font-body)",
                        color: "var(--on-surf)",
                      }}
                    >
                      <span
                        style={{
                          color: "var(--on-surf-var)",
                          letterSpacing: "0.04em",
                          minWidth: 60,
                        }}
                      >
                        Unidad {idx + 1}
                      </span>
                      <span
                        style={{
                          color: u.configLabel ? "var(--on-surf)" : "var(--on-surf-var)",
                          minWidth: 100,
                        }}
                      >
                        {u.configLabel ?? "Config pendiente"}
                      </span>
                      <span
                        style={{
                          flex: 1,
                          color: u.serials.length > 0 ? "var(--on-surf)" : "var(--on-surf-var)",
                          fontFamily: u.serials.length > 0 ? "monospace" : "var(--font-body)",
                          fontSize: u.serials.length > 0 ? "0.7rem" : "0.7rem",
                        }}
                      >
                        {u.serials.length > 0
                          ? u.serials.join(", ")
                          : "Batería pendiente"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* ── 3. Factura ───────────────────────────────────────────────────────── */}
      <FacturaSection receiptId={data.id} facturaUrl={data.facturaUrl} />

      {/* ── 4. Acciones ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap">
        <Link
          href="/inventario/recepciones"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium"
          style={{
            background: "var(--surf-high)",
            color: "var(--on-surf-var)",
            textDecoration: "none",
            fontFamily: "var(--font-body)",
          }}
        >
          <ArrowLeft className="h-4 w-4" />
          Volver al listado
        </Link>

        {data.estadoPago !== "PAGADA" && (
          <button
            type="button"
            disabled={paying}
            onClick={handleMarcarPagada}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold"
            style={{
              background: paying
                ? "var(--surf-high)"
                : "var(--velocity-gradient)",
              color: paying ? "var(--on-surf-var)" : "#ffffff",
              border: "none",
              cursor: paying ? "not-allowed" : "pointer",
              fontFamily: "var(--font-body)",
              opacity: paying ? 0.7 : 1,
            }}
          >
            <FileText className="h-4 w-4" />
            {paying ? "Registrando…" : "Marcar como pagada"}
          </button>
        )}
      </div>

      {/* Padding bottom on mobile */}
      <div className="h-4" />
    </div>
  );
}

// ── DataRow helper ────────────────────────────────────────────────────────────

function DataRow({
  label,
  value,
  bold,
  valueColor,
}: {
  label: string;
  value: string;
  bold?: boolean;
  valueColor?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span
        style={{
          fontSize: "0.7rem",
          color: "var(--on-surf-var)",
          fontFamily: "var(--font-body)",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: "0.75rem",
          fontWeight: bold ? 700 : 400,
          color: valueColor ?? "var(--on-surf)",
          fontFamily: bold ? "var(--font-display)" : "var(--font-body)",
          textAlign: "right",
        }}
      >
        {value}
      </span>
    </div>
  );
}
