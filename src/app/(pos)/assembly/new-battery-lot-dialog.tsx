"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2, PackagePlus, CheckCircle, AlertCircle } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface BatteryVariantOption {
  id: string;
  sku: string;
  nombre: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  batteryVariants: BatteryVariantOption[];
  onSuccess: () => void;
}

// ── Schema ─────────────────────────────────────────────────────────────────────

const formSchema = z.object({
  productVariantId: z.string().min(1, "Selecciona el tipo de batería"),
  supplier: z.string().optional(),
  reference: z.string().optional(),
  serialsRaw: z.string().min(1, "Ingresa al menos un número de serie"),
});

type FormValues = z.infer<typeof formSchema>;

// ── Helpers ────────────────────────────────────────────────────────────────────

function parseSerials(raw: string): string[] {
  return raw
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// ── Component ──────────────────────────────────────────────────────────────────

export function NewBatteryLotDialog({
  open,
  onOpenChange,
  batteryVariants,
  onSuccess,
}: Props): React.JSX.Element {
  const [isPending, startTransition] = useTransition();
  const [preview, setPreview] = useState<{
    count: number;
    dupes: string[];
  } | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      productVariantId: batteryVariants[0]?.id ?? "",
      supplier: "",
      reference: "",
      serialsRaw: "",
    },
  });

  const handleSerialsChange = (raw: string): void => {
    const serials = parseSerials(raw);
    const seen = new Set<string>();
    const dupes: string[] = [];
    for (const s of serials) {
      if (seen.has(s)) dupes.push(s);
      seen.add(s);
    }
    setPreview({ count: serials.length, dupes });
  };

  const onSubmit = (values: FormValues): void => {
    const serials = parseSerials(values.serialsRaw);
    if (serials.length === 0) {
      form.setError("serialsRaw", { message: "Ingresa al menos un número de serie" });
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch("/api/batteries/lots", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            productVariantId: values.productVariantId,
            supplier: values.supplier || undefined,
            reference: values.reference || undefined,
            serials,
          }),
        });

        const data: { success: boolean; data?: { lotId: string; batteriesCreated: number }; error?: string } =
          await res.json();

        if (!data.success) {
          toast.error(data.error ?? "Error al registrar el lote");
          return;
        }

        toast.success(
          `Lote registrado · ${data.data!.batteriesCreated} baterías en inventario`
        );
        form.reset();
        setPreview(null);
        onOpenChange(false);
        onSuccess();
      } catch {
        toast.error("Error de conexión al registrar el lote");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-lg"
        style={{
          background: "var(--surf-lowest)",
          borderRadius: "1.25rem",
          boxShadow: "0px 24px 48px -8px rgba(0,0,0,0.28)",
        }}
      >
        <DialogHeader>
          <DialogTitle
            className="flex items-center gap-2"
            style={{ fontFamily: "var(--font-display)", fontSize: "1.1rem", fontWeight: 700 }}
          >
            <PackagePlus className="h-5 w-5" style={{ color: "var(--p-bright)" }} />
            Registrar Lote de Baterías
          </DialogTitle>
          <DialogDescription style={{ color: "var(--on-surf-var)", fontSize: "0.8rem" }}>
            Da de alta un lote con sus números de serie individuales.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-2">
            {/* Tipo de batería */}
            <FormField
              control={form.control}
              name="productVariantId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel style={{ fontSize: "0.75rem", fontWeight: 500, color: "var(--on-surf-var)", letterSpacing: "0.04em", textTransform: "uppercase" }}>
                    Tipo de Batería
                  </FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger style={{ background: "var(--surf-lowest)", border: "none", borderRadius: "0.75rem", fontSize: "0.85rem" }}>
                        <SelectValue placeholder="Selecciona tipo" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {batteryVariants.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.nombre} · {v.sku}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Proveedor y Referencia en fila */}
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="supplier"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel style={{ fontSize: "0.75rem", fontWeight: 500, color: "var(--on-surf-var)", letterSpacing: "0.04em", textTransform: "uppercase" }}>
                      Proveedor
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Ej: Shenzhen Co."
                        {...field}
                        style={{ background: "var(--surf-lowest)", border: "none", borderRadius: "0.75rem", fontSize: "0.85rem" }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="reference"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel style={{ fontSize: "0.75rem", fontWeight: 500, color: "var(--on-surf-var)", letterSpacing: "0.04em", textTransform: "uppercase" }}>
                      Referencia del Lote
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Ej: PED-2024-03"
                        {...field}
                        style={{ background: "var(--surf-lowest)", border: "none", borderRadius: "0.75rem", fontSize: "0.85rem" }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Seriales */}
            <FormField
              control={form.control}
              name="serialsRaw"
              render={({ field }) => (
                <FormItem>
                  <FormLabel style={{ fontSize: "0.75rem", fontWeight: 500, color: "var(--on-surf-var)", letterSpacing: "0.04em", textTransform: "uppercase" }}>
                    Números de Serie
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={"BAT-SN-001\nBAT-SN-002\nBAT-SN-003\n..."}
                      rows={7}
                      {...field}
                      onChange={(e) => {
                        field.onChange(e);
                        handleSerialsChange(e.target.value);
                      }}
                      style={{
                        background: "var(--surf-lowest)",
                        border: "none",
                        borderRadius: "0.75rem",
                        fontSize: "0.8rem",
                        fontFamily: "monospace",
                        resize: "vertical",
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Vista previa de conteo */}
            {preview && preview.count > 0 && (
              <div
                className="flex items-start gap-2 px-3 py-2.5 rounded-xl text-xs"
                style={{
                  background: preview.dupes.length > 0 ? "var(--warn-container)" : "var(--sec-container)",
                  color: preview.dupes.length > 0 ? "var(--warn)" : "var(--on-sec-container)",
                }}
              >
                {preview.dupes.length > 0 ? (
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle className="h-4 w-4 shrink-0 mt-0.5" />
                )}
                <div>
                  <span className="font-semibold">{preview.count} seriales</span> detectados.
                  {preview.dupes.length > 0 && (
                    <span className="ml-1">
                      Duplicados en el listado:{" "}
                      <span className="font-mono">{preview.dupes.slice(0, 3).join(", ")}</span>
                      {preview.dupes.length > 3 && ` y ${preview.dupes.length - 3} más`}.
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Botón submit */}
            <Button
              type="submit"
              disabled={isPending || (preview?.dupes.length ?? 0) > 0}
              className="w-full font-semibold"
              style={{
                background: "linear-gradient(135deg, #1b4332, #2ecc71)",
                color: "#ffffff",
                borderRadius: "1.5rem",
                border: "none",
                height: "2.5rem",
              }}
            >
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Registrando…
                </>
              ) : (
                <>
                  <PackagePlus className="h-4 w-4 mr-2" />
                  Registrar Lote {preview && preview.count > 0 ? `(${preview.count} baterías)` : ""}
                </>
              )}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
