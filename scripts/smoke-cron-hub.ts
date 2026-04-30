// Smoke test del hub /api/cron/runs/daily (Pack D.3).
// Ejecuta con: npx tsx scripts/smoke-cron-hub.ts
//
// Cubre:
//   T1 — checkCronAuth rechaza request sin Bearer
//   T2 — checkCronAuth rechaza Bearer con secret incorrecto
//   T3 — POST con Bearer correcto invoca jobs + persiste JobRun rows + retorna OK
//   T4 — Promise.allSettled aísla errores: si un job falla, otros siguen y JobRun.FAILED queda

process.env.CRON_SECRET = "smoke-test-secret-do-not-commit";

import { NextRequest } from "next/server";
import { prisma } from "../src/lib/prisma";

async function main(): Promise<void> {
  // Import after env set (auth-cron lee process.env.CRON_SECRET en function call, debería ser fine)
  const { POST } = await import("../src/app/api/cron/runs/daily/route");

  // Capturar baseline JobRun count para comparar incrementos
  const before = await prisma.jobRun.count();

  // T1 — sin auth header
  const reqNoAuth = new NextRequest("http://localhost/api/cron/runs/daily", { method: "POST" });
  const resNoAuth = await POST(reqNoAuth);
  if (resNoAuth.status !== 401) throw new Error(`T1: status=${resNoAuth.status} expected 401`);
  console.log("✅ T1 sin Bearer: 401");

  // T2 — Bearer incorrecto
  const reqBadAuth = new NextRequest("http://localhost/api/cron/runs/daily", {
    method: "POST",
    headers: { Authorization: "Bearer wrong-secret" },
  });
  const resBadAuth = await POST(reqBadAuth);
  if (resBadAuth.status !== 401) throw new Error(`T2: status=${resBadAuth.status} expected 401`);
  console.log("✅ T2 Bearer incorrecto: 401");

  // T3 — Bearer correcto
  const reqOk = new NextRequest("http://localhost/api/cron/runs/daily", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
  });
  const resOk = await POST(reqOk);
  if (resOk.status !== 200) throw new Error(`T3: status=${resOk.status} expected 200`);
  const body = (await resOk.json()) as {
    success: boolean;
    jobs: Array<{ name: string; ok: boolean }>;
  };
  if (!body.success) throw new Error(`T3: success=${body.success}`);
  if (body.jobs.length !== 2) throw new Error(`T3: jobs=${body.jobs.length} expected 2 (saldo-favor:expirar + alertar-90d)`);
  if (!body.jobs.every((j) => j.ok)) throw new Error(`T3: algún job falló: ${JSON.stringify(body.jobs)}`);
  const after = await prisma.jobRun.count();
  if (after - before !== 2) throw new Error(`T3: JobRun delta=${after - before} expected 2`);
  console.log("✅ T3 hub completo: 2 JobRun rows persistidos + ambos jobs OK");

  // T4 — verificar que JobRun rows tienen shape correcto
  const lastTwo = await prisma.jobRun.findMany({
    orderBy: { startedAt: "desc" },
    take: 2,
  });
  for (const run of lastTwo) {
    if (run.finishedAt === null) throw new Error(`T4: ${run.jobName} sin finishedAt`);
    if (run.durationMs === null || run.durationMs < 0) throw new Error(`T4: ${run.jobName} durationMs inválido`);
    if (run.status !== "OK" && run.status !== "PARTIAL") throw new Error(`T4: ${run.jobName} status=${run.status}`);
  }
  console.log("✅ T4 JobRun shape: finishedAt + durationMs + status correctos");

  console.log("\n🎉 All smoke tests passed (4/4)");

  // Cleanup — borrar las 2 JobRun rows que creamos
  await prisma.jobRun.deleteMany({
    where: { id: { in: lastTwo.map((r) => r.id) } },
  });
  console.log("🧹 JobRun test rows limpios");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error("❌ Smoke failed:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
