"use client";

import { useState } from "react";
import { X, UserPlus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CustomerCreateForm, type CustomerOption } from "./customer-create-form";

const FORM_ID = "customer-create-dialog-form";

interface CustomerCreateDialogProps {
  open: boolean;
  onClose: () => void;
  defaultName?: string;
  onCreated: (customer: CustomerOption) => void;
}

export function CustomerCreateDialog({
  open,
  onClose,
  defaultName,
  onCreated,
}: CustomerCreateDialogProps) {
  const [saving, setSaving] = useState(false);

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
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
        <DialogHeader className="px-6 pt-6 pb-4 shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "1.5rem",
                fontWeight: 700,
                letterSpacing: "-0.01em",
                color: "var(--on-surf)",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <UserPlus className="w-5 h-5" style={{ color: "var(--p-bright)" }} />
              Nuevo cliente
            </DialogTitle>

            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 flex items-center justify-center transition-colors shrink-0"
              style={{
                borderRadius: "var(--r-full)",
                background: "var(--surf-high)",
                color: "var(--on-surf-var)",
                border: "none",
              }}
              aria-label="Cerrar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 pb-6 pt-2">
          <CustomerCreateForm
            formId={FORM_ID}
            defaultName={defaultName}
            onCreated={(customer) => {
              onCreated(customer);
              onClose();
            }}
            onSavingChange={setSaving}
          />
        </div>

        <div
          className="shrink-0 px-6 py-4 flex gap-3 justify-end"
          style={{ background: "var(--surf-low)" }}
        >
          <button
            type="button"
            onClick={onClose}
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
            form={FORM_ID}
            disabled={saving}
            className="px-6 py-2.5 text-white transition-opacity disabled:opacity-60"
            style={{
              borderRadius: "var(--r-full)",
              background: "linear-gradient(135deg, #1b4332 0%, #2ecc71 100%)",
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
      </DialogContent>
    </Dialog>
  );
}
