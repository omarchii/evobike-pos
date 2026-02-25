import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    // 1. Create Branches
    const leoBranch = await prisma.branch.upsert({
        where: { code: 'LEO' },
        update: {},
        create: {
            code: 'LEO',
            name: 'Sucursal Leo',
            address: 'Cancún, Q.R. Leo',
        },
    })

    const av135Branch = await prisma.branch.upsert({
        where: { code: 'AV135' },
        update: {},
        create: {
            code: 'AV135',
            name: 'Sucursal Av 135',
            address: 'Cancún, Q.R. Av 135',
        },
    })

    // 2. Create Admin User
    const adminUser = await prisma.user.upsert({
        where: { email: 'admin@evobike.mx' },
        update: {},
        create: {
            name: 'Admin General',
            email: 'admin@evobike.mx',
            password: 'hased_pwd_placeholder', // TODO: Implement bcrypt hash
            role: 'ADMIN',
            branchId: leoBranch.id, // Admin can switch branches in UI
        },
    })

    // 3. Create Demo Customer
    const demoCustomer = await prisma.customer.upsert({
        where: { phone: '9981234567' },
        update: {},
        create: {
            name: 'Cliente Mostrador',
            phone: '9981234567',
            email: 'cliente@evobike.mx',
            creditLimit: 0,
            balance: 0,
        }
    })

    // 4. Create an Edge-Case Product (Serialized Scooter)
    const scooter = await prisma.product.upsert({
        where: { sku: 'SCOOTER-M365' },
        update: {},
        create: {
            sku: 'SCOOTER-M365',
            name: 'Xiaomi Scooter M365',
            price: 8500.00,
            cost: 6000.00,
            isSerialized: true,
            stocks: {
                create: [
                    { branchId: leoBranch.id, quantity: 5 },
                    { branchId: av135Branch.id, quantity: 2 }
                ]
            }
        }
    })

    // 5. Create a standard product (Refacción)
    const tire = await prisma.product.upsert({
        where: { sku: 'TIRE-8.5' },
        update: {},
        create: {
            sku: 'TIRE-8.5',
            name: 'Llanta 8.5 para Scooter',
            price: 350.00,
            cost: 120.00,
            isSerialized: false,
            stocks: {
                create: [
                    { branchId: leoBranch.id, quantity: 20 },
                    { branchId: av135Branch.id, quantity: 15 }
                ]
            }
        }
    })

    console.log('Seed executed successfully!')
    console.log({ leoBranch, av135Branch, adminUser, scooter, tire })
}

main()
    .then(async () => {
        await prisma.$disconnect()
    })
    .catch(async (e) => {
        console.error(e)
        await prisma.$disconnect()
        process.exit(1)
    })
