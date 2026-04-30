import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Reporte de salud de jobs cron (Pack D.1 G10/Decisión 17 + Q3 INT-1).
// Read-only — lecturas de JobRun. MANAGER+ only.
//
// MVP D.3: tabla simple. Polish/charts pendiente Hardening si valor lo justifica.

export const dynamic = "force-dynamic";

export default async function JobsHealthPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  const role = session.user.role;
  if (role !== "MANAGER" && role !== "ADMIN") redirect("/reportes");

  const recentRuns = await prisma.jobRun.findMany({
    orderBy: { startedAt: "desc" },
    take: 30,
  });

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const recentByJob = await prisma.jobRun.groupBy({
    by: ["jobName", "status"],
    where: { startedAt: { gte: sevenDaysAgo } },
    _count: true,
  });

  type JobStats = { ok: number; partial: number; failed: number; running: number };
  const jobMap = new Map<string, JobStats>();
  for (const row of recentByJob) {
    const m = jobMap.get(row.jobName) ?? { ok: 0, partial: 0, failed: 0, running: 0 };
    if (row.status === "OK") m.ok = row._count;
    else if (row.status === "PARTIAL") m.partial = row._count;
    else if (row.status === "FAILED") m.failed = row._count;
    else if (row.status === "RUNNING") m.running = row._count;
    jobMap.set(row.jobName, m);
  }

  const jobStats = [...jobMap.entries()]
    .map(([name, m]) => ({
      name,
      ...m,
      total: m.ok + m.partial + m.failed + m.running,
      successRate: (() => {
        const denom = m.ok + m.partial + m.failed;
        return denom === 0 ? null : Math.round((m.ok / denom) * 100);
      })(),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-8 p-4">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Salud de jobs (cron)</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Estado de los crons diarios. JobRun persiste cada corrida para audit + alertas.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Tasa de éxito (últimos 7 días)</h2>
        {jobStats.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin corridas en los últimos 7 días.</p>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="px-3 py-2 font-medium">Job</th>
                  <th className="px-3 py-2 font-medium">OK</th>
                  <th className="px-3 py-2 font-medium">Partial</th>
                  <th className="px-3 py-2 font-medium">Failed</th>
                  <th className="px-3 py-2 font-medium">Total</th>
                  <th className="px-3 py-2 font-medium">% éxito</th>
                </tr>
              </thead>
              <tbody>
                {jobStats.map((s) => (
                  <tr key={s.name} className="border-t">
                    <td className="px-3 py-2 font-mono text-xs">{s.name}</td>
                    <td className="px-3 py-2 tabular-nums">{s.ok}</td>
                    <td className="px-3 py-2 tabular-nums">{s.partial}</td>
                    <td className="px-3 py-2 tabular-nums">{s.failed}</td>
                    <td className="px-3 py-2 tabular-nums">{s.total}</td>
                    <td className="px-3 py-2 tabular-nums">
                      {s.successRate === null ? "—" : `${s.successRate}%`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Últimas 30 corridas</h2>
        {recentRuns.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay corridas registradas todavía.</p>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="px-3 py-2 font-medium">Job</th>
                  <th className="px-3 py-2 font-medium">Estado</th>
                  <th className="px-3 py-2 font-medium">Procesados</th>
                  <th className="px-3 py-2 font-medium">Errores</th>
                  <th className="px-3 py-2 font-medium">Duración</th>
                  <th className="px-3 py-2 font-medium">Inicio</th>
                  <th className="px-3 py-2 font-medium">Mensaje</th>
                </tr>
              </thead>
              <tbody>
                {recentRuns.map((r) => (
                  <tr key={r.id} className="border-t align-top">
                    <td className="px-3 py-2 font-mono text-xs">{r.jobName}</td>
                    <td className="px-3 py-2">
                      <span
                        className={
                          r.status === "OK"
                            ? "text-green-600"
                            : r.status === "PARTIAL"
                              ? "text-amber-600"
                              : r.status === "FAILED"
                                ? "text-red-600"
                                : "text-muted-foreground"
                        }
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 tabular-nums">{r.processedCount}</td>
                    <td className="px-3 py-2 tabular-nums">{r.errorCount}</td>
                    <td className="px-3 py-2 tabular-nums">
                      {r.durationMs == null ? "—" : `${r.durationMs}ms`}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {r.startedAt.toLocaleString("es-MX", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {r.errorMessage ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
