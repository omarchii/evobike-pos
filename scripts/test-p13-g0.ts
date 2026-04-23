/**
 * Tests manuales G.0 — hardening de endpoints + log [workshop-mobile].
 *
 * Ejecuta los 8 casos del plan contra el dev server y restaura el estado
 * original al final. Requiere:
 *   1. `npm run dev` corriendo en otra terminal (default http://localhost:3000).
 *   2. Seed aplicado (`npm run db:fresh` o equivalente) con al menos 3
 *      órdenes no-cerradas en branch LEO.
 *
 * Uso:
 *   npx tsx scripts/test-p13-g0.ts
 *   BASE_URL=http://localhost:3001 npx tsx scripts/test-p13-g0.ts
 *
 * Las líneas `[workshop-mobile]` del log aparecen en la terminal del dev
 * server — grep ahí para el paso 8 (ver resumen al final del script).
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const DEFAULT_PASSWORD = "evobike123";
const TECH_A_EMAIL = "tecnico.leo@evobike.mx";
const TECH_B_EMAIL = "tecnico2.leo@evobike.mx";
const MANAGER_EMAIL = "manager.leo@evobike.mx";

const prisma = new PrismaClient();

type CookieJar = Map<string, string>;

function ingestSetCookies(res: Response, jar: CookieJar): void {
  // Node 20+ separa cada Set-Cookie en su propia entrada; el header string
  // concatenado con comas es frágil con nombres que incluyen `.` o valores
  // con `Expires=…, …`.
  const list = res.headers.getSetCookie?.() ?? [];
  for (const raw of list) {
    const [kv] = raw.split(";");
    const eq = kv.indexOf("=");
    if (eq < 0) continue;
    const name = kv.slice(0, eq).trim();
    const value = kv.slice(eq + 1).trim();
    if (value === "" || value === "deleted") jar.delete(name);
    else jar.set(name, value);
  }
}

function cookieHeader(jar: CookieJar): string {
  return Array.from(jar.entries())
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

async function login(email: string, password: string): Promise<CookieJar> {
  const jar: CookieJar = new Map();

  const csrfRes = await fetch(`${BASE_URL}/api/auth/csrf`);
  ingestSetCookies(csrfRes, jar);
  const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };

  const signinRes = await fetch(`${BASE_URL}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      cookie: cookieHeader(jar),
    },
    body: new URLSearchParams({
      email,
      password,
      csrfToken,
      callbackUrl: BASE_URL,
      json: "true",
    }),
    redirect: "manual",
  });
  ingestSetCookies(signinRes, jar);

  if (!jar.has("next-auth.session-token") && !jar.has("__Secure-next-auth.session-token")) {
    let bodyHint = "";
    try {
      bodyHint = ` body=${JSON.stringify(await signinRes.json())}`;
    } catch {
      /* no body */
    }
    throw new Error(
      `Login falló para ${email} (status ${signinRes.status}).${bodyHint}`,
    );
  }
  return jar;
}

type Req = {
  method: "PATCH" | "POST";
  path: string;
  body: unknown;
  jar: CookieJar;
};

async function doReq({ method, path, body, jar }: Req): Promise<{ status: number; json: unknown }> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      cookie: cookieHeader(jar),
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    /* empty body */
  }
  return { status: res.status, json };
}

type CaseResult = { name: string; pass: boolean; detail: string };

function record(results: CaseResult[], name: string, pass: boolean, detail: string): void {
  results.push({ name, pass, detail });
  const icon = pass ? "✅" : "❌";
  console.log(`  ${icon} ${name} — ${detail}`);
}

