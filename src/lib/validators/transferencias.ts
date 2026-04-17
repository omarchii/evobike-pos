import { z } from "zod";

export const transferItemSchema = z
  .object({
    productVariantId: z.string().min(1).nullable().optional(),
    simpleProductId: z.string().min(1).nullable().optional(),
    batteryId: z.string().min(1).nullable().optional(),
    customerBikeId: z.string().min(1).nullable().optional(),
    cantidadEnviada: z.number().int().positive("La cantidad debe ser mayor a cero"),
  })
  .superRefine((data, ctx) => {
    const fks = [
      data.productVariantId,
      data.simpleProductId,
      data.batteryId,
      data.customerBikeId,
    ].filter((v): v is string => typeof v === "string" && v.length > 0);

    if (fks.length !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["productVariantId"],
        message: "Cada ítem debe referenciar exactamente un tipo de producto",
      });
    }

    if ((data.batteryId || data.customerBikeId) && data.cantidadEnviada !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["cantidadEnviada"],
        message: "Baterías y bicicletas de cliente solo admiten cantidad 1",
      });
    }
  });

export const createTransferSchema = z
  .object({
    fromBranchId: z.string().min(1, "Sucursal de origen requerida"),
    toBranchId: z.string().min(1, "Sucursal de destino requerida"),
    items: z.array(transferItemSchema).min(1, "La transferencia debe incluir al menos un ítem"),
    notas: z.string().trim().min(1).nullable().optional(),
    enviarAhora: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.fromBranchId === data.toBranchId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["toBranchId"],
        message: "La sucursal de origen y destino deben ser distintas",
      });
    }
  });

export const patchTransferSchema = z.object({
  notas: z.string().trim().min(1).nullable().optional(),
  items: z.array(transferItemSchema).min(1).optional(),
});

export const recibirTransferSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().min(1, "ID de ítem requerido"),
        cantidadRecibida: z.number().int().min(0, "La cantidad recibida no puede ser negativa"),
      }),
    )
    .min(1, "Se requiere al menos un ítem"),
});

export const cancelarTransferSchema = z.object({
  motivo: z
    .string()
    .trim()
    .min(5, "El motivo debe tener al menos 5 caracteres")
    .max(500, "El motivo no puede superar 500 caracteres"),
});

export const autorizarTransferSchema = z.object({
  despacharInmediato: z.boolean().optional(),
});

export type TransferItemInput = z.infer<typeof transferItemSchema>;
export type CreateTransferInput = z.infer<typeof createTransferSchema>;
export type PatchTransferInput = z.infer<typeof patchTransferSchema>;
export type RecibirTransferInput = z.infer<typeof recibirTransferSchema>;
export type CancelarTransferInput = z.infer<typeof cancelarTransferSchema>;
export type AutorizarTransferInput = z.infer<typeof autorizarTransferSchema>;
