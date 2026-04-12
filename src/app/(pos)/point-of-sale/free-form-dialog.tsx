"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus } from "lucide-react";

interface FreeFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (line: { description: string; price: number; quantity: number }) => void;
}

export function FreeFormDialog({
  open,
  onOpenChange,
  onAdd,
}: FreeFormDialogProps) {
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("1");

  const reset = () => {
    setDescription("");
    setPrice("");
    setQuantity("1");
  };

  const parsedPrice = Number.parseFloat(price);
  const parsedQty = Number.parseInt(quantity, 10);
  const canAdd =
    description.trim().length > 0 &&
    Number.isFinite(parsedPrice) &&
    parsedPrice >= 0 &&
    Number.isInteger(parsedQty) &&
    parsedQty > 0;

  const submit = () => {
    if (!canAdd) return;
    onAdd({ description: description.trim(), price: parsedPrice, quantity: parsedQty });
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent
        className="p-0 gap-0 overflow-hidden sm:max-w-sm"
        style={{
          background: "color-mix(in srgb, var(--surf-bright) 92%, transparent)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          boxShadow: "var(--shadow)",
          borderRadius: "var(--r-xl)",
          border: "none",
        }}
      >
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "1.1rem",
              fontWeight: 700,
              color: "var(--on-surf)",
            }}
          >
            Agregar concepto libre
          </DialogTitle>
          <p style={{ color: "var(--on-surf-var)", fontSize: "0.75rem" }}>
            Se cobra pero no afecta inventario ni genera comisión.
          </p>
        </DialogHeader>

        <div className="px-6 pb-5 pt-3 space-y-3">
          <Field label="Descripción">
            <input
              autoFocus
              style={INPUT_STYLE}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="ej. Instalación / ajuste a domicilio"
            />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Precio unitario">
              <div className="relative">
                <span
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px]"
                  style={{ color: "var(--on-surf-var)" }}
                >
                  $
                </span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  style={{ ...INPUT_STYLE, paddingLeft: 20 }}
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="0.00"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && canAdd) submit();
                  }}
                />
              </div>
            </Field>
            <Field label="Cantidad">
              <input
                type="number"
                min={1}
                step={1}
                style={INPUT_STYLE}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && canAdd) submit();
                }}
              />
            </Field>
          </div>
        </div>

        <div
          className="px-6 pb-6 flex gap-2 justify-end"
          style={{ borderTop: "none" }}
        >
          <button
            onClick={() => {
              reset();
              onOpenChange(false);
            }}
            style={{
              padding: "8px 16px",
              borderRadius: 999,
              background: "transparent",
              color: "var(--on-surf-var)",
              fontFamily: "var(--font-body)",
              fontSize: 13,
              fontWeight: 500,
              border: "none",
              cursor: "pointer",
            }}
          >
            Cancelar
          </button>
          <button
            disabled={!canAdd}
            onClick={submit}
            className="flex items-center gap-1.5"
            style={{
              padding: "8px 16px",
              borderRadius: 999,
              background: canAdd
                ? "linear-gradient(135deg, #1B4332, #2ECC71)"
                : "var(--surf-highest)",
              color: canAdd ? "var(--on-p)" : "var(--on-surf-var)",
              fontFamily: "var(--font-body)",
              fontSize: 13,
              fontWeight: 600,
              border: "none",
              cursor: canAdd ? "pointer" : "not-allowed",
            }}
          >
            <Plus className="w-3.5 h-3.5" />
            Agregar
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const INPUT_STYLE: React.CSSProperties = {
  width: "100%",
  background: "var(--surf-lowest)",
  color: "var(--on-surf)",
  border: "1px solid rgba(178,204,192,0.2)",
  borderRadius: "var(--r-md)",
  padding: "8px 10px",
  fontFamily: "var(--font-body)",
  fontSize: 13,
  outline: "none",
};

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span
        style={{
          display: "block",
          fontSize: 10,
          fontWeight: 600,
          color: "var(--on-surf-var)",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}
