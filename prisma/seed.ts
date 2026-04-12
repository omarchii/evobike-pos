import { PrismaClient, Prisma, SimpleProductCategoria, MovementType } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import * as bcrypt from 'bcryptjs';
import { normalizeModeloAplicable } from '../src/lib/products';
import { seedTransactional } from './seed-transactional';

const prisma = new PrismaClient();

// ─── Helper CSV ───────────────────────────────────────────────────────────────
function parseCSV(filePath: string): Record<string, string>[] {
  if (!fs.existsSync(filePath)) {
    console.warn(`Archivo no encontrado: ${filePath}`);
    return [];
  }
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter((line) => line.trim() !== '');
  if (lines.length < 2) return [];

  const headers = lines[0]
    .split(',')
    .map((h) => h.trim().replace(/^"|"$/g, '').replace(/^\uFEFF/, ''));

  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const rawValues = lines[i].match(/(?:"([^"]*(?:""[^"]*)*)")|([^,]+)/g);
    if (!rawValues) continue;

    const values = rawValues.map((v) => {
      let val = v.trim();
      if (val.startsWith('"') && val.endsWith('"')) {
        val = val.substring(1, val.length - 1).replace(/""/g, '"');
      }
      return val;
    });

    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = values[index] !== undefined ? values[index] : '';
    });
    rows.push(row);
  }
  return rows;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🌱 Iniciando seed de evobike-pos2...\n');

  // ── 1. Sucursales ────────────────────────────────────────────────────────────
  const TERMINOS_COTIZACION_DEFAULT = [
    'Vigencia: esta cotización es válida por 7 días naturales a partir de su fecha de emisión.',
    'Los precios están expresados en pesos mexicanos (MXN) e incluyen IVA cuando aplique.',
    'Precios y existencias sujetos a disponibilidad al momento de confirmar el pedido.',
    'Formas de pago aceptadas: efectivo, tarjeta de débito/crédito, transferencia bancaria y financiamiento (sujeto a aprobación).',
    'La aceptación de esta cotización implica la aceptación de estos términos.',
  ].join('\n\n');

  const TERMINOS_PEDIDO_DEFAULT = [
    'Apartado: el cliente deberá cubrir un anticipo mínimo y pagos parciales según lo acordado. El vehículo permanece resguardado en la sucursal hasta su liquidación total.',
    'Tiempo de resguardo: 30 días naturales a partir del último abono. Vencido este plazo sin movimiento, el apartado podrá cancelarse y los anticipos se conservarán como saldo a favor para compras posteriores.',
    'Backorder: los tiempos de entrega son estimados y dependen de la disponibilidad del proveedor. Se notificará al cliente cualquier cambio en la fecha prevista.',
    'La mercancía se libera únicamente al liquidar el total del pedido.',
    'Cualquier cancelación por parte del cliente estará sujeta a una penalización equivalente al 10% del anticipo.',
  ].join('\n\n');

  const TERMINOS_POLIZA_DEFAULT = [
    'Cobertura: la presente póliza ampara defectos de fabricación del vehículo eléctrico durante el período indicado en el documento de venta.',
    'Exclusiones: esta garantía no cubre daños por uso indebido, accidentes, modificaciones no autorizadas, falta de mantenimiento, desgaste normal de piezas consumibles (llantas, frenos, luces) ni daños provocados por agentes externos (agua, golpes, robo).',
    'Mantenimientos obligatorios: el cliente se compromete a realizar los mantenimientos programados en cualquiera de nuestras sucursales autorizadas para conservar la vigencia de esta póliza.',
    'Proceso de reclamación: presentar el vehículo en la sucursal de venta junto con esta póliza y el comprobante de compra. El diagnóstico será realizado por nuestro taller autorizado.',
    'La sustitución de baterías bajo garantía está sujeta al análisis del lote y número de serie registrado al momento de la venta.',
  ].join('\n\n');

  const BRANCH_DEFAULTS = {
    rfc: 'CONFIGURAR RFC',
    razonSocial: 'CONFIGURAR RAZÓN SOCIAL',
    regimenFiscal: 'CONFIGURAR RÉGIMEN FISCAL',
    phone: 'CONFIGURAR TELÉFONO',
    email: 'configurar@evobike.mx',
    terminosCotizacion: TERMINOS_COTIZACION_DEFAULT,
    terminosPedido: TERMINOS_PEDIDO_DEFAULT,
    terminosPoliza: TERMINOS_POLIZA_DEFAULT,
  };

  const leoBranch = await prisma.branch.upsert({
    where: { code: 'LEO' },
    update: {},
    create: {
      code: 'LEO',
      name: 'Sucursal Leo',
      address: 'Cancún, Q.R. Leo',
      ...BRANCH_DEFAULTS,
    },
  });

  const av135Branch = await prisma.branch.upsert({
    where: { code: 'AV135' },
    update: {},
    create: {
      code: 'AV135',
      name: 'Sucursal Av 135',
      address: 'Cancún, Q.R. Av 135',
      ...BRANCH_DEFAULTS,
    },
  });

  console.log(`✅ Sucursales: ${leoBranch.code}, ${av135Branch.code}`);

  // ── 2. Usuarios ──────────────────────────────────────────────────────────────
  // Contraseña por defecto para todos los usuarios de prueba: "evobike123"
  const defaultPassword = await bcrypt.hash('evobike123', 10);

  const users = [
    // ADMIN — puede ver todas las sucursales
    {
      email: 'admin@evobike.mx',
      name: 'Admin General',
      role: 'ADMIN' as const,
      branchId: leoBranch.id,
    },
    // Managers
    {
      email: 'manager.leo@evobike.mx',
      name: 'Manager Leo',
      role: 'MANAGER' as const,
      branchId: leoBranch.id,
    },
    {
      email: 'manager.av135@evobike.mx',
      name: 'Manager AV135',
      role: 'MANAGER' as const,
      branchId: av135Branch.id,
    },
    // Vendedores
    {
      email: 'vendedor.leo@evobike.mx',
      name: 'Vendedor Leo',
      role: 'SELLER' as const,
      branchId: leoBranch.id,
    },
    {
      email: 'vendedor.av135@evobike.mx',
      name: 'Vendedor AV135',
      role: 'SELLER' as const,
      branchId: av135Branch.id,
    },
    // Técnicos
    {
      email: 'tecnico.leo@evobike.mx',
      name: 'Técnico Leo',
      role: 'TECHNICIAN' as const,
      branchId: leoBranch.id,
    },
    {
      email: 'tecnico.av135@evobike.mx',
      name: 'Técnico AV135',
      role: 'TECHNICIAN' as const,
      branchId: av135Branch.id,
    },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: { ...u, password: defaultPassword },
    });
  }

  console.log(`✅ Usuarios creados (${users.length}) — contraseña: evobike123`);

  // ── 3. Cliente demo ──────────────────────────────────────────────────────────
  await prisma.customer.upsert({
    where: { phone: '9981234567' },
    update: {},
    create: {
      name: 'Cliente Mostrador',
      phone: '9981234567',
      email: 'mostrador@evobike.mx',
      creditLimit: 0,
      balance: 0,
    },
  });

  console.log('✅ Cliente demo creado\n');

  // ── 4. Catálogo desde CSV ────────────────────────────────────────────────────
  const dataDir = path.join(process.cwd(), 'prisma', 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir);
    console.warn("⚠️  Directorio 'prisma/data' creado. Agrega los CSV para poblar el catálogo.");
    return;
  }

  const modelosMap = new Map<string, string>();
  const coloresMap = new Map<string, string>();
  const voltajesMap = new Map<string, string>();

  // 4a. Modelos
  const modelosCSV = parseCSV(path.join(dataDir, 'modelos.csv'));
  for (const row of modelosCSV) {
    if (!row.nombre) continue;
    const dbModelo = await prisma.modelo.upsert({
      where: { nombre: row.nombre },
      update: {
        descripcion: row.descripcion || null,
        requiere_vin:
          row.requiere_vin?.toLowerCase() === 'verdadero' ||
          row.requiere_vin?.toLowerCase() === 'true',
      },
      create: {
        nombre: row.nombre,
        descripcion: row.descripcion || null,
        requiere_vin:
          row.requiere_vin?.toLowerCase() !== 'falso' &&
          row.requiere_vin?.toLowerCase() !== 'false',
      },
    });
    if (row.id) modelosMap.set(row.id, dbModelo.id);
  }

  // 4b. Colores
  const coloresCSV = parseCSV(path.join(dataDir, 'colores.csv'));
  for (const row of coloresCSV) {
    if (!row.nombre) continue;
    const dbColor = await prisma.color.upsert({
      where: { nombre: row.nombre },
      update: {},
      create: { nombre: row.nombre },
    });
    if (row.id) coloresMap.set(row.id, dbColor.id);
  }

  // 4c. Voltajes
  const voltajesCSV = parseCSV(path.join(dataDir, 'voltajes.csv'));
  for (const row of voltajesCSV) {
    if (!row.valor) continue;
    const valorInt = parseInt(row.valor);
    if (isNaN(valorInt)) continue;
    const dbVoltaje = await prisma.voltaje.upsert({
      where: { valor: valorInt },
      update: { label: row.label || `${valorInt}V` },
      create: { valor: valorInt, label: row.label || `${valorInt}V` },
    });
    if (row.id) voltajesMap.set(row.id, dbVoltaje.id);
  }

  console.log(
    `✅ Catálogos base — Modelos: ${modelosMap.size}, Colores: ${coloresMap.size}, Voltajes: ${voltajesMap.size}`
  );

  // 4d. ModeloColor (disponibles)
  const disponiblesCSV = parseCSV(path.join(dataDir, 'modelo_color_disponible.csv'));
  for (const row of disponiblesCSV) {
    if (!row.modelo_id || !row.color_id) continue;
    const modeloId = modelosMap.get(row.modelo_id);
    const colorId = coloresMap.get(row.color_id);
    if (modeloId && colorId) {
      try {
        await prisma.modeloColor.create({ data: { modelo_id: modeloId, color_id: colorId } });
      } catch {
        // Ignorar duplicados — upsert no disponible sin unique compuesto nombrado
      }
    }
  }

  // 4e. ProductVariants + Stock
  const configuracionesCSV = parseCSV(path.join(dataDir, 'modelo_configuracion.csv'));
  let configsCreated = 0;

  for (const row of configuracionesCSV) {
    if (!row.sku || !row.modelo_id || !row.color_id || !row.voltaje_id) continue;

    const modeloId = modelosMap.get(row.modelo_id);
    const colorId = coloresMap.get(row.color_id);
    const voltajeId = voltajesMap.get(row.voltaje_id);

    if (!modeloId || !colorId || !voltajeId) {
      console.warn(`⚠️  Saltando SKU ${row.sku} — dependencias faltantes`);
      continue;
    }

    try {
      const variant = await prisma.productVariant.upsert({
        where: { sku: row.sku },
        update: {
          precioPublico: parseFloat(row.precioPublico) || 0,
          costo: parseFloat(row.costo) || 0,
        },
        create: {
          sku: row.sku,
          precioPublico: parseFloat(row.precioPublico) || 0,
          costo: parseFloat(row.costo) || 0,
          modelo_id: modeloId,
          color_id: colorId,
          voltaje_id: voltajeId,
        },
      });

      const stockLeo = parseInt(row.stock_leo) || 0;
      const stockAv135 = parseInt(row.stock_av135) || 0;

      await prisma.stock.upsert({
        where: { productVariantId_branchId: { productVariantId: variant.id, branchId: leoBranch.id } },
        update: { quantity: stockLeo },
        create: { productVariantId: variant.id, branchId: leoBranch.id, quantity: stockLeo },
      });

      await prisma.stock.upsert({
        where: { productVariantId_branchId: { productVariantId: variant.id, branchId: av135Branch.id } },
        update: { quantity: stockAv135 },
        create: { productVariantId: variant.id, branchId: av135Branch.id, quantity: stockAv135 },
      });

      configsCreated++;
    } catch (e: unknown) {
      if (e instanceof Error && 'code' in e && (e as NodeJS.ErrnoException).code === 'P2002') {
        console.warn(`⚠️  SKU ${row.sku} duplicado, omitido.`);
      } else {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`❌ Error en SKU ${row.sku}:`, msg);
      }
    }
  }

  console.log(`✅ Variantes de producto cargadas: ${configsCreated}`);
  // ── 5. Baterías y Configuraciones ───────────────────────────────────────────
  console.log('\n⚡ Configurando trazabilidad de baterías...');

  const genericColor = await prisma.color.upsert({
    where: { nombre: 'N/A' },
    update: { isGeneric: true },
    create: { nombre: 'N/A', isGeneric: true },
  });

  const bateriaModelo = await prisma.modelo.upsert({
    where: { nombre: 'Batería' },
    update: { requiere_vin: false },
    create: { nombre: 'Batería', descripcion: 'Batería genérica', requiere_vin: false },
  });

  const voltaje12V = await prisma.voltaje.upsert({
    where: { valor: 12 },
    update: { label: '12V' },
    create: { valor: 12, label: '12V' },
  });

  const batteryVariantSku = 'BAT-12V-GEN';
  const batteryVariant = await prisma.productVariant.upsert({
    where: { sku: batteryVariantSku },
    update: {},
    create: {
      sku: batteryVariantSku,
      precioPublico: 1000,
      costo: 800,
      modelo_id: bateriaModelo.id,
      color_id: genericColor.id,
      voltaje_id: voltaje12V.id,
    },
  });

  const fixedConfigs: Array<{ modeloName: string; voltajes: Record<number, number> }> = [
    { modeloName: 'AGUILA', voltajes: { 60: 5, 72: 6 } },
    { modeloName: 'AGUILA PRO', voltajes: { 60: 5, 72: 6 } },
    { modeloName: 'AURORA', voltajes: { 60: 5, 72: 6 } },
    { modeloName: 'BEETLE', voltajes: { 48: 4, 60: 5 } },
    { modeloName: 'COLORITA', voltajes: { 48: 4, 60: 5 } },
    { modeloName: 'ECLIPSE', voltajes: { 60: 5, 72: 6 } },
    { modeloName: 'FAMILY', voltajes: { 48: 4, 60: 5, 72: 6 } },
    { modeloName: 'FAMILY Q', voltajes: { 48: 4, 60: 5, 72: 6 } },
    { modeloName: 'FAMILY Q PLUS', voltajes: { 48: 4, 60: 5, 72: 6 } },
    { modeloName: 'GALAXY', voltajes: { 48: 4, 60: 5, 72: 6 } },
    { modeloName: 'GALAXY PLUS', voltajes: { 48: 4, 60: 5, 72: 6 } },
    { modeloName: 'GOLF', voltajes: { 60: 5, 72: 6 } },
    { modeloName: 'GOLF PLUS', voltajes: { 60: 5, 72: 6 } },
    { modeloName: 'JAGUAR', voltajes: { 60: 5, 72: 6 } },
    { modeloName: 'LEO', voltajes: { 60: 5, 72: 6 } },
    { modeloName: 'LUMO', voltajes: { 48: 4, 60: 5 } },
    { modeloName: 'MOPED', voltajes: { 48: 4, 60: 5 } },
    { modeloName: 'POLAR', voltajes: { 60: 5, 72: 6 } },
    { modeloName: 'PRIMAVERA', voltajes: { 48: 4, 60: 5 } },
    { modeloName: 'RAYO', voltajes: { 60: 5, 72: 6 } },
    { modeloName: 'RAYO PRO', voltajes: { 60: 5, 72: 6 } },
    { modeloName: 'REINA', voltajes: { 60: 5, 72: 6 } },
    { modeloName: 'SOL', voltajes: { 48: 4, 60: 5 } },
    { modeloName: 'TAURO', voltajes: { 48: 4, 60: 5 } },
    { modeloName: 'ZEUS', voltajes: { 60: 5, 72: 6 } },
  ];

  const singleBatteryModels = [
    'SCOOTER M1', 'SCOOTER M2', 'SCOOTER M3', 'SCOOTER M4', 'SCOOTER M5', 'SCOOTER S6',
    'SCOOTER EVOKID', 'RICOCHET', 'PHYTON', 'FOXY', 'CROSS KID',
  ];

  for (const config of fixedConfigs) {
    const modelo = await prisma.modelo.findUnique({ where: { nombre: config.modeloName } });
    if (!modelo) {
      console.warn(`  ⚠️ Modelo "${config.modeloName}" no encontrado en DB. Se omite.`);
      continue;
    }
    for (const [v, qty] of Object.entries(config.voltajes)) {
      const volInt = parseInt(v);
      const voltaje = await prisma.voltaje.findUnique({ where: { valor: volInt } });
      if (!voltaje) continue;
      
      await prisma.batteryConfiguration.upsert({
        where: {
          modeloId_voltajeId_batteryVariantId: {
            modeloId: modelo.id,
            voltajeId: voltaje.id,
            batteryVariantId: batteryVariant.id,
          },
        },
        update: { quantity: qty },
        create: {
          modeloId: modelo.id,
          voltajeId: voltaje.id,
          batteryVariantId: batteryVariant.id,
          quantity: qty,
        },
      });
    }
  }

  for (const modelName of singleBatteryModels) {
    const modelo = await prisma.modelo.findUnique({ where: { nombre: modelName } });
    if (!modelo) {
      console.warn(`  ⚠️ Modelo "${modelName}" no encontrado en DB. Se omite.`);
      continue;
    }
    const variants = await prisma.productVariant.findMany({
      where: { modelo_id: modelo.id },
      select: { voltaje_id: true },
    });
    const uniqueVoltages = Array.from(new Set(variants.map(v => v.voltaje_id)));
    for (const vid of uniqueVoltages) {
      await prisma.batteryConfiguration.upsert({
        where: {
          modeloId_voltajeId_batteryVariantId: {
            modeloId: modelo.id,
            voltajeId: vid,
            batteryVariantId: batteryVariant.id,
          },
        },
        update: { quantity: 1 },
        create: {
          modeloId: modelo.id,
          voltajeId: vid,
          batteryVariantId: batteryVariant.id,
          quantity: 1,
        },
      });
    }
  }
  console.log('✅ Configuraciones de trazabilidad de baterías aplicadas.');

  // ── 6. SimpleProducts (accesorios, cargadores, baterías standalone, refacciones) ──
  console.log('\n📦 Cargando SimpleProducts desde CSV...');

  const adminUser = await prisma.user.findUnique({ where: { email: 'admin@evobike.mx' } });
  if (!adminUser) throw new Error('Usuario admin no encontrado — no se puede seedear inventario.');

  const validCategorias = new Set<string>([
    'ACCESORIO', 'CARGADOR', 'BATERIA_STANDALONE', 'REFACCION',
  ]);

  interface SimpleProductRow {
    codigo: string;
    nombre: string;
    categoria: string;
    modelo_aplicable: string;
    precio_publico: string;
    precio_distribuidor: string;
    stock_minimo: string;
    stock_maximo: string;
    descripcion?: string;
  }

  function toDecimal(raw: string | undefined): Prisma.Decimal {
    const n = Number(raw);
    return new Prisma.Decimal(Number.isFinite(n) ? n : 0);
  }

  function toInt(raw: string | undefined, fallback = 0): number {
    const n = parseInt(raw ?? '', 10);
    return Number.isFinite(n) ? n : fallback;
  }

  async function loadSimpleProductsFromCSV(
    fileName: string,
    defaultCategoria: SimpleProductCategoria | null,
  ): Promise<{ loaded: number; skipped: number }> {
    const filePath = path.join(dataDir, fileName);
    if (!fs.existsSync(filePath)) {
      throw new Error(`CSV requerido no encontrado: ${filePath}`);
    }
    const rows = parseCSV(filePath) as unknown as SimpleProductRow[];
    let loaded = 0;
    let skipped = 0;

    for (const row of rows) {
      try {
        const codigo = row.codigo?.trim();
        const nombre = row.nombre?.trim();
        if (!codigo || !nombre) {
          console.warn(`  ⚠️  Fila malformada (codigo/nombre vacío), omitida.`);
          skipped++;
          continue;
        }

        const categoriaRaw = (row.categoria || '').toUpperCase().trim();
        const categoria = (validCategorias.has(categoriaRaw)
          ? (categoriaRaw as SimpleProductCategoria)
          : defaultCategoria);
        if (!categoria) {
          console.warn(`  ⚠️  Categoría inválida "${row.categoria}" en ${codigo}, omitida.`);
          skipped++;
          continue;
        }

        const normalized = normalizeModeloAplicable(row.modelo_aplicable);
        const modeloAplicable = normalized === 'GLOBAL' ? null : normalized;

        const data = {
          codigo,
          nombre,
          descripcion: row.descripcion?.trim() || null,
          categoria,
          modeloAplicable,
          precioPublico: toDecimal(row.precio_publico),
          precioMayorista: toDecimal(row.precio_distribuidor),
          stockMinimo: toInt(row.stock_minimo),
          stockMaximo: toInt(row.stock_maximo),
        };

        await prisma.simpleProduct.upsert({
          where: { codigo },
          update: data,
          create: data,
        });
        loaded++;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`  ❌ Error en fila ${row.codigo ?? '(sin código)'}: ${msg}`);
        skipped++;
      }
    }
    return { loaded, skipped };
  }

  const accesoriosResult = await loadSimpleProductsFromCSV('accesorios.csv', null);
  console.log(
    `✅ Accesorios: ${accesoriosResult.loaded} cargados, ${accesoriosResult.skipped} omitidos.`,
  );

  const refaccionesResult = await loadSimpleProductsFromCSV(
    'refacciones.csv',
    SimpleProductCategoria.REFACCION,
  );
  console.log(
    `✅ Refacciones: ${refaccionesResult.loaded} cargados, ${refaccionesResult.skipped} omitidos.`,
  );

  // ── 7. Stock inicial de SimpleProducts por sucursal ─────────────────────────
  console.log('\n📊 Generando stock inicial por sucursal...');

  const allSimpleProducts = await prisma.simpleProduct.findMany({
    select: { id: true, codigo: true, stockMinimo: true, stockMaximo: true },
  });
  const branches = [leoBranch, av135Branch];
  let stockEntriesCreated = 0;
  let stockEntriesSkipped = 0;

  function randomStockQuantity(min: number, max: number): number {
    let lo = min;
    let hi = Math.floor(max * 1.5);
    if (lo === 0 && hi === 0) {
      lo = 5;
      hi = 20;
    }
    lo = Math.max(3, lo);
    hi = Math.max(lo + 1, Math.min(hi, 50));
    return Math.floor(Math.random() * (hi - lo + 1)) + lo;
  }

  for (const sp of allSimpleProducts) {
    for (const branch of branches) {
      try {
        const existing = await prisma.stock.findUnique({
          where: { simpleProductId_branchId: { simpleProductId: sp.id, branchId: branch.id } },
        });
        if (existing) {
          stockEntriesSkipped++;
          continue;
        }

        const qty = randomStockQuantity(sp.stockMinimo, sp.stockMaximo);

        await prisma.$transaction([
          prisma.stock.create({
            data: {
              simpleProductId: sp.id,
              branchId: branch.id,
              quantity: qty,
            },
          }),
          prisma.inventoryMovement.create({
            data: {
              simpleProductId: sp.id,
              branchId: branch.id,
              quantity: qty,
              type: MovementType.PURCHASE_RECEIPT,
              userId: adminUser.id,
            },
          }),
        ]);
        stockEntriesCreated++;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`  ❌ Stock ${sp.codigo}/${branch.code}: ${msg}`);
      }
    }
  }

  console.log(
    `✅ Stock SimpleProducts: ${stockEntriesCreated} entradas creadas, ${stockEntriesSkipped} preexistentes.`,
  );

  // ── 8. Datos transaccionales (Fase P2 Sesión 2) ─────────────────────────────
  await seedTransactional(prisma);

  console.log('\n🎉 Seed completado exitosamente.\n');
  console.log('─── Usuarios disponibles ───────────────────────────');
  console.log('  admin@evobike.mx          → ADMIN    (LEO)');
  console.log('  manager.leo@evobike.mx    → MANAGER  (LEO)');
  console.log('  manager.av135@evobike.mx  → MANAGER  (AV135)');
  console.log('  vendedor.leo@evobike.mx   → SELLER   (LEO)');
  console.log('  vendedor.av135@evobike.mx → SELLER   (AV135)');
  console.log('  tecnico.leo@evobike.mx    → TECHNICIAN (LEO)');
  console.log('  tecnico.av135@evobike.mx  → TECHNICIAN (AV135)');
  console.log('  Contraseña de todos: evobike123');
  console.log('────────────────────────────────────────────────────\n');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });