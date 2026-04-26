"use client";

// Wizard de fusión MANAGER+ (BRIEF §7.5).
// Flujo: 1) buscar destino vía /api/customers/search 2) preview FKs vía
// /api/customers/[id]/merge-preview 3) confirm → POST merge-into → redirect.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Icon } from "@/components/primitives/icon";
import { Chip } from "@/components/primitives/chip";
import { formatMXN } from "@/lib/format";
import { formatPhoneDisplay } from "@/lib/customers/phone";
import { useRegisterBreadcrumbLabel } from "@/lib/breadcrumbs/client-store";

interface CustomerSummary {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  rfc: string | null;
  isBusiness: boolean;
  razonSocial: string | null;
  balance: number;
  creditLimit: number;
}

interface SearchHit {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  rfc: string | null;
  source: string;
  hint?: string;
}

interface PreviewResponse {
  source: CustomerSummary;
  target: CustomerSummary;
  blocker: string | null;
  counts: {
    sales: number;
    serviceOrders: number;
    quotations: number;
    cashTransactions: number;
    bikes: number;
    notes: number;
    editLogs: number;
  };
}

interface Props {
  source: CustomerSummary;
}

export function MergeWizard({ source }: Props): React.JSX.Element {
  const router = useRouter();

  useRegisterBreadcrumbLabel(`/customers/${source.id}`, source.name);

  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [targetId, setTargetId] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Search debounce.
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setHits([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `/api/customers/search?q=${encodeURIComponent(trimmed)}&limit=10`,
        );
        const json = (await res.json()) as { success: boolean; data?: SearchHit[] };
        if (json.success && json.data) {
          setHits(json.data.filter((h) => h.id !== source.id));
        }
      } catch {
        toast.error("Error de búsqueda");
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [query, source.id]);

  // Cargar preview cuando cambia targetId.
  useEffect(() => {
    if (!targetId) {
      setPreview(null);
      return;
    }
    let cancelled = false;
    setPreviewLoading(true);
    (async () => {
      try {
        const res = await fetch(
          `/api/customers/${source.id}/merge-preview?targetId=${encodeURIComponent(
            targetId,
          )}`,
        );
        const json = (await res.json()) as { success: boolean; data?: PreviewResponse; error?: string };
        if (!cancelled) {
          if (json.success && json.data) {
            setPreview(json.data);
          } else {
            toast.error(json.error ?? "No se pudo cargar la previsualización");
            setPreview(null);
          }
        }
      } catch {
        if (!cancelled) toast.error("Error de red");
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [targetId, source.id]);

  const submitMerge = async (): Promise<void> => {
    if (!preview || preview.blocker) return;
    if (
      !confirm(
        `¿Fusionar "${source.name}" hacia "${preview.target.name}"? Esta acción reasigna todas las ventas, órdenes y movimientos al destino. Se puede deshacer dentro de 30 días.`,
      )
    ) {
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/customers/${source.id}/merge-into`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetId: preview.target.id }),
      });
      const json = (await res.json()) as { success: boolean; error?: string };
      if (json.success) {
        toast.success("Fusión completada");
        router.replace(`/customers/${preview.target.id}`);
        router.refresh();
      } else {
        toast.error(json.error ?? "No se pudo completar la fusión");
      }
    } catch {
      toast.error("Error de red");
    } finally {
      setSubmitting(false);
    }
  };

  const totalRows = preview
    ? preview.counts.sales +
      preview.counts.serviceOrders +
      preview.counts.quotations +
      preview.counts.cashTransactions +
      preview.counts.bikes +
      preview.counts.notes +
      preview.counts.editLogs
    : 0;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <Link
        href={`/customers/${source.id}`}
        className="inline-flex items-center gap-1.5 text-xs font-medium"
        style={{ color: "var(--on-surf-var)" }}
      >
        <Icon name="chevronLeft" size={13} />
        Volver al perfil
      </Link>

      <header className="flex flex-col gap-1">
        <h1
          className="text-2xl font-bold tracking-[-0.01em]"
          style={{ fontFamily: "var(--font-display)", color: "var(--on-surf)" }}
        >
          Fusionar cliente
        </h1>
        <p className="text-sm" style={{ color: "var(--on-surf-var)" }}>
          Reasigna toda la actividad histórica de un cliente origen hacia un
          destino consolidado. La operación se puede deshacer dentro de los
          siguientes 30 días desde la pestaña Datos del cliente destino.
        </p>
      </header>

      <div className="grid grid-cols-2 max-[800px]:grid-cols-1 gap-4">
        <CustomerCard label="Origen (se fusionará)" customer={source} accent="warn" />
        <div
          className="rounded-[var(--r-lg)] p-5 flex flex-col gap-3"
          style={{ background: "var(--surf-lowest)" }}
        >
          <header className="flex items-center justify-between">
            <span
              className="text-[0.625rem] uppercase tracking-[0.05em] font-medium"
              style={{ color: "var(--on-surf-var)" }}
            >
              Destino
            </span>
            {preview?.target && (
              <button
                onClick={() => {
                  setTargetId(null);
                  setPreview(null);
                  setQuery("");
                }}
                className="text-[0.6875rem] underline"
                style={{ color: "var(--p)" }}
              >
                Cambiar destino
              </button>
            )}
          </header>

          {!targetId ? (
            <>
              <div className="relative">
                <Icon
                  name="search"
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2"
                />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar cliente destino por nombre, teléfono, RFC…"
                  className="w-full pl-9 pr-3 py-2.5 text-sm outline-none"
                  style={{
                    background: "var(--surf-low)",
                    border: "none",
                    borderRadius: "var(--r-lg)",
                    color: "var(--on-surf)",
                    fontFamily: "var(--font-body)",
                  }}
                />
              </div>
              <div className="flex flex-col gap-1.5 min-h-[120px]">
                {searching && (
                  <p className="text-xs py-3 text-center" style={{ color: "var(--on-surf-var)" }}>
                    Buscando…
                  </p>
                )}
                {!searching && query.trim().length >= 2 && hits.length === 0 && (
                  <p className="text-xs py-3 text-center" style={{ color: "var(--on-surf-var)" }}>
                    Sin resultados.
                  </p>
                )}
                {hits.map((h) => (
                  <button
                    key={h.id}
                    onClick={() => setTargetId(h.id)}
                    className="text-left px-3 py-2 rounded-[var(--r-md)] hover:bg-[var(--surf-high)] transition-colors"
                    style={{ background: "var(--surf-low)" }}
                  >
                    <div className="text-sm font-semibold" style={{ color: "var(--on-surf)" }}>
                      {h.name}
                    </div>
                    <div
                      className="text-[0.6875rem] flex items-center gap-2 mt-0.5"
                      style={{ color: "var(--on-surf-var)" }}
                    >
                      {h.phone && <span>{formatPhoneDisplay(h.phone)}</span>}
                      {h.rfc && <span className="font-mono">{h.rfc}</span>}
                      {h.email && <span className="truncate">{h.email}</span>}
                    </div>
                  </button>
                ))}
              </div>
            </>
          ) : preview?.target ? (
            <CustomerCard label="" customer={preview.target} accent="success" inline />
          ) : (
            <p className="text-xs py-3 text-center" style={{ color: "var(--on-surf-var)" }}>
              Cargando…
            </p>
          )}
        </div>
      </div>

      {targetId && (
        <section
          className="rounded-[var(--r-lg)] p-5 flex flex-col gap-4"
          style={{ background: "var(--surf-lowest)" }}
        >
          <header className="flex flex-col gap-1">
            <h2
              className="text-base font-semibold tracking-[-0.01em]"
              style={{ fontFamily: "var(--font-display)", color: "var(--on-surf)" }}
            >
              Lo que se reasignará
            </h2>
            <p className="text-xs" style={{ color: "var(--on-surf-var)" }}>
              Estos registros pasarán del cliente origen al cliente destino.
            </p>
          </header>

          {previewLoading && (
            <p className="text-xs py-4 text-center" style={{ color: "var(--on-surf-var)" }}>
              Calculando…
            </p>
          )}

          {preview && !previewLoading && (
            <>
              {preview.blocker && (
                <div
                  className="px-4 py-3 rounded-[var(--r-md)]"
                  style={{ background: "var(--ter-container)", color: "var(--on-ter-container)" }}
                >
                  <p className="text-sm font-semibold flex items-center gap-2">
                    <Icon name="alert" size={14} />
                    Esta fusión no puede ejecutarse
                  </p>
                  <p className="text-xs mt-1">{preview.blocker}</p>
                </div>
              )}

              <div className="grid grid-cols-3 max-[600px]:grid-cols-2 gap-2">
                <CountTile label="Ventas" count={preview.counts.sales} />
                <CountTile label="Órdenes de taller" count={preview.counts.serviceOrders} />
                <CountTile label="Cotizaciones" count={preview.counts.quotations} />
                <CountTile label="Movimientos de caja" count={preview.counts.cashTransactions} />
                <CountTile label="Bicis" count={preview.counts.bikes} />
                <CountTile label="Notas" count={preview.counts.notes} />
                <CountTile label="Logs de edición" count={preview.counts.editLogs} />
              </div>

              <div
                className="flex items-center justify-between rounded-[var(--r-md)] px-4 py-3 mt-2"
                style={{ background: "var(--surf-low)" }}
              >
                <span className="text-xs font-semibold" style={{ color: "var(--on-surf)" }}>
                  Total de filas a mover
                </span>
                <span
                  className="text-base font-bold tabular-nums"
                  style={{ color: "var(--on-surf)", fontFamily: "var(--font-display)" }}
                >
                  {totalRows.toLocaleString("es-MX")}
                </span>
              </div>

              {preview.source.balance > 0 && (
                <p className="text-xs" style={{ color: "var(--on-surf-var)" }}>
                  El saldo a favor de origen ({formatMXN(preview.source.balance)}) se sumará
                  al saldo del destino.
                </p>
              )}
            </>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Link
              href={`/customers/${source.id}`}
              className="px-4 py-2 text-sm font-semibold"
              style={{
                borderRadius: "var(--r-full)",
                border: "1.5px solid color-mix(in srgb, var(--p) 25%, transparent)",
                background: "transparent",
                color: "var(--p)",
                fontFamily: "var(--font-display)",
              }}
            >
              Cancelar
            </Link>
            <button
              onClick={() => void submitMerge()}
              disabled={submitting || !preview || !!preview?.blocker || previewLoading}
              className="px-5 py-2 text-sm font-semibold disabled:opacity-50"
              style={{
                borderRadius: "var(--r-full)",
                background: "var(--velocity-gradient)",
                color: "var(--on-p)",
                fontFamily: "var(--font-display)",
                border: "none",
              }}
            >
              {submitting ? "Fusionando…" : "Fusionar clientes"}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

function CustomerCard({
  label,
  customer,
  accent,
  inline,
}: {
  label: string;
  customer: CustomerSummary;
  accent: "warn" | "success";
  inline?: boolean;
}): React.JSX.Element {
  const wrapperBg = accent === "warn" ? "var(--ter-container)" : "var(--sec-container)";
  const wrapperFg = accent === "warn" ? "var(--on-ter-container)" : "var(--on-sec-container)";

  return (
    <div
      className={inline ? "flex flex-col gap-3" : "rounded-[var(--r-lg)] p-5 flex flex-col gap-3"}
      style={inline ? undefined : { background: "var(--surf-lowest)" }}
    >
      {label && (
        <div className="flex items-center justify-between">
          <span
            className="text-[0.625rem] uppercase tracking-[0.05em] font-medium"
            style={{ color: "var(--on-surf-var)" }}
          >
            {label}
          </span>
          <Chip
            variant={accent === "warn" ? "warn" : "success"}
            label={accent === "warn" ? "Se descontinuará" : "Recibirá la actividad"}
          />
        </div>
      )}
      <div
        className="rounded-[var(--r-md)] p-4 flex flex-col gap-2"
        style={{ background: wrapperBg, color: wrapperFg }}
      >
        <div
          className="text-base font-bold"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {customer.name}
        </div>
        <div className="text-xs flex flex-wrap items-center gap-x-3 gap-y-1">
          {customer.phone && <span>{formatPhoneDisplay(customer.phone)}</span>}
          {customer.email && <span className="truncate">{customer.email}</span>}
          {customer.rfc && <span className="font-mono">{customer.rfc}</span>}
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span>
            Saldo a favor:{" "}
            <strong className="tabular-nums">{formatMXN(customer.balance)}</strong>
          </span>
          <span>
            Crédito:{" "}
            <strong className="tabular-nums">{formatMXN(customer.creditLimit)}</strong>
          </span>
          {customer.isBusiness && <Chip variant="info" label="Empresa" />}
        </div>
      </div>
    </div>
  );
}

function CountTile({ label, count }: { label: string; count: number }): React.JSX.Element {
  return (
    <div
      className="rounded-[var(--r-md)] p-3 flex flex-col gap-0.5"
      style={{ background: "var(--surf-low)" }}
    >
      <span
        className="text-[0.625rem] uppercase tracking-[0.05em] font-medium"
        style={{ color: "var(--on-surf-var)" }}
      >
        {label}
      </span>
      <span
        className="text-lg font-bold tabular-nums"
        style={{ color: "var(--on-surf)", fontFamily: "var(--font-display)" }}
      >
        {count.toLocaleString("es-MX")}
      </span>
    </div>
  );
}