async function main(): Promise<void> {
  console.log(`→ Base URL: ${BASE_URL}\n`);
  console.log("Paso 1/4 — preparando datos…");

  const branch = await prisma.branch.findUnique({ where: { code: "LEO" } });
  if (!branch) throw new Error("Branch LEO no existe. Corre seed primero.");

  const techA = await prisma.user.findUnique({ where: { email: TECH_A_EMAIL } });
  if (!techA) throw new Error(`${TECH_A_EMAIL} no existe. Corre seed primero.`);

  const techB = await prisma.user.upsert({
    where: { email: TECH_B_EMAIL },
    update: { isActive: true, branchId: branch.id, role: "TECHNICIAN" },
    create: {
      email: TECH_B_EMAIL,
      name: "Técnico Leo 2",
      role: "TECHNICIAN",
      branchId: branch.id,
      password: bcrypt.hashSync(DEFAULT_PASSWORD, 10),
    },
  });

  const manager = await prisma.user.findUnique({ where: { email: MANAGER_EMAIL } });
  if (!manager) throw new Error(`${MANAGER_EMAIL} no existe.`);

  // 3 órdenes no-cerradas en LEO. Evitamos DELIVERED/CANCELLED (están bloqueadas en /assign).
  const pool = await prisma.serviceOrder.findMany({
    where: {
      branchId: branch.id,
      status: { in: ["PENDING", "IN_PROGRESS"] },
    },
    select: { id: true, folio: true, assignedTechId: true, status: true, subStatus: true },
    take: 3,
    orderBy: { createdAt: "asc" },
  });
  if (pool.length < 3) {
    throw new Error(
      `Necesito 3 órdenes PENDING/IN_PROGRESS en LEO; hay ${pool.length}. Corre \`npm run db:fresh\`.`,
    );
  }
  const [orderA, orderB, orderFree] = pool;

  // Snapshot para restaurar al final.
  const snapshot = pool.map((o) => ({
    id: o.id,
    assignedTechId: o.assignedTechId,
    status: o.status,
    subStatus: o.subStatus,
  }));

  // Forzar estado esperado para los tests.
  await prisma.serviceOrder.update({
    where: { id: orderA.id },
    data: { assignedTechId: techA.id, status: "PENDING", subStatus: null },
  });
  await prisma.serviceOrder.update({
    where: { id: orderB.id },
    data: { assignedTechId: techB.id, status: "IN_PROGRESS", subStatus: null },
  });
  await prisma.serviceOrder.update({
    where: { id: orderFree.id },
    data: { assignedTechId: null, status: "PENDING", subStatus: null },
  });

  console.log(`   orderA=${orderA.folio} (tech A, PENDING)`);
  console.log(`   orderB=${orderB.folio} (tech B, IN_PROGRESS)`);
  console.log(`   orderFree=${orderFree.folio} (libre, PENDING)\n`);

  console.log("Paso 2/4 — login…");
  const aJar = await login(TECH_A_EMAIL, DEFAULT_PASSWORD);
  const mJar = await login(MANAGER_EMAIL, DEFAULT_PASSWORD);
  console.log("   tech A y manager logueados.\n");

  const results: CaseResult[] = [];
  console.log("Paso 3/4 — ejecutando casos:");

  try {
    // 1. A → PATCH /status sobre orden A (PENDING→IN_PROGRESS) → 200.
    {
      const r = await doReq({
        method: "PATCH",
        path: `/api/workshop/orders/${orderA.id}/status`,
        body: { currentStatus: "PENDING" },
        jar: aJar,
      });
      record(results, "1. A avanza orden A (propia) → 200", r.status === 200, `status=${r.status}`);
    }

    // Revertir orderA a PENDING para casos siguientes (ya quedó IN_PROGRESS).
    await prisma.serviceOrder.update({
      where: { id: orderA.id },
      data: { status: "PENDING", subStatus: null },
    });

    // 2. A → PATCH /status sobre orden B → 403.
    {
      const r = await doReq({
        method: "PATCH",
        path: `/api/workshop/orders/${orderB.id}/status`,
        body: { currentStatus: "IN_PROGRESS" },
        jar: aJar,
      });
      record(results, "2. A avanza orden B (ajena) → 403", r.status === 403, `status=${r.status}`);
    }

    // 3. A → POST /sub-status sobre orden B → 403.
    {
      const r = await doReq({
        method: "POST",
        path: `/api/service-orders/${orderB.id}/sub-status`,
        body: { subStatus: "WAITING_PARTS" },
        jar: aJar,
      });
      record(results, "3. A pone sub-status a orden B (ajena) → 403", r.status === 403, `status=${r.status}`);
    }

    // 4. A → PATCH /assign { null } sobre orden B → 403.
    {
      const r = await doReq({
        method: "PATCH",
        path: `/api/service-orders/${orderB.id}/assign`,
        body: { assignedTechId: null },
        jar: aJar,
      });
      record(results, "4. A suelta orden B (ajena) → 403", r.status === 403, `status=${r.status}`);
    }

    // 5. A → PATCH /assign { null } sobre orden A → 200.
    {
      const r = await doReq({
        method: "PATCH",
        path: `/api/service-orders/${orderA.id}/assign`,
        body: { assignedTechId: null },
        jar: aJar,
      });
      record(results, "5. A suelta orden A (propia) → 200", r.status === 200, `status=${r.status}`);
    }

    // 6. A → PATCH /assign { A } sobre orden libre → 200.
    {
      const r = await doReq({
        method: "PATCH",
        path: `/api/service-orders/${orderFree.id}/assign`,
        body: { assignedTechId: techA.id },
        jar: aJar,
      });
      record(results, "6. A toma orden libre (self-assign) → 200", r.status === 200, `status=${r.status}`);
    }

    // 7. MANAGER → PATCH /status sobre orden B → 200 (regresión).
    {
      const r = await doReq({
        method: "PATCH",
        path: `/api/workshop/orders/${orderB.id}/status`,
        body: { currentStatus: "IN_PROGRESS" },
        jar: mJar,
      });
      record(results, "7. MANAGER avanza orden B (regresión) → 200", r.status === 200, `status=${r.status}`);
    }
  } finally {
    console.log("\nPaso 4/4 — restaurando assignments originales…");
    for (const s of snapshot) {
      await prisma.serviceOrder.update({
        where: { id: s.id },
        data: {
          assignedTechId: s.assignedTechId,
          status: s.status,
          subStatus: s.subStatus,
        },
      });
    }
    console.log("   ok.\n");
  }

  const passed = results.filter((r) => r.pass).length;
  console.log("─".repeat(60));
  console.log(`Resultado: ${passed}/${results.length} casos OK.`);
  console.log("─".repeat(60));
  console.log(
    "\nPaso 8 (manual) — en la terminal del dev server busca:",
    "\n   [workshop-mobile] ...",
    "\nDeben aparecer 4 líneas (casos 1, 5, 6, 7). Los casos 2/3/4 son 403",
    "y no llegan al log. Todas con `mobileClient: false` hasta que G.3",
    "mande el header x-client=mobile-dashboard.",
  );

  if (passed !== results.length) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error("\nFATAL:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
