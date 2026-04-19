import { PrismaClient, Prisma, SimpleProductCategoria, MovementType, ModeloCategoria } from '@prisma/client';
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
  const FRESH = process.env.FRESH_SEED === '1';
  console.log(
    FRESH
      ? '🌱 Iniciando seed FRESH (catálogo + stock=0, sin datos transaccionales)...\n'
      : '🌱 Iniciando seed de evobike-pos2...\n'
  );

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

  // Rename legacy: ECLIPSE → ECLIPCE (grafía canónica del catálogo Evobike).
  // Idempotente: no-op si ya se renombró.
  await prisma.modelo.updateMany({
    where: { nombre: 'ECLIPSE' },
    data: { nombre: 'ECLIPCE' },
  });

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

      const stockLeo = FRESH ? 0 : parseInt(row.stock_leo) || 0;
      const stockAv135 = FRESH ? 0 : parseInt(row.stock_av135) || 0;

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
  // Catálogo canónico Evobike (abril 2026, PDFs de referencia):
  //   - 12 capacidades distintas (Ah)
  //   - 18 configuraciones V×Ah
  //   - 1 modelo "BATERIA EVOBIKE" con 18 ProductVariants
  //   - ~87 filas BatteryConfiguration (modelo vehículo × voltaje × variante opción)
  console.log('\n⚡ Cargando catálogo canónico de baterías...');

  const genericColor = await prisma.color.upsert({
    where: { nombre: 'N/A' },
    update: { isGeneric: true },
    create: { nombre: 'N/A', isGeneric: true },
  });

  // 5a. Capacidades
  const CAPACIDADES_AH = [2.5, 7.8, 8, 10, 12, 13, 15, 20, 20.8, 23.4, 45, 52];
  const capacidadIdByAh = new Map<number, string>();
  for (const ah of CAPACIDADES_AH) {
    const nombre = `${ah}Ah`;
    const cap = await prisma.capacidad.upsert({
      where: { valorAh: ah },
      update: { nombre, isActive: true },
      create: { valorAh: ah, nombre },
    });
    capacidadIdByAh.set(ah, cap.id);
  }

  // 5b. Voltajes necesarios para baterías (24, 36, 48, 60, 72). El CSV ya los tiene;
  // este upsert garantiza que también estén si alguien corre sin regenerar CSV.
  const voltageValuesNeeded = [24, 36, 48, 60, 72];
  const voltajeIdByValue = new Map<number, string>();
  for (const v of voltageValuesNeeded) {
    const rec = await prisma.voltaje.upsert({
      where: { valor: v },
      update: { label: `${v} V` },
      create: { valor: v, label: `${v} V` },
    });
    voltajeIdByValue.set(v, rec.id);
  }

  // 5c. Soft-delete del modelo+variante legacy "Batería" / "BAT-12V-GEN".
  // Se preserva el registro (no se borra) para no romper BatteryLot/Battery históricos.
  await prisma.productVariant.updateMany({
    where: { sku: 'BAT-12V-GEN' },
    data: { isActive: false },
  });
  await prisma.modelo.updateMany({
    where: { nombre: 'Batería' },
    data: { isActive: false, categoria: null, esBateria: true },
  });

  // 5d. Modelo único "BATERIA EVOBIKE"
  const bateriaModelo = await prisma.modelo.upsert({
    where: { nombre: 'BATERIA EVOBIKE' },
    update: {
      esBateria: true,
      requiere_vin: false,
      categoria: null,
      isActive: true,
    },
    create: {
      nombre: 'BATERIA EVOBIKE',
      descripcion: 'Batería (catálogo canónico Evobike)',
      requiere_vin: false,
      esBateria: true,
      categoria: null,
    },
  });

  // 5e. 18 ProductVariants V×Ah. SKU: BAT-{V}V-{Ah}AH (punto → 'P' en SKU).
  const BATTERY_CONFIGS: Array<{ v: number; ah: number }> = [
    { v: 24, ah: 2.5 },
    { v: 24, ah: 20 },
    { v: 36, ah: 7.8 },
    { v: 36, ah: 8 },
    { v: 36, ah: 10 },
    { v: 36, ah: 12 },
    { v: 48, ah: 12 },
    { v: 48, ah: 13 },
    { v: 48, ah: 15 },
    { v: 48, ah: 20 },
    { v: 48, ah: 20.8 },
    { v: 48, ah: 23.4 },
    { v: 60, ah: 20 },
    { v: 60, ah: 45 },
    { v: 60, ah: 52 },
    { v: 72, ah: 20 },
    { v: 72, ah: 45 },
    { v: 72, ah: 52 },
  ];

  const batteryVariantIdByVAh = new Map<string, string>();
  for (const { v, ah } of BATTERY_CONFIGS) {
    const sku = `BAT-${v}V-${String(ah).replace('.', 'P')}AH`;
    const variant = await prisma.productVariant.upsert({
      where: { sku },
      update: { isActive: true, capacidad_id: capacidadIdByAh.get(ah)! },
      create: {
        sku,
        precioPublico: 0,
        costo: 0,
        modelo_id: bateriaModelo.id,
        color_id: genericColor.id,
        voltaje_id: voltajeIdByValue.get(v)!,
        capacidad_id: capacidadIdByAh.get(ah)!,
      },
    });
    batteryVariantIdByVAh.set(`${v}-${ah}`, variant.id);
  }
  console.log(`  ✅ ${CAPACIDADES_AH.length} capacidades, ${BATTERY_CONFIGS.length} variantes de batería.`);

  // 5f. Categorías por modelo (PDF "Configuraciones de Batería por Modelo y Categoría").
  const MODELO_CATEGORIAS: Record<string, ModeloCategoria> = {
    // JUGUETE
    'SCOOTER EVOKID': 'JUGUETE',
    FOXY: 'JUGUETE',
    'CROSS KID': 'JUGUETE',
    RICOCHET: 'JUGUETE',
    PHYTON: 'JUGUETE',
    // SCOOTER
    'SCOOTER M1': 'SCOOTER',
    'SCOOTER M2': 'SCOOTER',
    'SCOOTER M3': 'SCOOTER',
    'SCOOTER M4': 'SCOOTER',
    'SCOOTER M5': 'SCOOTER',
    'SCOOTER S6': 'SCOOTER',
    'SCOOTER S7': 'SCOOTER',
    // BASE
    NUBE: 'BASE',
    CIELO: 'BASE',
    VMPS5: 'BASE',
    VMPS6: 'BASE',
    'SOL PRO': 'BASE',
    SOL: 'BASE',
    PRIMAVERA: 'BASE',
    GALAXY: 'BASE',
    MOPED: 'BASE',
    COLORITA: 'BASE',
    LUMO: 'BASE',
    // PLUS
    TIGRE: 'PLUS',
    RAYO: 'PLUS',
    'RAYO PRO': 'PLUS',
    'GALAXY PLUS': 'PLUS',
    AGUILA: 'PLUS',
    'AGUILA PRO': 'PLUS',
    ECLIPCE: 'PLUS',
    AURORA: 'PLUS',
    'RYDER PRO': 'PLUS',
    REINA: 'PLUS',
    JAGUAR: 'PLUS',
    // CARGA
    URBEX: 'CARGA',
    TAURO: 'CARGA',
    LEO: 'CARGA',
    POLAR: 'CARGA',
    ZEUS: 'CARGA',
    // CARGA_PESADA
    CARGO: 'CARGA_PESADA',
    'EVOTANK 160': 'CARGA_PESADA',
    'EVOTANK 180': 'CARGA_PESADA',
    'EVOTANK 160 HIBRIDO': 'CARGA_PESADA',
    'EVOTANK 180 HIBRIDO': 'CARGA_PESADA',
    // TRICICLO
    'FAMILY Q': 'TRICICLO',
    'FAMILY Q PLUS': 'TRICICLO',
    FAMILY: 'TRICICLO',
    BEETLE: 'TRICICLO',
    GOLF: 'TRICICLO',
    'GOLF PLUS': 'TRICICLO',
    SOLARA: 'TRICICLO',
  };

  let categorizados = 0;
  let categoriaNotFound = 0;
  for (const [nombre, categoria] of Object.entries(MODELO_CATEGORIAS)) {
    const result = await prisma.modelo.updateMany({
      where: { nombre },
      data: { categoria },
    });
    if (result.count === 0) {
      console.warn(`  ⚠️  Modelo "${nombre}" no encontrado; categoría no aplicada.`);
      categoriaNotFound++;
    } else {
      categorizados += result.count;
    }
  }
  console.log(`  ✅ Categorías aplicadas: ${categorizados} modelos (${categoriaNotFound} faltantes).`);

  // 5g. BatteryConfiguration: reset + recrear desde el PDF.
  // Cada fila representa una opción válida. Modelos con múltiples opciones a mismo V
  // (p. ej. S7 48V con 13Ah y 23.4Ah) generan múltiples filas. `quantity` = nº de
  // baterías físicas que usa el vehículo por voltaje (casi siempre 1).
  type BatteryRow = { modelo: string; v: number; ah: number; qty: number };

  const QTY_FROM_VOLTAGE: Record<number, number> = { 24: 1, 36: 1, 48: 4, 60: 5, 72: 6 };
  const qty = (v: number) => QTY_FROM_VOLTAGE[v] ?? 1;

  const BATTERY_ROWS: BatteryRow[] = [
    // JUGUETE
    { modelo: 'SCOOTER EVOKID', v: 24, ah: 2.5, qty: qty(24) },
    { modelo: 'FOXY', v: 24, ah: 20, qty: qty(24) },
    { modelo: 'CROSS KID', v: 24, ah: 20, qty: qty(24) },
    { modelo: 'RICOCHET', v: 36, ah: 12, qty: qty(36) },
    { modelo: 'PHYTON', v: 36, ah: 12, qty: qty(36) },
    // SCOOTER
    { modelo: 'SCOOTER M3', v: 36, ah: 7.8, qty: qty(36) },
    { modelo: 'SCOOTER M5', v: 36, ah: 8, qty: qty(36) },
    { modelo: 'SCOOTER M4', v: 36, ah: 10, qty: qty(36) },
    { modelo: 'SCOOTER M1', v: 48, ah: 13, qty: qty(48) },
    { modelo: 'SCOOTER S7', v: 48, ah: 13, qty: qty(48) },
    { modelo: 'SCOOTER S7', v: 48, ah: 23.4, qty: qty(48) },
    { modelo: 'SCOOTER M2', v: 48, ah: 15, qty: qty(48) },
    { modelo: 'SCOOTER S6', v: 48, ah: 20.8, qty: qty(48) },
    // 48V 12Ah (Base)
    { modelo: 'NUBE', v: 48, ah: 12, qty: qty(48) },
    { modelo: 'CIELO', v: 48, ah: 12, qty: qty(48) },
    { modelo: 'VMPS5', v: 48, ah: 12, qty: qty(48) },
    { modelo: 'VMPS6', v: 48, ah: 12, qty: qty(48) },
    // 48V 20Ah
    { modelo: 'SOL PRO', v: 48, ah: 20, qty: qty(48) },
    { modelo: 'VMPS6', v: 48, ah: 20, qty: qty(48) },
    { modelo: 'SOL', v: 48, ah: 20, qty: qty(48) },
    { modelo: 'PRIMAVERA', v: 48, ah: 20, qty: qty(48) },
    { modelo: 'GALAXY', v: 48, ah: 20, qty: qty(48) },
    { modelo: 'MOPED', v: 48, ah: 20, qty: qty(48) },
    { modelo: 'COLORITA', v: 48, ah: 20, qty: qty(48) },
    { modelo: 'LUMO', v: 48, ah: 20, qty: qty(48) },
    { modelo: 'TAURO', v: 48, ah: 20, qty: qty(48) },
    { modelo: 'FAMILY Q', v: 48, ah: 20, qty: qty(48) },
    { modelo: 'BEETLE', v: 48, ah: 20, qty: qty(48) },
    // 60V 20Ah
    { modelo: 'TIGRE', v: 60, ah: 20, qty: qty(60) },
    { modelo: 'URBEX', v: 60, ah: 20, qty: qty(60) },
    { modelo: 'CARGO', v: 60, ah: 20, qty: qty(60) },
    { modelo: 'SOL', v: 60, ah: 20, qty: qty(60) },
    { modelo: 'PRIMAVERA', v: 60, ah: 20, qty: qty(60) },
    { modelo: 'GALAXY', v: 60, ah: 20, qty: qty(60) },
    { modelo: 'MOPED', v: 60, ah: 20, qty: qty(60) },
    { modelo: 'COLORITA', v: 60, ah: 20, qty: qty(60) },
    { modelo: 'LUMO', v: 60, ah: 20, qty: qty(60) },
    { modelo: 'TAURO', v: 60, ah: 20, qty: qty(60) },
    { modelo: 'FAMILY Q', v: 60, ah: 20, qty: qty(60) },
    { modelo: 'BEETLE', v: 60, ah: 20, qty: qty(60) },
    { modelo: 'RAYO', v: 60, ah: 20, qty: qty(60) },
    { modelo: 'RAYO PRO', v: 60, ah: 20, qty: qty(60) },
    { modelo: 'GALAXY PLUS', v: 60, ah: 20, qty: qty(60) },
    { modelo: 'AGUILA PRO', v: 60, ah: 20, qty: qty(60) },
    { modelo: 'ECLIPCE', v: 60, ah: 20, qty: qty(60) },
    { modelo: 'AURORA', v: 60, ah: 20, qty: qty(60) },
    { modelo: 'RYDER PRO', v: 60, ah: 20, qty: qty(60) },
    { modelo: 'REINA', v: 60, ah: 20, qty: qty(60) },
    { modelo: 'JAGUAR', v: 60, ah: 20, qty: qty(60) },
    { modelo: 'LEO', v: 60, ah: 20, qty: qty(60) },
    { modelo: 'POLAR', v: 60, ah: 20, qty: qty(60) },
    { modelo: 'ZEUS', v: 60, ah: 20, qty: qty(60) },
    { modelo: 'FAMILY Q PLUS', v: 60, ah: 20, qty: qty(60) },
    { modelo: 'GOLF', v: 60, ah: 20, qty: qty(60) },
    { modelo: 'GOLF PLUS', v: 60, ah: 20, qty: qty(60) },
    // 60V 45Ah / 52Ah (Evotank opción)
    { modelo: 'EVOTANK 160', v: 60, ah: 45, qty: qty(60) },
    { modelo: 'EVOTANK 180', v: 60, ah: 45, qty: qty(60) },
    { modelo: 'EVOTANK 160 HIBRIDO', v: 60, ah: 45, qty: qty(60) },
    { modelo: 'EVOTANK 180 HIBRIDO', v: 60, ah: 45, qty: qty(60) },
    { modelo: 'EVOTANK 160', v: 60, ah: 52, qty: qty(60) },
    { modelo: 'EVOTANK 180', v: 60, ah: 52, qty: qty(60) },
    { modelo: 'EVOTANK 160 HIBRIDO', v: 60, ah: 52, qty: qty(60) },
    { modelo: 'EVOTANK 180 HIBRIDO', v: 60, ah: 52, qty: qty(60) },
    // 72V 20Ah
    { modelo: 'SOLARA', v: 72, ah: 20, qty: qty(72) },
    { modelo: 'RAYO', v: 72, ah: 20, qty: qty(72) },
    { modelo: 'RAYO PRO', v: 72, ah: 20, qty: qty(72) },
    { modelo: 'GALAXY PLUS', v: 72, ah: 20, qty: qty(72) },
    { modelo: 'AGUILA PRO', v: 72, ah: 20, qty: qty(72) },
    { modelo: 'ECLIPCE', v: 72, ah: 20, qty: qty(72) },
    { modelo: 'AURORA', v: 72, ah: 20, qty: qty(72) },
    { modelo: 'RYDER PRO', v: 72, ah: 20, qty: qty(72) },
    { modelo: 'REINA', v: 72, ah: 20, qty: qty(72) },
    { modelo: 'JAGUAR', v: 72, ah: 20, qty: qty(72) },
    { modelo: 'LEO', v: 72, ah: 20, qty: qty(72) },
    { modelo: 'POLAR', v: 72, ah: 20, qty: qty(72) },
    { modelo: 'ZEUS', v: 72, ah: 20, qty: qty(72) },
    { modelo: 'FAMILY Q PLUS', v: 72, ah: 20, qty: qty(72) },
    { modelo: 'GOLF', v: 72, ah: 20, qty: qty(72) },
    { modelo: 'GOLF PLUS', v: 72, ah: 20, qty: qty(72) },
    // 72V 45Ah / 52Ah (Evotank opción)
    { modelo: 'EVOTANK 160', v: 72, ah: 45, qty: qty(72) },
    { modelo: 'EVOTANK 180', v: 72, ah: 45, qty: qty(72) },
    { modelo: 'EVOTANK 160 HIBRIDO', v: 72, ah: 45, qty: qty(72) },
    { modelo: 'EVOTANK 180 HIBRIDO', v: 72, ah: 45, qty: qty(72) },
    { modelo: 'EVOTANK 160', v: 72, ah: 52, qty: qty(72) },
    { modelo: 'EVOTANK 180', v: 72, ah: 52, qty: qty(72) },
    { modelo: 'EVOTANK 160 HIBRIDO', v: 72, ah: 52, qty: qty(72) },
    { modelo: 'EVOTANK 180 HIBRIDO', v: 72, ah: 52, qty: qty(72) },
  ];

  await prisma.batteryConfiguration.deleteMany({});

  let bcCreated = 0;
  let bcSkipped = 0;
  for (const row of BATTERY_ROWS) {
    const modelo = await prisma.modelo.findUnique({ where: { nombre: row.modelo } });
    const variantId = batteryVariantIdByVAh.get(`${row.v}-${row.ah}`);
    const voltajeId = voltajeIdByValue.get(row.v);
    if (!modelo || !variantId || !voltajeId) {
      console.warn(`  ⚠️  Saltando ${row.modelo} ${row.v}V/${row.ah}Ah — dependencia faltante.`);
      bcSkipped++;
      continue;
    }
    await prisma.batteryConfiguration.create({
      data: {
        modeloId: modelo.id,
        voltajeId,
        batteryVariantId: variantId,
        quantity: row.qty,
      },
    });
    bcCreated++;
  }
  console.log(`  ✅ BatteryConfiguration: ${bcCreated} filas creadas${bcSkipped ? ` (${bcSkipped} omitidas)` : ''}.`);

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
  if (FRESH) {
    console.log('\n📊 FRESH: se omite stock inicial de SimpleProducts (quedan sin stock).');
  } else {
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
  }

  // ── 8. Datos transaccionales (Fase P2 Sesión 2) ─────────────────────────────
  if (FRESH) {
    console.log('\n⏭️  FRESH: se omiten datos transaccionales (ventas, pedidos, órdenes, etc.).');
  } else {
    await seedTransactional(prisma);
  }

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