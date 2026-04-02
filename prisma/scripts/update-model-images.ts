import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// filename key → exact model name substring to search (case-insensitive)
const imageMap: Record<string, string> = {
  aguila:                 'AGUILA',
  aguilapro:              'AGUILA PRO',
  aurora:                 'AURORA',
  bettle:                 'BEETLE',
  colorita:               'COLORITA',
  eclipse:                'ECLIPSE',
  family:                 'FAMILY',
  familyplus:             'FAMILY PLUS',
  familyq:                'FAMILY Q',
  familyqplus:            'FAMILY Q PLUS',
  galaxy:                 'GALAXY',
  galaxyplus:             'GALAXY PLUS',
  golf:                   'GOLF',
  golfplus:               'GOLF PLUS',
  jaguar:                 'JAGUAR',
  leo:                    'LEO',
  lumo:                   'LUMO',
  moped:                  'MOPED',
  polar:                  'POLAR',
  rayo:                   'RAYO',
  rayopro:                'RAYO PRO',
  reina:                  'REINA',
  sol:                    'SOL',
  solara:                 'SOLARA',
  solpro:                 'SOL PRO',
  tauro:                  'TAURO',
  zeus:                   'ZEUS',
  m1:                     'SCOOTER M1',
  m2:                     'SCOOTER M2',
  m3:                     'SCOOTER M3',
  m4:                     'SCOOTER M4',
  m5:                     'SCOOTER M5',
  s6:                     'SCOOTER S6',
  s13:                    'S13',
  s20:                    'S20',
  S9:                     'S9',
  evokid:                 'SCOOTER EVOKID',
  foxy:                   'FOXY',
  python:                 'PHYTON',
  ricochet:               'RICOCHET',
  crooskid:               'CROSS KID',
  evotank:                'EVOTANK',
  ryderpro:               'RYDER PRO',
  tigre:                  'TIGRE',
  urban:                  'URBAN',
  urbex:                  'URBEX',
  vmps5:                  'VMPS5',
  vpms6:                  'VMPS6',
  cargo:                  'CARGO',
};

// Accesorio keys — skip, map in Fase 3
const accesorioKeys = new Set(['baterias5', 'cargador', 'llanta', 'retrovisoresuniversales', 'sillapremium']);

async function main() {
  console.log('🖼  Actualizando imageUrl de modelos...\n');

  let updated = 0;
  const notFound: string[] = [];

  for (const [key, searchName] of Object.entries(imageMap)) {
    const modelo = await prisma.modelo.findFirst({
      where: { nombre: { contains: searchName, mode: 'insensitive' } },
      select: { id: true, nombre: true },
    });

    if (!modelo) {
      console.warn(`  ⚠️  No encontrado en DB: ${key} → "${searchName}"`);
      notFound.push(`${key} (buscando: "${searchName}")`);
      continue;
    }

    await prisma.modelo.update({
      where: { id: modelo.id },
      data: { imageUrl: `/productos/${key}.webp` },
    });

    console.log(`  ✅ ${modelo.nombre} → /productos/${key}.webp`);
    updated++;
  }

  for (const key of accesorioKeys) {
    console.log(`  ℹ️  Accesorio — se mapeará en Fase 3: ${key}.webp`);
  }

  console.log(`\n─── Resultado ──────────────────────────────────`);
  console.log(`  Actualizados: ${updated}`);
  console.log(`  No encontrados (${notFound.length}):`);
  notFound.forEach((n) => console.log(`    · ${n}`));
  console.log(`────────────────────────────────────────────────`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
