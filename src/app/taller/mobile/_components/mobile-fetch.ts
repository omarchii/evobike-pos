// Fetch helper compartido por los componentes del dashboard móvil.
// Inyecta `x-client: mobile-dashboard` (observabilidad del piloto — los
// endpoints G.0 lo leen) y fuerza `cache: "no-store"` para no ver estado
// viejo entre acciones.

export interface MobileFetchOptions {
  method?: "GET" | "POST" | "PATCH";
  body?: unknown;
  signal?: AbortSignal;
}

interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export async function mobileFetch<T>(
  url: string,
  { method = "GET", body, signal }: MobileFetchOptions = {},
): Promise<T> {
  const res = await fetch(url, {
    method,
    cache: "no-store",
    signal,
    headers: {
      "Content-Type": "application/json",
      "x-client": "mobile-dashboard",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = (await res.json().catch(() => ({}))) as ApiEnvelope<T>;
  if (!res.ok || !payload.success) {
    throw new Error(payload.error ?? `HTTP ${res.status}`);
  }
  return payload.data as T;
}
