"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { ArrowRight, Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { TransferStatusBadge } from "@/components/transfer-status-badge";
import type { StockTransferStatus } from "@prisma/client";
import type { BranchOption, TransferRow } from "./shared-tokens";
import { formatDate } from "./shared-tokens";
import { NuevaTransferenciaDialog } from "./nueva-transferencia-dialog";

interface Props {
  rows: TransferRow[];
  total: number;
  page: number;
  pageSize: number;
  tab: string;
  direccion: string;
  desde: string;
  hasta: string;
  q: string;
  solicitadasCount: number;
  enTransitoCount: number;
  branches: BranchOption[];
  userRole: string;
  userBranchId: string;
}

interface Tab {
  key: string;
  label: string;
  status: string | null;
  managerOnly?: true;
}

const TABS: Tab[] = [
  { key: "solicitudes", label: "Solicitudes", status: "SOLICITADA" },
  { key: "borradores",  label: "Borradores",  status: "BORRADOR",    managerOnly: true },
  { key: "transito",    label: "En tránsito", status: "EN_TRANSITO" },
  { key: "historial",   label: "Historial",   status: null },
];

export function TransferenciasClient({
  rows,
  total,
  page,
  pageSize,
  tab,
  direccion,
  desde,
  hasta,
  q,
  solicitadasCount,
  enTransitoCount,
  branches,
  userRole,
  userBranchId,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showNueva, setShowNueva] = useState(false);

  const totalPages = Math.ceil(total / pageSize);
  const canCreateBorrador = userRole === "MANAGER" || userRole === "ADMIN";

  const push = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(updates)) {
        if (v) params.set(k, v);
        else params.delete(k);
      }
      router.replace(`/transferencias?${params.toString()}`);
    },
    [router, searchParams],
  );

  const changeTab = (key: string) => {
    const params = new URLSearchParams();
    params.set("tab", key);
    if (direccion && direccion !== "todas") params.set("direccion", direccion);
    router.replace(`/transferencias?${params.toString()}`);
  };

  const handleRowClick = (id: string) => {
    router.push(`/transferencias/${id}`);
  };

  const handleQuickAction = (
    e: React.MouseEvent,
    id: string,
    action: "autorizar" | "despachar" | "recibir" | "cancelar",
  ) => {
    e.stopPropagation();
    router.push(`/transferencias/${id}?modal=${action}`);
  };

  const visibleTabs = TABS.filter((t) => {
    if (t.managerOnly && userRole === "SELLER") return false;
    return true;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1
            className="text-[2.25rem] font-bold tracking-[-0.01em] leading-none"
            style={{ fontFamily: "var(--font-display)", color: "var(--on-surf)" }}
          >
            Transferencias
          </h1>
          <p className="mt-2 text-[0.8125rem]" style={{ color: "var(--on-surf-var)" }}>
            Movimientos de stock entre sucursales.
          </p>
        </div>
        <button
          onClick={() => setShowNueva(true)}
          className="flex items-center gap-2 shrink-0"
          style={{
            background: "var(--velocity-gradient)",
            color: "#FFFFFF",
            borderRadius: "var(--r-full)",
            border: "none",
            fontFamily: "var(--font-body)",
            fontWeight: 600,
            fontSize: "0.875rem",
            height: 44,
            paddingInline: "1.5rem",
            cursor: "pointer",
          }}
        >
          <Plus className="h-4 w-4" />
          Nueva transferencia
        </button>
      </header>

      {/* Tabs */}
      <nav
        className="flex gap-1 p-1 rounded-xl w-fit"
        style={{ background: "var(--surf-low)" }}
      >
        {visibleTabs.map((t) => {
          const isActive = tab === t.key;
          const badge =
            t.key === "solicitudes" && userRole !== "SELLER" && solicitadasCount > 0
              ? solicitadasCount
              : t.key === "transito" && userRole !== "SELLER" && enTransitoCount > 0
                ? enTransitoCount
                : null;
          return (
            <button
              key={t.key}
              onClick={() => changeTab(t.key)}
              className="relative flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
              style={{
                background: isActive ? "var(--surf-highest)" : "transparent",
                color: isActive ? "var(--p)" : "var(--on-surf-var)",
                fontWeight: isActive ? 600 : 400,
              }}
            >
              {t.label}
              {badge !== null && (
                <span
                  className="text-[0.625rem] font-bold rounded-full px-1.5 py-px leading-none"
                  style={{
                    background: "var(--velocity-gradient)",
                    color: "#ffffff",
                  }}
                >
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <select
          value={direccion}
          onChange={(e) => push({ direccion: e.target.value, page: "" })}
          className="text-sm rounded-xl px-3 h-9"
          style={{
            background: "var(--surf-low)",
            color: "var(--on-surf)",
            border: "none",
            outline: "none",
            fontFamily: "var(--font-body)",
          }}
        >
          <option value="todas">Todas las direcciones</option>
          <option value="entrantes">Entrantes</option>
          <option value="salientes">Salientes</option>
        </select>

        <input
          type="date"
          value={desde}
          onChange={(e) => push({ desde: e.target.value, page: "" })}
          placeholder="Desde"
          className="text-sm rounded-xl px-3 h-9"
          style={{
            background: "var(--surf-low)",
            color: desde ? "var(--on-surf)" : "var(--on-surf-var)",
            border: "none",
            outline: "none",
            fontFamily: "var(--font-body)",
          }}
        />
        <input
          type="date"
          value={hasta}
          onChange={(e) => push({ hasta: e.target.value, page: "" })}
          placeholder="Hasta"
          className="text-sm rounded-xl px-3 h-9"
          style={{
            background: "var(--surf-low)",
            color: hasta ? "var(--on-surf)" : "var(--on-surf-var)",
            border: "none",
            outline: "none",
            fontFamily: "var(--font-body)",
          }}
        />

        <input
          type="text"
          value={q}
          onChange={(e) => push({ q: e.target.value, page: "" })}
          placeholder="Buscar por folio…"
          className="text-sm rounded-xl px-3 h-9 w-48"
          style={{
            background: "var(--surf-low)",
            color: "var(--on-surf)",
            border: "none",
            outline: "none",
            fontFamily: "var(--font-body)",
          }}
        />

        {(desde || hasta || q || direccion !== "todas") && (
          <button
            onClick={() => router.replace(`/transferencias?tab=${tab}`)}
            className="text-xs underline"
            style={{ color: "var(--on-surf-var)" }}
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Table */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: "var(--surf-lowest)", boxShadow: "var(--shadow)" }}
      >
        <table className="w-full">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--ghost-border)" }}>
              {["Folio", "Ruta", "Creada", "Por", "Ítems", "Estado", "Acciones"].map((h) => (
                <th
                  key={h}
                  className="text-left px-4 py-3"
                  style={{
                    fontSize: "0.6875rem",
                    fontWeight: 500,
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                    color: "var(--on-surf-var)",
                    fontFamily: "var(--font-body)",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-16" style={{ color: "var(--on-surf-var)", fontSize: "0.875rem" }}>
                  No hay transferencias en esta vista.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <TransferRow
                  key={row.id}
                  row={row}
                  userRole={userRole}
                  userBranchId={userBranchId}
                  onRowClick={handleRowClick}
                  onQuickAction={handleQuickAction}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-xs" style={{ color: "var(--on-surf-var)" }}>
            {total} resultado{total !== 1 ? "s" : ""}
          </span>
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => push({ page: String(page - 1) })}
              className="flex items-center justify-center rounded-xl w-9 h-9 transition-colors disabled:opacity-40"
              style={{ background: "var(--surf-low)", color: "var(--on-surf-var)" }}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm" style={{ color: "var(--on-surf)" }}>
              {page} / {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => push({ page: String(page + 1) })}
              className="flex items-center justify-center rounded-xl w-9 h-9 transition-colors disabled:opacity-40"
              style={{ background: "var(--surf-low)", color: "var(--on-surf-var)" }}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Nueva transferencia modal */}
      <NuevaTransferenciaDialog
        open={showNueva}
        onOpenChange={setShowNueva}
        branches={branches}
        userRole={userRole}
        userBranchId={userBranchId}
        canCreateBorrador={canCreateBorrador}
      />
    </div>
  );
}

// ── Table Row ──────────────────────────────────────────────────────────────────

function TransferRow({
  row,
  userRole,
  userBranchId,
  onRowClick,
  onQuickAction,
}: {
  row: TransferRow;
  userRole: string;
  userBranchId: string;
  onRowClick: (id: string) => void;
  onQuickAction: (e: React.MouseEvent, id: string, action: "autorizar" | "despachar" | "recibir" | "cancelar") => void;
}) {
  const isManagerOrigen = (userRole === "MANAGER" || userRole === "ADMIN") && (userRole === "ADMIN" || userBranchId === row.fromBranchId);
  const isManagerDestino = (userRole === "MANAGER" || userRole === "ADMIN") && (userRole === "ADMIN" || userBranchId === row.toBranchId);

  const canAutorizar = row.status === "SOLICITADA" && isManagerOrigen;
  const canDespachar = row.status === "BORRADOR" && isManagerOrigen;
  const canRecibir = row.status === "EN_TRANSITO" && isManagerDestino;

  return (
    <tr
      onClick={() => onRowClick(row.id)}
      className="cursor-pointer transition-colors hover:bg-[var(--surf-high)]"
    >
      <td className="px-4 py-3">
        <span
          className="font-bold tracking-[-0.01em]"
          style={{ fontFamily: "var(--font-display)", fontSize: "0.8125rem", color: "var(--on-surf)" }}
        >
          {row.folio}
        </span>
      </td>
      <td className="px-4 py-3">
        <span className="flex items-center gap-1.5 text-xs" style={{ color: "var(--on-surf-var)" }}>
          <span
            className="rounded px-1.5 py-0.5 text-[0.625rem] font-medium uppercase"
            style={{ background: "var(--surf-high)", color: "var(--p)" }}
          >
            {row.fromBranch.code}
          </span>
          <ArrowRight className="h-3 w-3 shrink-0" />
          <span
            className="rounded px-1.5 py-0.5 text-[0.625rem] font-medium uppercase"
            style={{ background: "var(--surf-high)", color: "var(--p)" }}
          >
            {row.toBranch.code}
          </span>
        </span>
      </td>
      <td className="px-4 py-3 text-xs" style={{ color: "var(--on-surf-var)" }}>
        {formatDate(row.createdAt)}
      </td>
      <td className="px-4 py-3 text-xs" style={{ color: "var(--on-surf-var)" }}>
        {row.creadoPorUser.name}
      </td>
      <td className="px-4 py-3 text-xs text-center" style={{ color: "var(--on-surf)" }}>
        {row.totalItems}
      </td>
      <td className="px-4 py-3">
        <TransferStatusBadge status={row.status as StockTransferStatus} />
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          {canAutorizar && (
            <ActionBtn
              label="Autorizar"
              color="var(--p)"
              onClick={(e) => onQuickAction(e, row.id, "autorizar")}
            />
          )}
          {canDespachar && (
            <ActionBtn
              label="Despachar"
              color="var(--p)"
              onClick={(e) => onQuickAction(e, row.id, "despachar")}
            />
          )}
          {canRecibir && (
            <ActionBtn
              label="Recibir"
              color="var(--sec)"
              onClick={(e) => onQuickAction(e, row.id, "recibir")}
            />
          )}
          <ActionBtn
            label="Ver"
            color="var(--on-surf-var)"
            onClick={(e) => { e.stopPropagation(); onRowClick(row.id); }}
          />
        </div>
      </td>
    </tr>
  );
}

function ActionBtn({
  label,
  color,
  onClick,
}: {
  label: string;
  color: string;
  onClick: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      onClick={onClick}
      className="text-[0.625rem] font-semibold rounded-full px-2.5 py-0.5 uppercase tracking-[0.04em] transition-opacity hover:opacity-80"
      style={{
        background: "var(--surf-high)",
        color,
        border: "none",
        cursor: "pointer",
        fontFamily: "var(--font-body)",
        letterSpacing: "0.05em",
      }}
    >
      {label}
    </button>
  );
}
