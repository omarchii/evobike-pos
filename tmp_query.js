const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
    console.log('Users:', await prisma.user.findMany());
    console.log('Branches:', await prisma.branch.findMany());
}
main().then(() => prisma.$disconnect());
