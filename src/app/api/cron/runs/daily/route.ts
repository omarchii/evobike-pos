import { NextRequest, NextResponse } from "next/server";
import { checkCronAuth } from "@/lib/auth-cron";
import { prisma } from "@/lib/prisma";
import { enviarAlertas90d, expirarCreditos, type JobResult } from "@/lib/jobs/saldo-favor";
import { alertar120d, alertar173d, expirarPolizas } from "@/lib/jobs/garantias";
import { expirarMensajesPendientes } from "@/lib/jobs/whatsapp-housekeeping";
import { reportarGhostReservations } from "@/lib/jobs/ghost-reservations";
import { expirarCotizaciones, alertarCotizacionesExpirando } from "@/lib/jobs/cotizaciones";

// Cron hub diario (Pack D.1 P6).
//
// Convención: invocado por Railway cron service (o cron externo HTTP) con header
// `Authorization: Bearer ${CRON_SECRET}`. Cada job corre en `Promise.allSettled`
// para aislar errores (un job que falla no detiene a los demás). Cada corrida
// persiste un row en JobRun para audit + reporte de salud `/reportes/jobs`.
//
// ENV var requerida: `CRON_SECRET` — failsafe 503 si no está set (ver auth-cron.ts).

type JobDef = {
  name: string;
  fn: (prismaClient: typeof prisma, opts?: { now?: Date }) => Promise<JobResult>;
};

const JOBS: JobDef[] = [
  { name: "saldo-favor:expirar", fn: expirarCreditos },
  { name: "saldo-favor:alertar-90d", fn: enviarAlertas90d },
  { name: "garantias:alertar-120d", fn: alertar120d },
  { name: "garantias:alertar-173d", fn: alertar173d },
  { name: "garantias:expirar", fn: expirarPolizas },
  { name: "whatsapp:housekeeping", fn: expirarMensajesPendientes },
  { name: "stock:ghost-reservations", fn: reportarGhostReservations },
  { name: "cotizaciones:alertar-expiring-24h", fn: alertarCotizacionesExpirando },
  { name: "cotizaciones:expirar", fn: expirarCotizaciones },
];

type JobRunReport = {
  name: string;
  ok: boolean;
  processedCount?: number;
  errorCount?: number;
  errorMessage?: string | null;
  error?: string;
};

async function runJob(job: JobDef, now: Date): Promise<JobRunReport> {
  const startedAt = new Date();
  try {
    const result = await job.fn(prisma, { now });
    const finishedAt = new Date();
    await prisma.jobRun.create({
      data: {
        jobName: job.name,
        status: result.errorCount > 0 ? "PARTIAL" : "OK",
        startedAt,
        finishedAt,
        durationMs: finishedAt.getTime() - startedAt.getTime(),
        processedCount: result.processedCount,
        errorCount: result.errorCount,
        errorMessage: result.errorMessage,
      },
    });
    return {
      name: job.name,
      ok: true,
      processedCount: result.processedCount,
      errorCount: result.errorCount,
      errorMessage: result.errorMessage,
    };
  } catch (e) {
    const finishedAt = new Date();
    const message = e instanceof Error ? e.message : String(e);
    await prisma.jobRun.create({
      data: {
        jobName: job.name,
        status: "FAILED",
        startedAt,
        finishedAt,
        durationMs: finishedAt.getTime() - startedAt.getTime(),
        processedCount: 0,
        errorCount: 1,
        errorMessage: message.slice(0, 500),
      },
    });
    return { name: job.name, ok: false, error: message };
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const authError = checkCronAuth(req);
  if (authError) return authError;

  const now = new Date();
  const results = await Promise.allSettled(JOBS.map((job) => runJob(job, now)));

  return NextResponse.json({
    success: true,
    runAt: now.toISOString(),
    jobs: results.map((r, i) =>
      r.status === "fulfilled"
        ? r.value
        : { name: JOBS[i]!.name, ok: false, error: String(r.reason) },
    ),
  });
}
