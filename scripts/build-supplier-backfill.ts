// Pack D.bis C.2 — Genera 2 CSVs para que MANAGER procese el backfill de Supplier.
//
// Lee 3 fuentes legacy:
//   - PurchaseReceipt.proveedor (string requerido)
//   - BatteryLot.supplier (nullable)
//   - CashTransaction.beneficiary (nullable, EXPENSE_OUT)
//
// Genera:
//   prisma/data/suppliers-suggested-merge.csv
//     Pares con Levenshtein < 3 → MANAGER aprueba/rechaza merge cada par.
//   prisma/data/suppliers-manual-review.csv
//     Distinct names sin sugerencia de merge → MANAGER asigna RFC + contacto.
//
// Idempotente: re-correr regenera CSVs desde DB. NO escribe nada a DB.
//
// Ejecuta con: npx tsx scripts/build-supplier-backfill.ts

import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { prisma } from "../src/lib/prisma";

const OUT_DIR = path.join(process.cwd(), "prisma", "data");

type SourceCount = {
  purchaseReceipt: number;
  batteryLot: number;
  cashTransaction: number;
};

type Aggregate = {
  /** Nombre normalizado (lowercase + trim + collapse spaces). Clave de dedup. */
  normalized: string;
  /** Variantes originales encontradas en DB (puede haber múltiples spelling). */
  variants: Set<string>;
  sources: SourceCount;
  /** Suma de occurrences en las 3 fuentes. */
  totalCount: number;
};

function normalize(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, " ");
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const m = a.length;
  const n = b.length;
  const prev = new Array<number>(n + 1);
  const curr = new Array<number>(n + 1);

  for (let j = 0; j <= n; j++) prev[j] = j;

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        curr[j - 1] + 1,
        prev[j] + 1,
        prev[j - 1] + cost,
      );
    }
    for (let j = 0; j <= n; j++) prev[j] = curr[j];
  }

  return prev[n];
}

/** Quote CSV cell only when needed (contains comma, quote, or newline). */
function csvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

