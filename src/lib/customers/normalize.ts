// Normaliza un string para búsqueda tolerante a acentos y mayúsculas.
// Usado para poblar Customer.nameNormalized al crear/actualizar y para
// transformar el query del usuario antes de compararlo.
export function normalizeForSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}
