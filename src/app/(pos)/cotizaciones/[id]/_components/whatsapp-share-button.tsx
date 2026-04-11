"use client";

import { useState } from "react";
import { MessageCircle, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { formatMXN, formatDate } from "@/lib/quotations";

// ── Types ─────────────────────────────────────────────────────────────────────

interface QuotationData {
  folio: string;
  total: number;
  validUntil: Date | string;
  publicShareToken: string;
  customer: { name: string; phone: string | null } | null;
  anonymousCustomerName: string | null;
  anonymousCustomerPhone: string | null;
}

interface WhatsAppShareButtonProps {
  quotation: QuotationData;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const PHONE_REGEX = /^\d{10}$/;

/** Normaliza un teléfono a formato wa.me: 52 + 10 dígitos. */
function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("52")) return digits;
  return `52${digits.slice(-10)}`;
}

/** Construye la URL de WhatsApp con mensaje pre-llenado. */
function buildWhatsAppUrl(
  phone: string,
  recipientName: string | null,
  folio: string,
  total: number,
  validUntil: Date | string,
  publicShareToken: string,
): string {
  const normalized = normalizePhone(phone);
  const link = `${window.location.origin}/cotizaciones/public/${publicShareToken}`;
  const greeting = recipientName ? `Hola ${recipientName}` : "Hola";
  const fecha = formatDate(validUntil);
  const message =
    `${greeting}, te comparto tu cotización *${folio}* por un total de *${formatMXN(total)}*. ` +
    `Válida hasta el ${fecha}. Puedes verla aquí: ${link}`;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function WhatsAppShareButton({ quotation }: WhatsAppShareButtonProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [manualPhone, setManualPhone] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [sending, setSending] = useState(false);

  /** Teléfono disponible en la cotización (sin requerir input manual). */
  function getPhoneNumber(): string | null {
    return (
      quotation.customer?.phone ||
      quotation.anonymousCustomerPhone ||
      null
    );
  }

  /** Nombre del destinatario para el saludo. */
  function getRecipientName(): string | null {
    return quotation.customer?.name || quotation.anonymousCustomerName || null;
  }

  function openWhatsApp(phone: string): void {
    const url = buildWhatsAppUrl(
      phone,
      getRecipientName(),
      quotation.folio,
      quotation.total,
      quotation.validUntil,
      quotation.publicShareToken,
    );
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function handleClick(): void {
    const phone = getPhoneNumber();
    if (phone) {
      openWhatsApp(phone);
    } else {
      setManualPhone("");
      setPhoneError("");
      setModalOpen(true);
    }
  }

  function handleModalSubmit(): void {
    if (!PHONE_REGEX.test(manualPhone)) {
      setPhoneError("Ingresa exactamente 10 dígitos numéricos.");
      return;
    }
    setSending(true);
    openWhatsApp(manualPhone);
    setSending(false);
    setModalOpen(false);
    setManualPhone("");
    setPhoneError("");
  }

  function handlePhoneChange(e: React.ChangeEvent<HTMLInputElement>): void {
    const value = e.target.value.replace(/\D/g, "").slice(0, 10);
    setManualPhone(value);
    if (phoneError) setPhoneError("");
  }

  return (
    <>
      {/* ── Floating bar button ── */}
      <button
        type="button"
        onClick={handleClick}
        className={cn(
          "group transition-colors hover:bg-[var(--surf-high)] rounded-xl",
        )}
        style={{
          color: "var(--on-surf)",
          background: "var(--surf-low)",
          borderRadius: "var(--r-lg)",
          cursor: "pointer",
          position: "relative",
        }}
      >
        <span className="flex flex-col items-center gap-1 px-3 py-2 min-w-[64px]">
          <MessageCircle className="h-4 w-4" />
          <span className="text-[0.625rem] font-medium">WhatsApp</span>
        </span>
      </button>

      {/* ── Modal: pedir número manual ── */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent
          className="p-0 gap-0 overflow-hidden"
          style={{
            background: "color-mix(in srgb, var(--surf-bright) 88%, transparent)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            boxShadow: "var(--shadow)",
            borderRadius: "var(--r-xl)",
            maxWidth: 440,
          }}
        >
          <DialogHeader className="px-6 pt-6 pb-4">
            <DialogTitle
              style={{ fontFamily: "var(--font-display)", color: "var(--on-surf)" }}
            >
              Enviar cotización por WhatsApp
            </DialogTitle>
          </DialogHeader>

          <div className="px-6 pb-6 space-y-4">
            <p className="text-sm" style={{ color: "var(--on-surf-var)" }}>
              Esta cotización no tiene un número de teléfono asociado. Ingresa
              el número del destinatario para continuar.
            </p>

            <div>
              <label
                htmlFor="wa-manual-phone"
                className="text-xs font-medium mb-1.5 block"
                style={{ color: "var(--on-surf-var)" }}
              >
                Número de teléfono *
              </label>
              <input
                id="wa-manual-phone"
                type="tel"
                inputMode="numeric"
                maxLength={10}
                value={manualPhone}
                onChange={handlePhoneChange}
                onKeyDown={(e) => e.key === "Enter" && handleModalSubmit()}
                placeholder="10 dígitos"
                style={{
                  background: "var(--surf-low)",
                  border: phoneError
                    ? "1.5px solid var(--ter)"
                    : "1px solid rgba(178,204,192,0.15)",
                  borderRadius: "var(--r-md)",
                  color: "var(--on-surf)",
                  fontFamily: "var(--font-body)",
                  fontSize: "0.875rem",
                  padding: "0.65rem 0.75rem",
                  width: "100%",
                  outline: "none",
                  letterSpacing: "0.04em",
                }}
              />
              {phoneError && (
                <p
                  className="text-xs mt-1.5"
                  style={{ color: "var(--ter)" }}
                >
                  {phoneError}
                </p>
              )}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="flex-1 py-2.5 rounded-full text-sm font-medium transition-colors hover:bg-[var(--surf-high)]"
                style={{ color: "var(--on-surf-var)", background: "var(--surf-low)" }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleModalSubmit}
                disabled={sending || manualPhone.length === 0}
                className="flex-1 py-2.5 rounded-full text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                style={{
                  background: "linear-gradient(135deg, #1b4332, #2ecc71)",
                  color: "#ffffff",
                }}
              >
                {sending && <Loader2 className="h-4 w-4 animate-spin" />}
                Enviar
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
