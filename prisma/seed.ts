import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// Helper para parsear CSV manual simple
function parseCSV(filePath: string): any[] {
    if (!fs.existsSync(filePath)) {
        console.warn(`Archivo no encontrado: ${filePath}`);
        return [];
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim() !== '');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').replace(/^\uFEFF/, '')); // Remove BOM just in case
    const rows = [];

    for (let i = 1; i < lines.length; i++) {
        const rawValues = lines[i].match(/(?:\"([^\"]*(?:\"\"[^\"]*)*)\")|([^\,]+)/g);
        if(!rawValues) continue;

        const values = rawValues.map(v => {
            let val = v.trim();
            if (val.startsWith('"') && val.endsWith('"')) {
                val = val.substring(1, val.length - 1).replace(/""/g, '"');
            }
            return val;
        });

        const row: any = {};
        headers.forEach((header, index) => {
            row[header] = values[index] !== undefined ? values[index] : '';
        });
        rows.push(row);
    }
    return rows;
}

async function main() {
    console.log("Iniciando Seed de la base de datos Normalizada desde archivos CSV...");

    const dataDir = path.join(process.cwd(), 'prisma', 'data');
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir);
        console.log("Directorio 'data' creado. Por favor, coloca tus CSV...");
    }

    // Asegurar sucursales básicas
    const leoBranch = await prisma.branch.upsert({
        where: { code: 'LEO' },
        update: {},
        create: { code: 'LEO', name: 'Sucursal Leo', address: 'Cancún, Q.R. Leo' },
    });
    
    const av135Branch = await prisma.branch.upsert({
        where: { code: 'AV135' },
        update: {},
        create: { code: 'AV135', name: 'Sucursal Av 135', address: 'Cancún, Q.R. Av 135' },
    });

    // 0. Diccionarios de Resolución
    const modelosMap = new Map<string, string>(); // csv_id -> db_id
    const coloresMap = new Map<string, string>();
    const voltajesMap = new Map<string, string>();

    // 1. Modelos Base
    const modelosCSV = parseCSV(path.join(dataDir, 'modelos.csv'));
    for (const row of modelosCSV) {
        if (!row.nombre) continue;
        const dbModelo = await prisma.modelo.upsert({
            where: { nombre: row.nombre },
            update: { descripcion: row.descripcion || null, requiere_vin: row.requiere_vin?.toLowerCase() === 'verdadero' || row.requiere_vin?.toLowerCase() === 'true' },
            create: {
                nombre: row.nombre,
                descripcion: row.descripcion || null,
                requiere_vin: row.requiere_vin?.toLowerCase() !== 'falso' && row.requiere_vin?.toLowerCase() !== 'false',
            }
        });
        if (row.id) modelosMap.set(row.id.toString(), dbModelo.id);
    }

    // 2. Colores
    const coloresCSV = parseCSV(path.join(dataDir, 'colores.csv'));
    for (const row of coloresCSV) {
        if (!row.nombre) continue;
        const dbColor = await prisma.color.upsert({
            where: { nombre: row.nombre },
            update: {},
            create: { nombre: row.nombre }
        });
        if (row.id) coloresMap.set(row.id.toString(), dbColor.id);
    }

    // 3. Voltajes
    const voltajesCSV = parseCSV(path.join(dataDir, 'voltajes.csv'));
    for (const row of voltajesCSV) {
        if (!row.valor) continue;
        const valorInt = parseInt(row.valor);
        if (isNaN(valorInt)) continue;

        const dbVoltaje = await prisma.voltaje.upsert({
            where: { valor: valorInt },
            update: { label: row.label || `${valorInt}V` },
            create: { valor: valorInt, label: row.label || `${valorInt}V` }
        });
        if (row.id) voltajesMap.set(row.id.toString(), dbVoltaje.id);
    }

    console.log(`Catálogos base procesados (Modelos: ${modelosMap.size}, Colores: ${coloresMap.size}, Voltajes: ${voltajesMap.size}).`);

    // 4. Disponibles
    const disponiblesCSV = parseCSV(path.join(dataDir, 'modelo_color_disponible.csv'));
    for (const row of disponiblesCSV) {
        if(!row.modelo_id || !row.color_id) continue;
        const modeloId = modelosMap.get(row.modelo_id.toString());
        const colorId = coloresMap.get(row.color_id.toString());
        
        if(modeloId && colorId) {
            try {
                await prisma.modeloColor.create({
                    data: { modelo_id: modeloId, color_id: colorId }
                });
            } catch(e) { /* Ignorar duplicate */ }
        }
    }

    // 5. Configuraciones Finales
    const configuracionesCSV = parseCSV(path.join(dataDir, 'modelo_configuracion.csv'));
    let configsCreated = 0;
    for (const row of configuracionesCSV) {
        if(!row.sku || !row.modelo_id || !row.color_id || !row.voltaje_id) continue;

        const modeloId = modelosMap.get(row.modelo_id.toString());
        const colorId = coloresMap.get(row.color_id.toString());
        const voltajeId = voltajesMap.get(row.voltaje_id.toString());

        if(!modeloId || !colorId || !voltajeId) {
            console.warn(`Saltando SKU ${row.sku} por dependencias faltantes: Modelo ${row.modelo_id}->${modeloId}, Color ${row.color_id}->${colorId}, Voltaje ${row.voltaje_id}->${voltajeId}`);
            continue;
        }

        try {
            const configuracion = await prisma.productVariant.upsert({
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
                    voltaje_id: voltajeId
                }
            });
            configsCreated++;

            // Actualizar Stock
            const stockLeo = parseInt(row.stock_leo) || 0;
            const stockAv135 = parseInt(row.stock_av135) || 0;

            await prisma.stock.upsert({
                where: { productVariantId_branchId: { productVariantId: configuracion.id, branchId: leoBranch.id } },
                update: { quantity: stockLeo },
                create: { productVariantId: configuracion.id, branchId: leoBranch.id, quantity: stockLeo }
            });

            await prisma.stock.upsert({
                where: { productVariantId_branchId: { productVariantId: configuracion.id, branchId: av135Branch.id } },
                update: { quantity: stockAv135 },
                create: { productVariantId: configuracion.id, branchId: av135Branch.id, quantity: stockAv135 }
            });
        } catch (e: any) {
            if (e.code === 'P2002') {
                console.warn(`Saltando SKU ${row.sku} por combinación duplicada (Modelo+Color+Voltaje).`);
            } else {
                console.error(`Error procesando SKU ${row.sku}:`, e.message);
            }
        }
    }

    console.log(`¡Seed de CSV Finalizado! Configuraciones cargadas: ${configsCreated}`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