async function main(): Promise<void> {
  console.log("Recolectando strings de proveedor desde 3 fuentes...");

  const [receipts, lots, txns] = await Promise.all([
    prisma.purchaseReceipt.groupBy({
      by: ["proveedor"],
      _count: { _all: true },
    }),
    prisma.batteryLot.groupBy({
      by: ["supplier"],
      where: { supplier: { not: null } },
      _count: { _all: true },
    }),
    prisma.cashTransaction.groupBy({
      by: ["beneficiary"],
      where: { beneficiary: { not: null }, type: "EXPENSE_OUT" },
      _count: { _all: true },
    }),
  ]);

  console.log(
    `  - PurchaseReceipt.proveedor: ${receipts.length} valores distintos`,
  );
  console.log(`  - BatteryLot.supplier: ${lots.length} valores distintos`);
  console.log(
    `  - CashTransaction.beneficiary (EXPENSE_OUT): ${txns.length} valores distintos`,
  );

  const aggMap = new Map<string, Aggregate>();
  const upsert = (raw: string, source: keyof SourceCount, count: number): void => {
    const norm = normalize(raw);
    if (!norm) return;
    const existing = aggMap.get(norm);
    if (existing) {
      existing.variants.add(raw);
      existing.sources[source] += count;
      existing.totalCount += count;
    } else {
      const sources: SourceCount = { purchaseReceipt: 0, batteryLot: 0, cashTransaction: 0 };
      sources[source] = count;
      aggMap.set(norm, {
        normalized: norm,
        variants: new Set([raw]),
        sources,
        totalCount: count,
      });
    }
  };

  for (const r of receipts) upsert(r.proveedor, "purchaseReceipt", r._count._all);
  for (const l of lots) {
    if (l.supplier) upsert(l.supplier, "batteryLot", l._count._all);
  }
  for (const t of txns) {
    if (t.beneficiary) upsert(t.beneficiary, "cashTransaction", t._count._all);
  }

  const aggregates = Array.from(aggMap.values()).sort((a, b) =>
    a.normalized.localeCompare(b.normalized),
  );
  console.log(`\nTotal nombres distintos (normalizados): ${aggregates.length}`);

  // Pares con Levenshtein < 3
  const LEV_THRESHOLD = 3;
  const suggestedPairs: Array<{
    a: Aggregate;
    b: Aggregate;
    distance: number;
  }> = [];
  const involvedInPair = new Set<string>();

  for (let i = 0; i < aggregates.length; i++) {
    for (let j = i + 1; j < aggregates.length; j++) {
      const a = aggregates[i]!;
      const b = aggregates[j]!;
      // Heurística para evitar O(n²) costoso: descartar si tamaños difieren mucho.
      if (Math.abs(a.normalized.length - b.normalized.length) >= LEV_THRESHOLD) continue;
      const d = levenshtein(a.normalized, b.normalized);
      if (d > 0 && d < LEV_THRESHOLD) {
        suggestedPairs.push({ a, b, distance: d });
        involvedInPair.add(a.normalized);
        involvedInPair.add(b.normalized);
      }
    }
  }

  console.log(
    `Sugerencias de merge (Levenshtein < ${LEV_THRESHOLD}): ${suggestedPairs.length} pares`,
  );

  // Ensure output dir
  mkdirSync(OUT_DIR, { recursive: true });

  // ── suppliers-suggested-merge.csv ────────────────────────────────────────
  const mergeHeader = [
    "approve_merge_y_n",
    "canonical_nombre",
    "left_variant",
    "right_variant",
    "left_count_total",
    "right_count_total",
    "levenshtein_distance",
    "sources_left",
    "sources_right",
    "rfc",
    "telefono",
    "email",
    "contacto",
    "notas",
  ];
  const mergeRows: string[] = [mergeHeader.join(",")];
  for (const pair of suggestedPairs.sort((x, y) => x.a.normalized.localeCompare(y.a.normalized))) {
    const sourcesOf = (g: Aggregate): string =>
      [
        g.sources.purchaseReceipt > 0 ? `PR:${g.sources.purchaseReceipt}` : null,
        g.sources.batteryLot > 0 ? `BL:${g.sources.batteryLot}` : null,
        g.sources.cashTransaction > 0 ? `CT:${g.sources.cashTransaction}` : null,
      ]
        .filter(Boolean)
        .join("|");
    const leftLabel = Array.from(pair.a.variants)[0] ?? pair.a.normalized;
    const rightLabel = Array.from(pair.b.variants)[0] ?? pair.b.normalized;
    mergeRows.push(
      [
        "", // approve_merge_y_n
        leftLabel, // canonical default = la primera variante
        leftLabel,
        rightLabel,
        String(pair.a.totalCount),
        String(pair.b.totalCount),
        String(pair.distance),
        sourcesOf(pair.a),
        sourcesOf(pair.b),
        "", // rfc
        "", // telefono
        "", // email
        "", // contacto
        "", // notas
      ]
        .map(csvCell)
        .join(","),
    );
  }
  const mergePath = path.join(OUT_DIR, "suppliers-suggested-merge.csv");
  writeFileSync(mergePath, mergeRows.join("\n") + "\n", "utf8");
  console.log(`✓ Escrito: ${path.relative(process.cwd(), mergePath)}`);

  // ── suppliers-manual-review.csv ──────────────────────────────────────────
  const reviewHeader = [
    "keep_y_n_or_canonical",
    "raw_variants",
    "normalized",
    "count_total",
    "sources",
    "rfc",
    "telefono",
    "email",
    "contacto",
    "notas",
  ];
  const reviewRows: string[] = [reviewHeader.join(",")];
  for (const g of aggregates) {
    if (involvedInPair.has(g.normalized)) continue; // los que están en suggested-merge se procesan ahí
    const sources = [
      g.sources.purchaseReceipt > 0 ? `PR:${g.sources.purchaseReceipt}` : null,
      g.sources.batteryLot > 0 ? `BL:${g.sources.batteryLot}` : null,
      g.sources.cashTransaction > 0 ? `CT:${g.sources.cashTransaction}` : null,
    ]
      .filter(Boolean)
      .join("|");
    reviewRows.push(
      [
        "", // keep_y_n_or_canonical
        Array.from(g.variants).join(" | "),
        g.normalized,
        String(g.totalCount),
        sources,
        "",
        "",
        "",
        "",
        "",
      ]
        .map(csvCell)
        .join(","),
    );
  }
  const reviewPath = path.join(OUT_DIR, "suppliers-manual-review.csv");
  writeFileSync(reviewPath, reviewRows.join("\n") + "\n", "utf8");
  console.log(`✓ Escrito: ${path.relative(process.cwd(), reviewPath)}`);

  // Stats summary
  const inMerge = involvedInPair.size;
  const inReview = aggregates.length - inMerge;
  console.log(`\nResumen:`);
  console.log(`  - ${suggestedPairs.length} pares en suggested-merge (afectan ${inMerge} nombres)`);
  console.log(`  - ${inReview} nombres únicos en manual-review`);
  console.log(`  - Total nombres a procesar: ${aggregates.length}`);
  console.log(`\nLeyenda sources:`);
  console.log(`  PR = PurchaseReceipt.proveedor`);
  console.log(`  BL = BatteryLot.supplier`);
  console.log(`  CT = CashTransaction.beneficiary (EXPENSE_OUT)`);
  console.log(`  Número = cuántas filas usan ese spelling exacto`);

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error("Fallo:", err);
  await prisma.$disconnect();
  process.exit(1);
});
