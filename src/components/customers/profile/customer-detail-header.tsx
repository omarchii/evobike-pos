"use client";

// Header sticky del perfil de cliente (BRIEF §7.4 Sub-fase E).
// Muestra avatar + nombre, fila secundaria con metadata + chips de
// segmentación y tags manuales, y acciones rápidas (WhatsApp, nueva venta,
// nueva orden, kebab editar/eliminar).

import Link from "next/link";
import { Icon } from "@/components/primitives/icon";
import { Chip } from "@/components/primitives/chip";
import { formatPhoneDisplay, formatPhoneForWhatsApp } from "@/lib/customers/phone";
import {
  SEGMENT_LABELS,
  SEGMENT_TOOLTIPS,
  type SegmentChip,
} from "@/lib/customers/segmentation";
import { HeaderActionsMenu } from "./header-actions-menu";

interface Props {
  customerId: string;
  name: string;
  phone: string | null;
  email: string | null;
  rfc: string | null;
  isBusiness: boolean;
  shippingState: string | null;
  segments: SegmentChip[];
  tags: string[];
  isDeleted: boolean;
  isManagerPlus: boolean;
}

const CHIP_VARIANT: Partial<
  Record<SegmentChip, "neutral" | "success" | "warn" | "error" | "info">
> = {
  EMPRESA: "info",
  FRECUENTE: "success",
  EN_RIESGO: "warn",
  INACTIVO: "neutral",
  SALDO_SIN_USAR: "info",
  SIN_CONSENTIMIENTO: "neutral",
  CON_SALDO_POR_COBRAR: "warn",
};

function shortId(id: string): string {
  return id.replace(/-/g, "").slice(0, 8).toUpperCase();
}

export function CustomerDetailHeader({
  customerId,
  name,
  phone,
  email,
  rfc,
  isBusiness,
  shippingState,
  segments,
  tags,
  isDeleted,
  isManagerPlus,
}: Props): React.JSX.Element {
  const waNumber = formatPhoneForWhatsApp(phone);

  return (
    <div
      className="sticky top-0 z-20 -mx-6 px-6 py-4 flex flex-col gap-3"
      style={{
        background: "color-mix(in srgb, var(--surface) 92%, transparent)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <div
            className="h-12 w-12 rounded-[var(--r-lg)] flex items-center justify-center shrink-0"
            style={{
              background: "linear-gradient(135deg, #1b4332 0%, #2ecc71 100%)",
              color: "var(--on-p)",
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: "1.125rem",
              letterSpacing: "-0.01em",
            }}
            aria-hidden
          >
            {name.trim().charAt(0).toUpperCase() || "?"}
          </div>
          <div className="min-w-0 flex flex-col gap-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1
                className="font-bold tracking-[-0.01em] truncate"
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "1.5rem",
                  color: "var(--on-surf)",
                }}
              >
                {name}
              </h1>
              {isDeleted && <Chip variant="neutral" label="Cliente eliminado" />}
              {isBusiness && <Chip variant="info" label="Empresa" />}
              {shippingState && (
                <Chip variant="neutral" label={`Zona ${shippingState}`} />
              )}
            </div>
            <div
              className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs"
              style={{ color: "var(--on-surf-var)" }}
            >
              <span className="font-mono">ID: CUST-{shortId(customerId)}</span>
              {rfc && (
                <span className="inline-flex items-center gap-1">
                  <Icon name="invoice" size={12} />
                  <span className="font-mono">{rfc}</span>
                </span>
              )}
              {email && (
                <span className="inline-flex items-center gap-1">
                  <Icon name="share" size={12} />
                  {email}
                </span>
              )}
              {phone && (
                <span className="inline-flex items-center gap-1">
                  <Icon name="user" size={12} />
                  {formatPhoneDisplay(phone)}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {waNumber && (
            <a
              href={`https://wa.me/${waNumber}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--r-full)] text-xs font-medium"
              style={{ background: "var(--surf-high)", color: "var(--on-surf)" }}
              title="Abrir WhatsApp"
            >
              <Icon name="share" size={13} />
              WhatsApp
            </a>
          )}
          <Link
            href={`/point-of-sale?customerId=${customerId}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--r-full)] text-xs font-medium"
            style={{ background: "var(--surf-high)", color: "var(--on-surf)" }}
          >
            <Icon name="sales" size={13} />
            Nueva venta
          </Link>
          <Link
            href={`/workshop/recepcion?customerId=${customerId}`}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[var(--r-full)] text-xs font-semibold"
            style={{
              background: "linear-gradient(135deg, #1b4332 0%, #2ecc71 100%)",
              color: "var(--on-p)",
              fontFamily: "var(--font-display)",
            }}
          >
            <Icon name="wrench" size={13} />
            Nueva orden
          </Link>
          <HeaderActionsMenu
            customerId={customerId}
            customerName={name}
            isManagerPlus={isManagerPlus}
          />
        </div>
      </div>

      {(segments.length > 0 || tags.length > 0) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {segments.map((s) => (
            <span key={s} title={SEGMENT_TOOLTIPS[s]}>
              <Chip variant={CHIP_VARIANT[s] ?? "neutral"} label={SEGMENT_LABELS[s]} />
            </span>
          ))}
          {tags.map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-1 rounded-[var(--r-full)] px-2 py-0.5 text-[0.625rem] font-medium tracking-[0.04em] uppercase"
              style={{
                background: "color-mix(in srgb, var(--data-3) 18%, transparent)",
                color: "var(--on-surf)",
              }}
              title="Tag manual"
            >
              <Icon name="bookmark" size={10} />
              {t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
