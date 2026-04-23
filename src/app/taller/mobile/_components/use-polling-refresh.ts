"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Refresca el árbol vía `router.refresh()` cada `intervalMs` mientras la
// pestaña esté visible. Al ocultarse la pestaña el interval se detiene;
// al volver al foreground se dispara un tick inmediato y reanuda.
//
// Decisión del plan P13-G.3: evitar polling en background para no
// hostigar el endpoint ni drenar batería del celular.
export function usePollingRefresh(intervalMs = 60_000) {
  const router = useRouter();

  useEffect(() => {
    let intervalId: number | undefined;

    const tick = () => {
      if (document.visibilityState === "visible") {
        router.refresh();
      }
    };

    const start = () => {
      stop();
      intervalId = window.setInterval(tick, intervalMs);
    };

    const stop = () => {
      if (intervalId !== undefined) {
        window.clearInterval(intervalId);
        intervalId = undefined;
      }
    };

    const onVis = () => {
      if (document.visibilityState === "visible") {
        // Primer tick inmediato al volver al foreground para que el técnico
        // no vea datos viejos si dejó la pestaña un rato.
        router.refresh();
        start();
      } else {
        stop();
      }
    };

    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVis);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [router, intervalMs]);
}
