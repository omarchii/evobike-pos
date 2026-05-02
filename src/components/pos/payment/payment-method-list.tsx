"use client";

// Pack E.3 — captura N métodos de pago para una transacción.
//
// Componente presentational: no fetcha saldo del cliente, no orquesta submit.
// El caller hidrata `customerCreditBalance` y se queda con la responsabilidad
// de validar contra `total` antes de enviar al servidor (Zod refinement +
// helper createPaymentInTransactions ya cubren defense-in-depth).
//
// Reusable en POS, /convert, abonos LAYAWAY y workshop charge.

import { useMemo } from "react";
import { formatMXN } from "@/lib/format";
import { Chip } from "@/components/primitives/chip";
import type { PaymentMethod, PaymentMethodEntry } from "@/lib/validators/payment";

const ALL_METHODS: { key: PaymentMethod; label: string }[] = [
  { key: "CASH", label: "Efectivo" },
  { key: "CARD", label: "Tarjeta" },
  { key: "TRANSFER", label: "Transferencia" },
  { key: "CREDIT_BALANCE", label: "Saldo a favor" },
  { key: "ATRATO", label: "Atrato" },
];

const REFERENCE_LABELS: Partial<Record<PaymentMethod, string>> = {
  CARD: "Voucher / autorización",
  TRANSFER: "Banco / referencia",
  ATRATO: "Solicitud Atrato (AT-…)",
};

type Props = {
  value: PaymentMethodEntry[];
  onChange: (entries: PaymentMethodEntry[]) => void;
  total: number;
  customerCreditBalance?: number | null;
  disabledMethods?: PaymentMethod[];
  className?: string;
};

const EPSILON = 0.005;

