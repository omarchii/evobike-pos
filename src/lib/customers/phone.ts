// Normalización y formato de teléfonos (MX). BRIEF.md §4.1.
// Se almacenan siempre 10 dígitos planos. El país (52) NUNCA va al
// almacenamiento: se añade al formatear para WhatsApp.

const DIGITS_ONLY = /\D/g;

export function normalizePhoneMX(input: string | null | undefined): string | null {
  if (!input) return null;
  const digits = input.replace(DIGITS_ONLY, "");
  if (digits.length < 10) return null;
  // Si vienen 11-13 dígitos (1+52, 52, etc.) tomamos los últimos 10.
  return digits.slice(-10);
}

export function formatPhoneDisplay(raw: string | null | undefined): string {
  const norm = normalizePhoneMX(raw);
  if (!norm) return "";
  return `(${norm.slice(0, 2)}) ${norm.slice(2, 6)} ${norm.slice(6)}`;
}

export function formatPhoneForWhatsApp(raw: string | null | undefined): string | null {
  const norm = normalizePhoneMX(raw);
  if (!norm) return null;
  return `52${norm}`;
}
