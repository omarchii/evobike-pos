"use client";

// Directorio de Clientes (BRIEF §7.2 — Sub-fase C).
// Patrón: server component pasa rows + stats ya enriquecidas; este cliente
// maneja URL params (search/chip/page), bulk selection, acciones rápidas
// (WhatsApp deep-link, copiar teléfono), modal de exportación CSV y modal de
// lista WhatsApp con filtro por consentimiento.

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { KpiGrid, type KpiSpec } from "@/components/reportes/shell/kpi-grid";
import { Chip } from "@/components/primitives/chip";
import { Icon } from "@/components/primitives/icon";
import { formatMXN, formatRelative } from "@/lib/format";
import { formatPhoneDisplay, formatPhoneForWhatsApp } from "@/lib/customers/phone";
import { SEGMENT_LABELS, SEGMENT_TOOLTIPS, type SegmentChip } from "@/lib/customers/segmentation";
import type { DirectoryCustomerRow, DirectoryStats } from "@/lib/customers/directory-query";

interface ViewProps {
  rows: DirectoryCustomerRow[];
  total: number;
  stats: DirectoryStats;
  page: number;
  pageSize: number;
  filters: {
    q: string;
    chip: string | null;
    showDeleted: boolean;
  };
  canSeeDeleted: boolean;
  role: string;
}

type ChipKey = "activos" | "con-saldo" | "empresas" | "riesgo" | "inactivos" | "sin-consent";

const QUICK_CHIPS: Array<{ key: ChipKey | null; label: string }> = [
  { key: null, label: "Todos" },
  { key: "activos", label: "Activos 90d" },
  { key: "con-saldo", label: "Con saldo por cobrar" },
  { key: "riesgo", label: "En riesgo (90–180d)" },
  { key: "inactivos", label: "Inactivos +180d" },
  { key: "empresas", label: "Empresas" },
  { key: "sin-consent", label: "Sin consent." },
];

const CHIP_VARIANT: Partial<Record<SegmentChip, "neutral" | "success" | "warn" | "error" | "info">> = {
  EMPRESA: "info",
  FRECUENTE: "success",
  EN_RIESGO: "warn",
  INACTIVO: "neutral",
  SALDO_SIN_USAR: "info",
  SIN_CONSENTIMIENTO: "neutral",
  CON_SALDO_POR_COBRAR: "warn",
};

