"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  Clock,
  Package,
  Send,
  Truck,
  XCircle,
} from "lucide-react";
import { TransferStatusBadge } from "@/components/transfer-status-badge";
import type { StockTransferStatus } from "@prisma/client";
import type { TransferDetail, TransferItemDetail } from "../shared-tokens";
import { formatDateTime, itemDescription, itemTypeLabel } from "../shared-tokens";
import { AutorizarDialog } from "./autorizar-dialog";
import { RecibirDialog } from "./recibir-dialog";
import { CancelarDialog } from "./cancelar-dialog";

interface Props {
  transfer: TransferDetail;
  userRole: string;
  userBranchId: string;
  userId: string;
  autoModal: string | null;
}

type ModalType = "autorizar" | "recibir" | "cancelar" | null;

export function TransferenciaDetalleClient({
  transfer,
  userRole,
  userBranchId,
  userId,
  autoModal,
}: Props) {
  const router = useRouter();
  const [openModal, setOpenModal] = useState<ModalType>(
    () =>
      autoModal === "autorizar" || autoModal === "recibir" || autoModal === "cancelar"
        ? (autoModal as ModalType)
        : null,
  );

  const isAdmin = userRole === "ADMIN";
  const isManagerOrigen = userRole === "MANAGER" && userBranchId === transfer.fromBranchId;
  const isManagerDestino = userRole === "MANAGER" && userBranchId === transfer.toBranchId;
  const isCreator = userId === transfer.creadoPor;

  const canAutorizar = (isAdmin || isManagerOrigen) && transfer.status === "SOLICITADA";
  const canDespachar = (isAdmin || isManagerOrigen) && transfer.status === "BORRADOR";
  const canRecibir = (isAdmin || isManagerDestino) && transfer.status === "EN_TRANSITO";
  const canCancelSolicitada =
    transfer.status === "SOLICITADA" && (isCreator || isManagerOrigen || isManagerDestino || isAdmin);
  const canCancelBorrador = transfer.status === "BORRADOR" && (isAdmin || isManagerOrigen);
  const canCancelTransito = transfer.status === "EN_TRANSITO" && (isAdmin || isManagerOrigen || isManagerDestino);
  const canCancel = canCancelSolicitada || canCancelBorrador || canCancelTransito;

  const isDone = transfer.status === "RECIBIDA" || transfer.status === "CANCELADA";

  const handleDespachar = async () => {
    const toastId = "despachar";
    toast.loading("Despachando transferencia…", { id: toastId });
    try {
      const res = await fetch(`/api/transferencias/${transfer.id}/despachar`, { method: "POST" });
      const json = (await res.json()) as { success: boolean; error?: string };
      if (!json.success) {
        toast.error(json.error ?? "Error al despachar", { id: toastId });
        return;
      }
      toast.success("Transferencia despachada — ahora está en tránsito", { id: toastId });
      router.refresh();
    } catch {
      toast.error("Error de red. Intenta de nuevo.", { id: toastId });
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-24">
      {/* Back button */}
      <button
        onClick={() => router.push("/transferencias")}
        className="flex items-center gap-2 text-sm transition-opacity hover:opacity-70"
        style={{ color: "var(--on-surf-var)", background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-body)" }}
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a transferencias
      </button>

      {/* Header */}
      <div
        className="rounded-2xl p-6 space-y-3"
        style={{ background: "var(--surf-lowest)", boxShadow: "var(--shadow)" }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1
              className="text-[2rem] font-bold tracking-[-0.02em] leading-none"
              style={{ fontFamily: "var(--font-display)", color: "var(--on-surf)" }}
            >
              {transfer.folio}
            </h1>
            <p className="mt-1 text-xs" style={{ color: "var(--on-surf-var)" }}>
              Creada {formatDateTime(transfer.createdAt)} por {transfer.creadoPorUser.name}
            </p>
          </div>
          <TransferStatusBadge status={transfer.status as StockTransferStatus} size="md" />
        </div>

        {/* Branch route */}
        <div className="flex items-center gap-2 flex-wrap">
          <BranchChip name={transfer.fromBranch.name} code={transfer.fromBranch.code} />
          <ArrowRight className="h-4 w-4 shrink-0" style={{ color: "var(--on-surf-var)" }} />
          <BranchChip name={transfer.toBranch.name} code={transfer.toBranch.code} />
        </div>
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Items table */}
        <div
          className="lg:col-span-2 rounded-2xl overflow-hidden"
          style={{ background: "var(--surf-lowest)", boxShadow: "var(--shadow)" }}
        >
          <div className="px-5 pt-5 pb-3">
            <h2 className="text-sm font-semibold" style={{ color: "var(--on-surf)" }}>
              Ítems ({transfer.items.length})
            </h2>
          </div>
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--ghost-border)" }}>
                {["Tipo", "Descripción", "Enviado", "Recibido"].map((h) => (
                  <th
                    key={h}
                    className="text-left px-4 py-2"
                    style={{
                      fontSize: "0.625rem",
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
              {transfer.items.map((item) => {
                const received = item.cantidadRecibida;
                const diff = received !== null ? received - item.cantidadEnviada : null;
                return (
                  <tr key={item.id} className="hover:bg-[var(--surf-high)] transition-colors">
                    <td className="px-4 py-3">
                      <span
                        className="text-[0.625rem] font-medium rounded-full px-2 py-0.5 uppercase tracking-[0.04em]"
                        style={{ background: "var(--surf-high)", color: "var(--on-surf-var)", fontFamily: "var(--font-body)" }}
                      >
                        {itemTypeLabel(item as TransferItemDetail)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: "var(--on-surf)" }}>
                      {itemDescription(item as TransferItemDetail)}
                    </td>
                    <td className="px-4 py-3 text-xs text-center" style={{ color: "var(--on-surf)" }}>
                      {item.cantidadEnviada}
                    </td>
                    <td className="px-4 py-3 text-xs text-center">
                      {received !== null ? (
                        <span
                          style={{
                            color: diff === 0 ? "var(--sec)" : diff !== null && diff < 0 ? "var(--ter)" : "var(--on-surf)",
                            fontWeight: diff !== 0 ? 600 : 400,
                          }}
                        >
                          {received}
                          {diff !== null && diff !== 0 && (
                            <span className="ml-1 text-[0.625rem]">({diff > 0 ? "+" : ""}{diff})</span>
                          )}
                        </span>
                      ) : (
                        <span style={{ color: "var(--on-surf-var)" }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Timeline + Notes */}
        <div className="space-y-4">
          <div
            className="rounded-2xl p-5 space-y-4"
            style={{ background: "var(--surf-lowest)", boxShadow: "var(--shadow)" }}
          >
            <h2 className="text-sm font-semibold" style={{ color: "var(--on-surf)" }}>
              Cronología
            </h2>
            <Timeline transfer={transfer} />
          </div>

          {transfer.notas && (
            <div
              className="rounded-2xl p-5 space-y-2"
              style={{ background: "var(--surf-lowest)", boxShadow: "var(--shadow)" }}
            >
              <h2 className="text-sm font-semibold" style={{ color: "var(--on-surf)" }}>Notas</h2>
              <p className="text-xs leading-relaxed" style={{ color: "var(--on-surf-var)" }}>
                {transfer.notas}
              </p>
            </div>
          )}

          {transfer.motivoCancelacion && (
            <div
              className="rounded-2xl p-5 space-y-2"
              style={{ background: "var(--ter-container)", boxShadow: "var(--shadow)" }}
            >
              <h2 className="text-sm font-semibold" style={{ color: "var(--on-ter-container)" }}>
                Motivo de cancelación
              </h2>
              <p className="text-xs leading-relaxed" style={{ color: "var(--on-ter-container)" }}>
                {transfer.motivoCancelacion}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Sticky action bar */}
      <div
        className="fixed bottom-0 left-64 right-0 flex items-center justify-end gap-3 px-8 py-4"
        style={{
          background: "color-mix(in srgb, var(--surf-lowest) 92%, transparent)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderTop: "1px solid var(--ghost-border)",
          zIndex: 20,
        }}
      >
        {isDone ? (
          <button
            onClick={() => router.push("/transferencias")}
            className="flex items-center gap-2 text-sm font-medium rounded-full px-5 py-2"
            style={{
              background: "var(--surf-high)",
              color: "var(--on-surf-var)",
              border: "none",
              cursor: "pointer",
              fontFamily: "var(--font-body)",
            }}
          >
            <ArrowLeft className="h-4 w-4" />
            Volver a la lista
          </button>
        ) : (
          <>
            {canCancel && (
              <button
                onClick={() => setOpenModal("cancelar")}
                className="text-sm font-medium rounded-full px-5 h-10"
                style={{
                  background: "var(--ter-container)",
                  color: "var(--ter)",
                  border: "none",
                  cursor: "pointer",
                  fontFamily: "var(--font-body)",
                }}
              >
                Cancelar
              </button>
            )}
            {canAutorizar && (
              <button
                onClick={() => setOpenModal("autorizar")}
                className="flex items-center gap-2 text-sm font-medium rounded-full px-5 h-10"
                style={{
                  background: "var(--p-container)",
                  color: "var(--on-p-container)",
                  border: "none",
                  cursor: "pointer",
                  fontFamily: "var(--font-body)",
                }}
              >
                <CheckCircle className="h-4 w-4" />
                Autorizar
              </button>
            )}
            {canDespachar && (
              <button
                onClick={handleDespachar}
                className="flex items-center gap-2 text-sm font-semibold rounded-full px-5 h-10"
                style={{
                  background: "var(--velocity-gradient)",
                  color: "#ffffff",
                  border: "none",
                  cursor: "pointer",
                  fontFamily: "var(--font-body)",
                }}
              >
                <Send className="h-4 w-4" />
                Despachar
              </button>
            )}
            {canRecibir && (
              <button
                onClick={() => setOpenModal("recibir")}
                className="flex items-center gap-2 text-sm font-semibold rounded-full px-5 h-10"
                style={{
                  background: "var(--velocity-gradient)",
                  color: "#ffffff",
                  border: "none",
                  cursor: "pointer",
                  fontFamily: "var(--font-body)",
                }}
              >
                <Package className="h-4 w-4" />
                Recibir
              </button>
            )}
          </>
        )}
      </div>

      {/* Modals */}
      <AutorizarDialog
        open={openModal === "autorizar"}
        onOpenChange={(o) => setOpenModal(o ? "autorizar" : null)}
        transferId={transfer.id}
        folio={transfer.folio}
      />
      <RecibirDialog
        open={openModal === "recibir"}
        onOpenChange={(o) => setOpenModal(o ? "recibir" : null)}
        transferId={transfer.id}
        folio={transfer.folio}
        items={transfer.items as TransferItemDetail[]}
      />
      <CancelarDialog
        open={openModal === "cancelar"}
        onOpenChange={(o) => setOpenModal(o ? "cancelar" : null)}
        transferId={transfer.id}
        folio={transfer.folio}
        wasEnTransito={transfer.status === "EN_TRANSITO"}
      />
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function BranchChip({ name, code }: { name: string; code: string }) {
  return (
    <div
      className="flex items-center gap-1.5 rounded-lg px-3 py-1"
      style={{ background: "var(--surf-high)" }}
    >
      <span
        className="text-[0.625rem] font-bold uppercase tracking-wider"
        style={{ color: "var(--p)" }}
      >
        {code}
      </span>
      <span className="text-xs" style={{ color: "var(--on-surf-var)" }}>
        {name}
      </span>
    </div>
  );
}

interface TimelineEvent {
  date: string | null;
  label: string;
  userName: string | null;
  icon: React.ElementType;
  done: boolean;
  isCancel?: boolean;
}

function Timeline({ transfer }: { transfer: TransferDetail }) {
  const events: TimelineEvent[] = [
    {
      date: transfer.createdAt,
      label: "Creada",
      userName: transfer.creadoPorUser.name,
      icon: Clock,
      done: true,
    },
    ...(transfer.autorizadoAt
      ? [{
          date: transfer.autorizadoAt,
          label: "Autorizada",
          userName: transfer.autorizadoPorUser?.name ?? null,
          icon: CheckCircle,
          done: true,
        }]
      : []),
    ...(transfer.despachadoAt
      ? [{
          date: transfer.despachadoAt,
          label: "Despachada",
          userName: transfer.despachadoPorUser?.name ?? null,
          icon: Truck,
          done: true,
        }]
      : []),
    ...(transfer.recibidoAt
      ? [{
          date: transfer.recibidoAt,
          label: "Recibida",
          userName: transfer.recibidoPorUser?.name ?? null,
          icon: Package,
          done: true,
        }]
      : []),
    ...(transfer.canceladoAt
      ? [{
          date: transfer.canceladoAt,
          label: "Cancelada",
          userName: transfer.canceladoPorUser?.name ?? null,
          icon: XCircle,
          done: true,
          isCancel: true,
        }]
      : []),
  ];

  return (
    <div className="space-y-3">
      {events.map((ev, i) => {
        const Icon = ev.icon;
        return (
          <div key={i} className="flex items-start gap-3">
            <div
              className="shrink-0 flex items-center justify-center rounded-full"
              style={{
                width: 28,
                height: 28,
                background: ev.isCancel ? "var(--ter-container)" : "var(--sec-container)",
                color: ev.isCancel ? "var(--ter)" : "var(--sec)",
              }}
            >
              <Icon className="h-3.5 w-3.5" />
            </div>
            <div>
              <p className="text-xs font-medium" style={{ color: "var(--on-surf)" }}>
                {ev.label}
                {ev.userName && (
                  <span className="font-normal" style={{ color: "var(--on-surf-var)" }}> — {ev.userName}</span>
                )}
              </p>
              {ev.date && (
                <p className="text-[0.625rem]" style={{ color: "var(--on-surf-var)" }}>
                  {formatDateTime(ev.date)}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
