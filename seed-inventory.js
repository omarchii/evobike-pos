const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// EDIT THIS ARRAY WITH YOUR MASSIVE PRODUCT LIST
// You can also require a JSON file here if you prefer: const productsToSeed = require('./my-inventory.json');
const productsToSeed = [
    {
        sku: "EVO-SCOOT-PRO",
        name: "Scooter Eléctrico Pro",
        price: 15999.00,
        cost: 10000.00,
        isSerialized: true,
        // quantities to distribute for each branch
        stockLeo: 5,
        stockAv135: 3
    },
    {
        sku: "PART-BRAKE-01",
        name: "Balatas Traseras EVOBIKE",
        price: 350.00,
        cost: 120.00,
        isSerialized: false,
        stockLeo: 20,
        stockAv135: 15
    },
    // ADD MORE ROWS HERE...
];

async function main() {
    console.log("Iniciando migración masiva de inventario...");

    // 1. Get branches to link stocks
    const branchLeo = await prisma.branch.findUnique({ where: { code: 'LEO' } });
    const branchAv135 = await prisma.branch.findUnique({ where: { code: 'AV135' } });

    if (!branchLeo || !branchAv135) {
        throw new Error("No se encontraron las sucursales iniciales (LEO y AV135). Por favor corre el seed inicial primero.");
    }

    let totalProductsAdded = 0;
    let totalStockRows = 0;

    for (const item of productsToSeed) {
        // Check if product exists to avoid duplicates
        const existing = await prisma.product.findUnique({ where: { sku: item.sku } });
        if (existing) {
            console.log(`El producto ${item.sku} ya existe. Omitiendo...`);
            continue;
        }

        // 2. Insert Product
        const newProduct = await prisma.product.create({
            data: {
                sku: item.sku,
                name: item.name,
                price: item.price,
                cost: item.cost,
                isSerialized: item.isSerialized
            }
        });

        totalProductsAdded++;

        // 3. Setup Initial Stock for LEO
        if (item.stockLeo !== undefined) {
            await prisma.stock.create({
                data: {
                    productId: newProduct.id,
                    branchId: branchLeo.id,
                    quantity: item.stockLeo
                }
            });
            totalStockRows++;
        }

        // 4. Setup Initial Stock for AV135
        if (item.stockAv135 !== undefined) {
            await prisma.stock.create({
                data: {
                    productId: newProduct.id,
                    branchId: branchAv135.id,
                    quantity: item.stockAv135
                }
            });
            totalStockRows++;
        }

        console.log(`✅ Creado: ${item.name} (${item.sku}) con stock inicial.`);
    }

    console.log("-----------------------------------------");
    console.log("Migración Completada Exitosamente!");
    console.log(`Productos añadidos al catálogo: ${totalProductsAdded}`);
    console.log(`Registros de almacén generados: ${totalStockRows}`);
    console.log("-----------------------------------------");
}

main()
    .catch((e) => {
        console.error("Error durante la migración:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