export function CustomerDirectoryView({
  rows,
  total,
  stats,
  page,
  pageSize,
  filters,
  canSeeDeleted,
  role: _role,
}: ViewProps): React.JSX.Element {
  void _role;
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const [searchInput, setSearchInput] = useState(filters.q);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [waModalOpen, setWaModalOpen] = useState(false);

  const updateParams = (patch: Record<string, string | null>): void => {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value === "") next.delete(key);
      else next.set(key, value);
    }
    // Al cambiar filtros, volver a la página 1.
    if (!("page" in patch)) next.delete("page");
    startTransition(() => {
      router.replace(`/customers?${next.toString()}`);
    });
  };

  // Debounce simple para la búsqueda omni.
  const [searchTimeout, setSearchTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);
  const handleSearchChange = (value: string): void => {
    setSearchInput(value);
    if (searchTimeout) clearTimeout(searchTimeout);
    const t = setTimeout(() => {
      updateParams({ q: value.trim() || null });
    }, 250);
    setSearchTimeout(t);
  };

  const handleChip = (chip: ChipKey | null): void => {
    updateParams({ chip: chip ?? null });
  };

  const toggleSelect = (id: string): void => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleSelectAll = (): void => {
    if (selectedIds.size === rows.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(rows.map((r) => r.id)));
  };

  const handleExportCSV = (): void => {
    const source = selectedIds.size > 0 ? rows.filter((r) => selectedIds.has(r.id)) : rows;
    if (source.length === 0) {
      toast.info("Sin clientes para exportar");
      return;
    }
    const header = [
      "id",
      "nombre",
      "telefono",
      "email",
      "rfc",
      "empresa",
      "ciudad",
      "estado",
      "bicis",
      "ltv",
      "saldo",
      "saldo_por_cobrar",
      "ultima_actividad",
      "consentimiento",
    ];
    const csv = [
      header.join(","),
      ...source.map((r) =>
        [
          r.id,
          r.name.replaceAll('"', '""'),
          r.phone ?? "",
          r.email ?? "",
          r.rfc ?? "",
          r.isBusiness ? "sí" : "no",
          r.shippingCity ?? "",
          r.shippingState ?? "",
          r.bikesCount,
          r.ltv.toFixed(2),
          r.balance.toFixed(2),
          r.arPending.toFixed(2),
          r.lastActivityAt ? r.lastActivityAt.toISOString() : "",
          r.communicationConsent ? "sí" : "no",
        ]
          .map((v) => (typeof v === "string" && v.includes(",") ? `"${v}"` : String(v)))
          .join(","),
      ),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `clientes_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exportados ${source.length} clientes`);
  };

  const copyPhone = async (phone: string | null): Promise<void> => {
    if (!phone) return;
    try {
      await navigator.clipboard.writeText(phone);
      toast.success(`Teléfono copiado: ${formatPhoneDisplay(phone)}`);
    } catch {
      toast.error("No se pudo copiar");
    }
  };

  const kpis = useMemo<KpiSpec[]>(
    () => [
      {
        key: "customersTotal",
        label: "Clientes totales",
        value: String(stats.customersTotal),
      },
      {
        key: "ltv",
        label: "LTV acumulado",
        value: formatMXN(stats.ltvAccumulated, { compact: true }),
        featured: true,
      },
      {
        key: "avgTicket",
        label: "Ticket promedio",
        value: formatMXN(stats.averageTicket),
      },
      {
        key: "ar",
        label: "Saldo por cobrar",
        value: formatMXN(stats.accountsReceivableTotal, { compact: true }),
      },
    ],
    [stats],
  );

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const selectedRows = rows.filter((r) => selectedIds.has(r.id));
  const selectedWithConsent = selectedRows.filter((r) => r.communicationConsent && r.phone);
  const selectedWithoutConsent = selectedRows.filter((r) => !r.communicationConsent || !r.phone);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Link
          href="/customers/new"
          className="inline-flex items-center gap-1.5 px-5 py-2.5 text-sm font-semibold"
          style={{
            fontFamily: "var(--font-display)",
            color: "var(--on-p)",
            borderRadius: "var(--r-full)",
            background: "var(--velocity-gradient)",
            boxShadow: "0px 8px 24px -4px rgba(46,204,113,0.35)",
          }}
        >
          <Icon name="plus" size={16} /> Nuevo cliente
        </Link>

        <div className="flex items-center gap-2 flex-wrap">
          {canSeeDeleted && (
            <button
              onClick={() => updateParams({ showDeleted: filters.showDeleted ? null : "1" })}
              className="flex items-center gap-1.5 rounded-[var(--r-full)] px-3 py-1.5 text-xs font-medium transition-colors"
              style={{
                background: filters.showDeleted ? "var(--surf-highest)" : "var(--surf-high)",
                color: "var(--on-surf)",
              }}
            >
              <Icon name={filters.showDeleted ? "eye" : "eyeOff"} size={13} />
              {filters.showDeleted ? "Incluyendo eliminados" : "Mostrar eliminados"}
            </button>
          )}
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 rounded-[var(--r-full)] px-3 py-1.5 text-xs font-medium transition-colors"
            style={{ background: "var(--surf-high)", color: "var(--on-surf)" }}
          >
            <Icon name="export" size={13} />
            Exportar
          </button>
        </div>
      </div>

      <KpiGrid kpis={kpis} />

      {/* Omni-search + quick chips */}
      <div
        className="rounded-[var(--r-lg)] p-4 flex flex-col gap-3"
        style={{ background: "var(--surf-lowest)" }}
      >
        <div className="relative">
          <Icon
            name="search"
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2"
          />
          <input
            type="search"
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Buscar por nombre, teléfono, email, VIN, RFC o folio…"
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

        <div className="flex flex-wrap items-center gap-2">
          {QUICK_CHIPS.map((c) => {
            const active = filters.chip === c.key || (c.key === null && filters.chip === null);
            return (
              <button
                key={c.label}
                onClick={() => handleChip(c.key)}
                className="rounded-[var(--r-full)] px-3 py-1.5 text-xs font-medium transition-colors"
                style={{
                  background: active ? "var(--p-container)" : "var(--surf-high)",
                  color: active ? "var(--on-p-container)" : "var(--on-surf-var)",
                  fontWeight: active ? 600 : 500,
                }}
              >
                {c.label}
              </button>
            );
          })}
          <span
            className="ml-auto text-xs tabular-nums"
            style={{ color: "var(--on-surf-var)" }}
          >
            {total} resultado{total === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      {/* Bulk actions bar — aparece solo con selección */}
      {selectedIds.size > 0 && (
        <div
          className="flex items-center gap-3 px-4 py-2.5 rounded-[var(--r-lg)]"
          style={{ background: "var(--p-container)", color: "var(--on-p-container)" }}
        >
          <span className="text-xs font-semibold">
            {selectedIds.size} seleccionado{selectedIds.size === 1 ? "" : "s"}
          </span>
          <div className="flex-1" />
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 rounded-[var(--r-full)] px-3 py-1.5 text-xs font-medium"
            style={{ background: "var(--surf-bright)", color: "var(--on-surf)" }}
          >
            <Icon name="download" size={13} /> Exportar CSV
          </button>
          <button
            onClick={() => setWaModalOpen(true)}
            className="flex items-center gap-1.5 rounded-[var(--r-full)] px-3 py-1.5 text-xs font-medium"
            style={{ background: "var(--surf-bright)", color: "var(--on-surf)" }}
          >
            Lista WhatsApp
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="rounded-[var(--r-full)] px-3 py-1.5 text-xs font-medium"
            style={{ background: "transparent", color: "var(--on-p-container)" }}
          >
            Limpiar
          </button>
        </div>
      )}

      {/* Power Grid */}
      <div
        className="rounded-[var(--r-lg)] overflow-hidden"
        style={{ background: "var(--surf-lowest)" }}
      >
        <div
          className="px-4 py-2.5 text-[0.6875rem] uppercase tracking-[0.05em] grid items-center gap-x-4"
          style={{
            gridTemplateColumns: "32px 2fr 1.2fr 80px 1fr 0.9fr 1fr 1.3fr 56px",
            color: "var(--on-surf-var)",
            background: "var(--surf-low)",
            fontWeight: 500,
          }}
        >
          <input
            type="checkbox"
            checked={rows.length > 0 && selectedIds.size === rows.length}
            onChange={toggleSelectAll}
            aria-label="Seleccionar todos"
          />
          <span>Cliente</span>
          <span>Ciudad</span>
          <span className="text-center">Bicis</span>
          <span className="text-center">Última compra</span>
          <span className="text-center">LTV</span>
          <span className="text-center">Saldo</span>
          <span>Alertas</span>
          <span className="text-center">Acciones</span>
        </div>

        {rows.length === 0 ? (
          <div className="p-10 text-center text-sm" style={{ color: "var(--on-surf-var)" }}>
            No se encontraron clientes con los filtros actuales.
          </div>
        ) : (
          rows.map((r) => <DirectoryRow key={r.id} row={r} selected={selectedIds.has(r.id)} onToggle={() => toggleSelect(r.id)} onCopyPhone={() => copyPhone(r.phone)} />)
        )}
      </div>

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-2">
          <span className="text-xs" style={{ color: "var(--on-surf-var)" }}>
            Página {page} de {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => updateParams({ page: String(page - 1) })}
              className="rounded-[var(--r-full)] px-3 py-1.5 text-xs font-medium disabled:opacity-40"
              style={{ background: "var(--surf-high)", color: "var(--on-surf)" }}
            >
              Anterior
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => updateParams({ page: String(page + 1) })}
              className="rounded-[var(--r-full)] px-3 py-1.5 text-xs font-medium disabled:opacity-40"
              style={{ background: "var(--surf-high)", color: "var(--on-surf)" }}
            >
              Siguiente
            </button>
          </div>
        </div>
      )}

      {waModalOpen && (
        <WhatsAppListModal
          withConsent={selectedWithConsent}
          withoutConsent={selectedWithoutConsent}
          onClose={() => setWaModalOpen(false)}
        />
      )}
    </div>
  );
}

