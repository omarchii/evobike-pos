import { NextRequest, NextResponse } from "next/server";

// Guard para endpoints HTTP de cron (Pack D.1).
//
// Convención: `Authorization: Bearer ${CRON_SECRET}` — usado por Railway
// cron service o crons externos que invocan /api/cron/runs/daily.
//
// Failsafe: si CRON_SECRET no está configurada en env, rechaza todas las
// requests con 503. Preferimos romper crons antes que dejar el endpoint
// abierto.

export function checkCronAuth(req: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[auth-cron] CRON_SECRET no configurada — rechazando requests");
    return NextResponse.json(
      { success: false, error: "Cron auth no configurado" },
      { status: 503 },
    );
  }

  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json(
      { success: false, error: "No autorizado" },
      { status: 401 },
    );
  }

  return null;
}