export function PaymentMethodList({
  value,
  onChange,
  total,
  customerCreditBalance = null,
  disabledMethods = [],
  className,
}: Props): React.JSX.Element {
  const sumPaid = useMemo(
    () => value.reduce((s, e) => s + (Number.isFinite(e.amount) ? e.amount : 0), 0),
    [value],
  );
  const diff = +(total - sumPaid).toFixed(2);
  const balanced = Math.abs(diff) < EPSILON;

  const usedMethods = new Set(value.map((e) => e.method));
  const hasCreditEntry = usedMethods.has("CREDIT_BALANCE");
  const showCreditBanner =
    customerCreditBalance != null && customerCreditBalance > 0 && !hasCreditEntry;

  const availableMethodsFor = (idx: number): PaymentMethod[] => {
    const usedElsewhere = new Set(value.filter((_, i) => i !== idx).map((e) => e.method));
    return ALL_METHODS.map((m) => m.key).filter(
      (m) => !usedElsewhere.has(m) && !disabledMethods.includes(m),
    );
  };

  const updateEntry = (idx: number, patch: Partial<PaymentMethodEntry>): void => {
    const next = value.map((e, i) => (i === idx ? { ...e, ...patch } : e));
    onChange(next);
  };

  const addEntry = (): void => {
    const nextMethod = ALL_METHODS.map((m) => m.key).find(
      (m) => !usedMethods.has(m) && !disabledMethods.includes(m),
    );
    if (!nextMethod) return;
    const remaining = Math.max(0, +(total - sumPaid).toFixed(2));
    const amount =
      nextMethod === "CREDIT_BALANCE" && customerCreditBalance != null
        ? Math.min(remaining, customerCreditBalance)
        : remaining;
    onChange([...value, { method: nextMethod, amount }]);
  };

  const removeEntry = (idx: number): void => {
    onChange(value.filter((_, i) => i !== idx));
  };

  const applyCreditFromBanner = (): void => {
    if (customerCreditBalance == null || customerCreditBalance <= 0) return;
    const remaining = Math.max(0, +(total - sumPaid).toFixed(2));
    const apply = Math.min(customerCreditBalance, total);
    // Si el banner se acciona con un cash entry single de monto = total,
    // bajar ese cash al residual y agregar CREDIT_BALANCE; si no, simplemente
    // append y el caller verá el diff en el chip.
    if (value.length === 1 && value[0].method === "CASH" && Math.abs(value[0].amount - total) < EPSILON) {
      const newCash = Math.max(0, +(total - apply).toFixed(2));
      onChange([
        { method: "CASH", amount: newCash, reference: value[0].reference },
        { method: "CREDIT_BALANCE", amount: apply },
      ]);
    } else {
      onChange([...value, { method: "CREDIT_BALANCE", amount: Math.min(apply, remaining) }]);
    }
  };

  const canAddMore =
    value.length < ALL_METHODS.length &&
    ALL_METHODS.some((m) => !usedMethods.has(m.key) && !disabledMethods.includes(m.key));

  return (
    <div className={className}>
      {showCreditBanner && (
        <div
          style={{
            padding: "10px 12px",
            marginBottom: 12,
            borderRadius: "var(--r-md)",
            background: "var(--p-container)",
            color: "var(--on-p-container)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            fontSize: 13,
          }}
        >
          <span>
            Saldo a favor disponible:{" "}
            <strong>{formatMXN(customerCreditBalance ?? 0)}</strong>
          </span>
          <button
            type="button"
            onClick={applyCreditFromBanner}
            className="inline-flex items-center px-3 py-1.5 text-xs font-semibold"
            style={{
              borderRadius: "var(--r-full)",
              background: "var(--p-bright)",
              color: "var(--on-p)",
              fontFamily: "var(--font-display)",
            }}
          >
            Aplicar
          </button>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {value.map((entry, idx) => {
          const methodOptions = availableMethodsFor(idx);
          const refLabel = REFERENCE_LABELS[entry.method];
          return (
            <div
              key={idx}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 120px auto",
                gap: 8,
                alignItems: "center",
              }}
            >
              <select
                value={entry.method}
                onChange={(e) =>
                  updateEntry(idx, { method: e.target.value as PaymentMethod })
                }
                style={{
                  padding: "8px 10px",
                  borderRadius: "var(--r-md)",
                  background: "var(--surf-low)",
                  color: "var(--on-surf)",
                  border: "1px solid var(--ghost-border)",
                  fontSize: 13,
                }}
              >
                {ALL_METHODS.filter((m) => methodOptions.includes(m.key) || m.key === entry.method).map(
                  (m) => (
                    <option key={m.key} value={m.key}>
                      {m.label}
                    </option>
                  ),
                )}
              </select>
              <input
                type="number"
                step="0.01"
                min={0}
                value={entry.amount === 0 ? "" : entry.amount}
                onChange={(e) =>
                  updateEntry(idx, { amount: parseFloat(e.target.value) || 0 })
                }
                placeholder="Monto"
                style={{
                  padding: "8px 10px",
                  borderRadius: "var(--r-md)",
                  background: "var(--surf-low)",
                  color: "var(--on-surf)",
                  border: "1px solid var(--ghost-border)",
                  fontSize: 13,
                  textAlign: "right",
                }}
              />
              <button
                type="button"
                onClick={() => removeEntry(idx)}
                disabled={value.length === 1}
                aria-label="Eliminar método"
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "var(--r-md)",
                  background: "transparent",
                  color: value.length === 1 ? "var(--ghost-border)" : "var(--on-surf)",
                  border: "1px solid var(--ghost-border)",
                  cursor: value.length === 1 ? "not-allowed" : "pointer",
                  fontSize: 16,
                }}
              >
                ×
              </button>
              {refLabel && (
                <input
                  type="text"
                  value={entry.reference ?? ""}
                  onChange={(e) =>
                    updateEntry(idx, { reference: e.target.value || undefined })
                  }
                  placeholder={refLabel}
                  style={{
                    gridColumn: "1 / -1",
                    padding: "6px 10px",
                    borderRadius: "var(--r-md)",
                    background: "var(--surf-low)",
                    color: "var(--on-surf)",
                    border: "1px solid var(--ghost-border)",
                    fontSize: 12,
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      {canAddMore && (
        <button
          type="button"
          onClick={addEntry}
          className="inline-flex items-center gap-1 mt-3 text-xs font-semibold"
          style={{
            padding: "6px 12px",
            borderRadius: "var(--r-full)",
            background: "var(--surf-high)",
            color: "var(--on-surf)",
            border: "1px solid var(--ghost-border)",
            fontFamily: "var(--font-display)",
          }}
        >
          + agregar otro método
        </button>
      )}

      <div
        style={{
          marginTop: 12,
          padding: "8px 12px",
          borderRadius: "var(--r-md)",
          background: "var(--surf-low)",
          fontSize: 12,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span style={{ color: "var(--on-surf-soft)" }}>
          Total {formatMXN(total)} · Suma {formatMXN(sumPaid)}
        </span>
        <Chip
          variant={balanced ? "success" : "warn"}
          label={
            balanced
              ? "OK"
              : diff > 0
                ? `Falta ${formatMXN(diff)}`
                : `Sobra ${formatMXN(Math.abs(diff))}`
          }
        />
      </div>
    </div>
  );
}
