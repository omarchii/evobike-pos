import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const modelosSinConfig = await prisma.modelo.findMany({
  where: {
    esBateria: false,
    isActive: true,
    batteryConfigurations: { none: {} },
  },
  select: { nombre: true, categoria: true },
  orderBy: [{ categoria: 'asc' }, { nombre: 'asc' }],
});
console.log(`\n=== Modelos SIN BatteryConfiguration (${modelosSinConfig.length}): ===`);
modelosSinConfig.forEach(m => console.log(`  ${m.categoria ?? 'NULL'}\t${m.nombre}`));

const variantsSinConfig = await prisma.productVariant.findMany({
  where: {
    isActive: true,
    modelo: { esBateria: false, isActive: true },
  },
  include: {
    modelo: { select: { nombre: true, categoria: true, batteryConfigurations: { select: { voltajeId: true } } } },
    voltaje: { select: { valor: true, id: true } },
    color: { select: { nombre: true } },
  },
});

let orphan = 0;
const byModel = new Map();
for (const v of variantsSinConfig) {
  const hasConfigForV = v.modelo.batteryConfigurations.some(bc => bc.voltajeId === v.voltaje_id);
  if (!hasConfigForV) {
    orphan++;
    const k = `${v.modelo.nombre}|${v.voltaje.valor}V`;
    byModel.set(k, (byModel.get(k) ?? 0) + 1);
  }
}
console.log(`\n=== Variants SIN BatteryConfiguration para su (modelo,voltaje) — total ${orphan}: ===`);
[...byModel.entries()].sort().forEach(([k, c]) => console.log(`  ${c}\t${k}`));

const totalVariants = variantsSinConfig.length;
console.log(`\n=== Total variants activos (no baterías): ${totalVariants} ===`);

const allModelos = await prisma.modelo.findMany({ where: { esBateria: false, isActive: true }, include: { configuraciones: true } });
console.log(`\n=== Modelos activos sin ProductVariant: ===`);
const sinVariants = allModelos.filter(m => m.configuraciones.length === 0);
if (sinVariants.length === 0) console.log('  ✅ Todos los modelos tienen variants.');
else sinVariants.forEach(m => console.log(`  ${m.nombre}`));

await prisma.$disconnect();
