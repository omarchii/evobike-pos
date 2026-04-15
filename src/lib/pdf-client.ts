"use client";

import { toast } from "sonner";

/**
 * Descarga un PDF desde la URL dada y lo abre en una pestaña nueva.
 * Maneja errores 412 (sucursal sin configurar) y errores genéricos.
 * Limpia el object URL 60 segundos después de abrirlo.
 */
export async function openPDFInNewTab(url: string): Promise<void> {
  try {
    const res = await fetch(url);
    if (res.status === 412) {
      const data = (await res.json()) as { error?: string };
      toast.error(
        data.error ??
          "Configura los datos de tu sucursal antes de generar documentos",
      );
      return;
    }
    if (!res.ok) {
      toast.error("Error al generar el PDF");
      return;
    }
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    window.open(blobUrl, "_blank");
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
  } catch {
    toast.error("Error de conexión al generar el PDF");
  }
}
