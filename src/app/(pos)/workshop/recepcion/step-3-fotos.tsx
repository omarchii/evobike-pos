"use client";

import { useRef, useState } from "react";
import { useWatch } from "react-hook-form";
import type { Control, UseFormSetValue } from "react-hook-form";
import { Camera, X, Loader2, ImagePlus } from "lucide-react";
import { toast } from "sonner";
import type { WizardFormData } from "./recepcion-wizard";

interface Step3Props {
  control: Control<WizardFormData>;
  setValue: UseFormSetValue<WizardFormData>;
}

interface PhotoEntry {
  id: string;
  url: string | null; // null while uploading
}

async function uploadPhoto(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/workshop/drafts/photos", {
    method: "POST",
    body: fd,
  });
  const data = (await res.json()) as { success: boolean; data?: { url: string }; error?: string };
  if (!data.success) throw new Error(data.error ?? "Error al subir imagen");
  return data.data!.url;
}

export function Step3Fotos({ control, setValue }: Step3Props) {
  const [photos, setPhotos] = useState<PhotoEntry[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoUrls = useWatch({ control, name: "photoUrls" });

  const handleFiles = async (files: FileList) => {
    const remaining = 5 - photos.length;
    const toProcess = Array.from(files).slice(0, remaining);

    for (const file of toProcess) {
      const tempId = crypto.randomUUID();
      setPhotos((prev) => [...prev, { id: tempId, url: null }]);

      try {
        const url = await uploadPhoto(file);
        setPhotos((prev) =>
          prev.map((p) => (p.id === tempId ? { ...p, url } : p)),
        );
        const currentUrls = (photoUrls ?? []) as string[];
        setValue("photoUrls", [...currentUrls, url]);
      } catch (err) {
        setPhotos((prev) => prev.filter((p) => p.id !== tempId));
        toast.error(err instanceof Error ? err.message : "No se pudo subir la imagen");
      }
    }
  };

  const removePhoto = (photoId: string, url: string | null) => {
    setPhotos((prev) => prev.filter((p) => p.id !== photoId));
    if (url) {
      const currentUrls = (photoUrls ?? []) as string[];
      setValue("photoUrls", currentUrls.filter((u) => u !== url));
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files);
  };

  const canAddMore = photos.length < 5;

  return (
    <section aria-labelledby="step3-title" className="space-y-6">
      <h2 id="step3-title" className="sr-only">
        Paso 3: Fotos del estado
      </h2>

      <div className="space-y-2">
        <p className="text-sm" style={{ color: "var(--on-surf-var)" }}>
          Captura evidencia del estado actual. Máximo 5 fotos. Formatos: JPG, PNG, WebP.
        </p>

        {/* Drop zone */}
        {canAddMore && (
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            className="rounded-xl p-8 flex flex-col items-center gap-3 cursor-pointer transition-colors"
            style={{ background: "var(--surf-low)", border: "2px dashed var(--ghost-border, rgba(0,0,0,0.12))" }}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
            aria-label="Área para arrastrar o seleccionar imágenes"
          >
            <Camera size={28} style={{ color: "var(--on-surf-var)" }} aria-hidden />
            <p className="text-sm text-center" style={{ color: "var(--on-surf-var)" }}>
              Arrastra imágenes aquí o{" "}
              <span style={{ color: "var(--p)" }} className="font-medium">
                selecciona archivos
              </span>
            </p>
            <p className="text-xs" style={{ color: "var(--on-surf-var)" }}>
              {photos.length} / 5 fotos
            </p>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/webp"
          multiple
          className="sr-only"
          onChange={(e) => {
            if (e.target.files) handleFiles(e.target.files);
            e.target.value = "";
          }}
          aria-hidden
        />

        {/* Photo grid */}
        {photos.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mt-4">
            {photos.map((photo) => (
              <div
                key={photo.id}
                className="relative rounded-xl overflow-hidden"
                style={{ aspectRatio: "4/3", background: "var(--surf-low)" }}
              >
                {photo.url ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.url}
                      alt="Foto de recepción"
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removePhoto(photo.id, photo.url)}
                      className="absolute top-1.5 right-1.5 rounded-full p-0.5 shadow"
                      style={{ background: "rgba(0,0,0,0.55)" }}
                      aria-label="Quitar foto"
                    >
                      <X size={12} style={{ color: "#fff" }} />
                    </button>
                    <div
                      className="absolute bottom-0 left-0 right-0 px-2 py-1"
                      style={{ background: "rgba(0,0,0,0.35)" }}
                    >
                      <span className="text-xs font-medium" style={{ color: "#fff" }}>
                        <ImagePlus size={10} className="inline mr-1" />
                        Recepción
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Loader2
                      size={20}
                      className="animate-spin"
                      style={{ color: "var(--p)" }}
                      aria-label="Subiendo..."
                    />
                  </div>
                )}
              </div>
            ))}

            {/* Add more button if under limit */}
            {canAddMore && photos.length > 0 && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-xl flex flex-col items-center justify-center gap-2 transition-colors"
                style={{
                  aspectRatio: "4/3",
                  background: "var(--surf-low)",
                  border: "2px dashed var(--ghost-border, rgba(0,0,0,0.12))",
                }}
                aria-label="Agregar más fotos"
              >
                <Camera size={20} style={{ color: "var(--on-surf-var)" }} />
                <span className="text-xs" style={{ color: "var(--on-surf-var)" }}>
                  Agregar
                </span>
              </button>
            )}
          </div>
        )}

        {photos.length >= 5 && (
          <p className="text-xs text-center" style={{ color: "var(--on-surf-var)" }}>
            Límite de 5 fotos alcanzado.
          </p>
        )}
      </div>
    </section>
  );
}
