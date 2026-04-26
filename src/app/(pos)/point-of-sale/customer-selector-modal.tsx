"use client";

import { useState } from "react";
import { Search, UserPlus, X, User } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  CustomerCreateForm,
  type CustomerOption,
} from "@/components/customers/customer-create-form";

export type { CustomerOption };

interface Props {
  open: boolean;
  onClose: () => void;
  customers: CustomerOption[];
  onSelect: (customer: CustomerOption) => void;
  onCustomerCreated: (customer: CustomerOption) => void;
}

const NEW_CUSTOMER_FORM_ID = "new-customer-form";

const INPUT_STYLE: React.CSSProperties = {
  background: "var(--surf-low)",
  border: "none",
  borderRadius: "var(--r-lg)",
  color: "var(--on-surf)",
  fontFamily: "var(--font-body)",
  fontWeight: 400,
  fontSize: "0.875rem",
  height: 44,
};

export default function CustomerSelectorModal({
  open,
  onClose,
  customers,
  onSelect,
  onCustomerCreated,
}: Props) {
  const [mode, setMode] = useState<"search" | "new">("search");
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);

  const filtered = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(query.toLowerCase()) ||
      (c.phone ?? "").includes(query),
  );

  function handleClose() {
    setMode("search");
    setQuery("");
    onClose();
  }

  function handlePickCustomer(c: CustomerOption) {
    onSelect(c);
    handleClose();
  }

  function handleCreated(created: CustomerOption) {
    onCustomerCreated(created);
    onSelect(created);
    handleClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent
        showCloseButton={false}
        className="p-0 gap-0 overflow-hidden"
        style={{
          background: "color-mix(in srgb, var(--surf-bright) 88%, transparent)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          boxShadow: "var(--shadow)",
          borderRadius: "var(--r-xl)",
          maxWidth: 520,
          maxHeight: "88vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* ── Header ── */}
        <DialogHeader className="px-6 pt-6 pb-4 shrink-0">
          <div className="flex items-center justify-between mb-4">
            <DialogTitle
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "1.75rem",
                fontWeight: 700,
                letterSpacing: "-0.01em",
                color: "var(--on-surf)",
              }}
            >
              Seleccionar cliente
            </DialogTitle>

            <button
              onClick={handleClose}
              className="w-9 h-9 flex items-center justify-center transition-colors shrink-0"
              style={{
                borderRadius: "var(--r-full)",
                background: "var(--surf-high)",
                color: "var(--on-surf-var)",
                border: "none",
              }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div
            className="flex p-1 gap-1"
            style={{
              background: "var(--surf-high)",
              borderRadius: "var(--r-full)",
            }}
          >
            {(["search", "new"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 transition-all"
                style={{
                  borderRadius: "var(--r-full)",
                  background:
                    mode === m ? "var(--p-container)" : "transparent",
                  color:
                    mode === m ? "var(--on-p-container)" : "var(--on-surf-var)",
                  fontFamily: "var(--font-body)",
                  fontSize: 12,
                  fontWeight: mode === m ? 600 : 400,
                  boxShadow:
                    mode === m
                      ? "0px 2px 8px -2px rgba(19,27,46,0.12)"
                      : "none",
                }}
              >
                {m === "search" ? (
                  <>
                    <Search className="w-3 h-3" />
                    Buscar cliente
                  </>
                ) : (
                  <>
                    <UserPlus className="w-3 h-3" />
                    Nuevo cliente
                  </>
                )}
              </button>
            ))}
          </div>
        </DialogHeader>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto px-6 pb-6 pt-2">
          {mode === "search" && (
            <div className="flex flex-col gap-3">
              <div className="relative">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none"
                  style={{ color: "var(--on-surf-var)" }}
                />
                <Input
                  autoFocus
                  placeholder="Nombre o teléfono…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="pl-9"
                  style={INPUT_STYLE}
                />
              </div>

              {filtered.length === 0 ? (
                <div
                  className="text-center py-10"
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: 13,
                    color: "var(--on-surf-var)",
                  }}
                >
                  {query ? (
                    <>
                      Sin resultados para{" "}
                      <span style={{ color: "var(--on-surf)", fontWeight: 500 }}>
                        &ldquo;{query}&rdquo;
                      </span>
                      <br />
                      <button
                        type="button"
                        onClick={() => setMode("new")}
                        className="mt-2 inline-flex items-center gap-1 underline underline-offset-2"
                        style={{ color: "var(--p-bright)" }}
                      >
                        <UserPlus className="w-3 h-3" />
                        Crear cliente nuevo
                      </button>
                    </>
                  ) : (
                    "Sin clientes registrados aún."
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-2 pb-2">
                  {filtered.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => handlePickCustomer(c)}
                      className="group flex items-center gap-3 px-4 py-3 text-left transition-all"
                      style={{
                        background: "var(--surf-lowest)",
                        borderRadius: "var(--r-lg)",
                        boxShadow: "var(--shadow)",
                        color: "var(--on-surf)",
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.background =
                          "var(--surf-high)";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.background =
                          "var(--surf-lowest)";
                      }}
                    >
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: "var(--p-container)" }}
                      >
                        <User
                          className="w-4 h-4"
                          style={{ color: "var(--on-p-container)" }}
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div
                          className="truncate"
                          style={{
                            fontFamily: "var(--font-display)",
                            fontSize: 14,
                            fontWeight: 600,
                            color: "var(--on-surf)",
                          }}
                        >
                          {c.name}
                        </div>
                        {c.phone && (
                          <div
                            style={{
                              fontFamily: "var(--font-body)",
                              fontWeight: 400,
                              fontSize: 12,
                              color: "var(--on-surf-var)",
                              marginTop: 2,
                            }}
                          >
                            {c.phone}
                            {c.phone2 && (
                              <span style={{ opacity: 0.6 }}> · {c.phone2}</span>
                            )}
                          </div>
                        )}
                      </div>

                      {c.balance > 0 && (
                        <span
                          className="shrink-0 px-2 py-0.5"
                          style={{
                            background: "var(--sec-container)",
                            color: "var(--on-sec-container)",
                            borderRadius: "var(--r-full)",
                            fontFamily: "var(--font-display)",
                            fontSize: 10,
                            fontWeight: 600,
                            letterSpacing: "0.02em",
                          }}
                        >
                          ${c.balance.toFixed(2)}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {mode === "new" && (
            <CustomerCreateForm
              formId={NEW_CUSTOMER_FORM_ID}
              quickMode
              onCreated={handleCreated}
              onSavingChange={setSaving}
            />
          )}
        </div>

        {/* ── Footer (solo en modo nuevo) ── */}
        {mode === "new" && (
          <div
            className="shrink-0 px-6 py-4 flex gap-3 justify-end"
            style={{ background: "var(--surf-low)" }}
          >
            <button
              type="button"
              onClick={handleClose}
              className="px-5 py-2.5 transition-opacity"
              style={{
                borderRadius: "var(--r-full)",
                border: "1.5px solid rgba(45,106,79,0.2)",
                background: "transparent",
                color: "var(--p)",
                fontFamily: "var(--font-display)",
                fontSize: "0.875rem",
                fontWeight: 600,
              }}
            >
              Cancelar
            </button>

            <button
              type="submit"
              form={NEW_CUSTOMER_FORM_ID}
              disabled={saving}
              className="px-6 py-2.5 text-white transition-opacity disabled:opacity-60"
              style={{
                borderRadius: "var(--r-full)",
                background: "var(--velocity-gradient)",
                fontFamily: "var(--font-display)",
                fontSize: "0.875rem",
                fontWeight: 600,
                border: "none",
                boxShadow: "0px 8px 24px -4px rgba(46,204,113,0.35)",
              }}
            >
              {saving ? "Guardando…" : "Registrar cliente"}
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