function DirectoryRow({
  row,
  selected,
  onToggle,
  onCopyPhone,
}: {
  row: DirectoryCustomerRow;
  selected: boolean;
  onToggle: () => void;
  onCopyPhone: () => void;
}): React.JSX.Element {
  const waUrl = useMemo(() => {
    const num = formatPhoneForWhatsApp(row.phone);
    return num ? `https://wa.me/${num}` : null;
  }, [row.phone]);

  const alertChips = row.chips.slice(0, 2);
  const overflow = row.chips.length - alertChips.length;

  return (
    <div
      className="px-4 py-3 grid items-center text-sm border-t gap-x-4"
      style={{
        gridTemplateColumns: "32px 2fr 1.2fr 80px 1fr 0.9fr 1fr 1.3fr 56px",
        borderColor: "var(--surf-low)",
        color: "var(--on-surf)",
      }}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggle}
        aria-label={`Seleccionar ${row.name}`}
      />
      <div className="flex items-center gap-2 min-w-0">
        <div
          className="h-8 w-8 rounded-full flex items-center justify-center shrink-0"
          style={{ background: "var(--surf-high)", color: "var(--on-surf-var)" }}
        >
          <Icon name="user" size={14} />
        </div>
        <div className="min-w-0">
          <Link
            href={`/customers/${row.id}`}
            className="block truncate font-semibold hover:underline"
            style={{ color: "var(--p)" }}
          >
            {row.name}
            {row.deletedAt && (
              <span className="ml-2">
                <Chip variant="neutral" label="Eliminado" />
              </span>
            )}
            {row.profileIncomplete && !row.deletedAt && (
              <span
                className="ml-2"
                title="Cliente creado en POS sin email, RFC ni dirección — completa el perfil cuando puedas."
              >
                <Chip variant="warn" label="Perfil incompleto" />
              </span>
            )}
          </Link>
          <div className="flex items-center gap-2 text-[0.6875rem]" style={{ color: "var(--on-surf-var)" }}>
            {row.phone && (
              <button onClick={onCopyPhone} className="hover:underline" title="Copiar teléfono">
                {formatPhoneDisplay(row.phone)}
              </button>
            )}
          </div>
        </div>
      </div>
      <div className="text-xs truncate" style={{ color: "var(--on-surf-var)" }}>
        {row.shippingCity ? `${row.shippingCity}${row.shippingState ? `, ${row.shippingState}` : ""}` : "—"}
      </div>
      <div className="flex items-center justify-center gap-1 text-xs" style={{ color: "var(--on-surf-var)" }}>
        <Icon name="bike" size={13} />
        {row.bikesCount}
      </div>
      <div className="text-center text-xs" style={{ color: "var(--on-surf-var)" }}>
        {row.lastSaleAt ? formatRelative(row.lastSaleAt) : "—"}
      </div>
      <div className="text-center tabular-nums font-semibold">{formatMXN(row.ltv)}</div>
      <div className="text-center tabular-nums">
        <span>{formatMXN(row.balance)}</span>
        {row.arPending > 0 && (
          <div className="mt-0.5 flex justify-center">
            <Chip variant="warn" label={`Por cobrar ${formatMXN(row.arPending, { compact: true })}`} />
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-1 min-w-0">
        {alertChips.map((chip) => (
          <span key={chip} title={SEGMENT_TOOLTIPS[chip]}>
            <Chip variant={CHIP_VARIANT[chip] ?? "neutral"} label={SEGMENT_LABELS[chip]} />
          </span>
        ))}
        {overflow > 0 && (
          <span
            className="text-[0.625rem] font-medium"
            style={{ color: "var(--on-surf-var)" }}
            title={row.chips.slice(2).map((c) => SEGMENT_LABELS[c]).join(" · ")}
          >
            +{overflow}
          </span>
        )}
      </div>
      <div className="flex items-center justify-center">
        {waUrl && (
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="h-7 w-7 rounded-full flex items-center justify-center"
            style={{ background: "var(--surf-high)", color: "var(--on-surf)" }}
            title="WhatsApp"
          >
            <Icon name="share" size={13} />
          </a>
        )}
      </div>
    </div>
  );
}

function WhatsAppListModal({
  withConsent,
  withoutConsent,
  onClose,
}: {
  withConsent: DirectoryCustomerRow[];
  withoutConsent: DirectoryCustomerRow[];
  onClose: () => void;
}): React.JSX.Element {
  const [showOmitted, setShowOmitted] = useState(false);

  const copyNumbers = async (): Promise<void> => {
    if (withConsent.length === 0) {
      toast.info("Sin clientes con consentimiento para copiar");
      return;
    }
    const numbers = withConsent
      .map((r) => formatPhoneForWhatsApp(r.phone))
      .filter((n): n is string => !!n)
      .join("\n");
    await navigator.clipboard.writeText(numbers);
    toast.success(`${withConsent.length} números copiados`);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.45)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md p-6 flex flex-col gap-4"
        style={{
          background: "color-mix(in srgb, var(--surf-bright) 88%, transparent)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderRadius: "var(--r-xl)",
          boxShadow: "var(--shadow)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2
            className="text-lg font-bold"
            style={{ fontFamily: "var(--font-display)", color: "var(--on-surf)" }}
          >
            Lista WhatsApp
          </h2>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-full flex items-center justify-center"
            style={{ background: "var(--surf-high)", color: "var(--on-surf-var)" }}
            aria-label="Cerrar"
          >
            <Icon name="close" size={14} />
          </button>
        </div>
        <p className="text-sm" style={{ color: "var(--on-surf-var)" }}>
          <strong>{withConsent.length}</strong> de{" "}
          {withConsent.length + withoutConsent.length} seleccionados tienen consentimiento.{" "}
          {withoutConsent.length > 0 && (
            <>
              <strong>{withoutConsent.length}</strong> serán omitidos.
            </>
          )}
        </p>

        {withoutConsent.length > 0 && (
          <button
            onClick={() => setShowOmitted((v) => !v)}
            className="text-xs underline self-start"
            style={{ color: "var(--p)" }}
          >
            {showOmitted ? "Ocultar omitidos" : "Ver omitidos"}
          </button>
        )}

        {showOmitted && (
          <div
            className="rounded-[var(--r-md)] p-3 text-xs max-h-40 overflow-y-auto"
            style={{ background: "var(--surf-low)" }}
          >
            <ul className="space-y-1">
              {withoutConsent.map((r) => (
                <li key={r.id}>
                  <Link href={`/customers/${r.id}/editar`} className="hover:underline">
                    {r.name}
                  </Link>
                  <span className="ml-2" style={{ color: "var(--on-surf-var)" }}>
                    {r.phone ? "sin consentimiento" : "sin teléfono"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex gap-2 justify-end pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold"
            style={{
              borderRadius: "var(--r-full)",
              border: "1.5px solid rgba(45,106,79,0.2)",
              background: "transparent",
              color: "var(--p)",
              fontFamily: "var(--font-display)",
            }}
          >
            Cancelar
          </button>
          <button
            onClick={copyNumbers}
            disabled={withConsent.length === 0}
            className="px-5 py-2 text-sm font-semibold disabled:opacity-60"
            style={{
              borderRadius: "var(--r-full)",
              background: "var(--velocity-gradient)",
              color: "var(--on-p)",
              fontFamily: "var(--font-display)",
              border: "none",
            }}
          >
            Copiar {withConsent.length} números
          </button>
        </div>
      </div>
    </div>
  );
}
