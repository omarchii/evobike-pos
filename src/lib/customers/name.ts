// Split cosmético de nombres. BRIEF.md §4.5.
// NO es una descomposición nombre/apellidos — para lógica de negocio
// SIEMPRE usar `Customer.name` completo.

export interface SplitDisplayName {
  first: string;
  rest: string;
}

export function splitDisplayName(name: string | null | undefined): SplitDisplayName {
  if (!name) return { first: "", rest: "" };
  const trimmed = name.trim();
  if (!trimmed) return { first: "", rest: "" };
  const tokens = trimmed.split(/\s+/);
  if (tokens.length === 1) return { first: tokens[0], rest: "" };
  return { first: tokens[0], rest: tokens.slice(1).join(" ") };
}
