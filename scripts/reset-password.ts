/**
 * Reset password de un usuario específico sin tocar el resto de la data.
 *
 * Uso:
 *   npx tsx scripts/reset-password.ts <email> <newPassword>
 *
 * Ejemplos:
 *   npx tsx scripts/reset-password.ts admin@evobike.mx evobike123
 *   npx tsx scripts/reset-password.ts manager.leo@evobike.mx mipass2026
 *
 * Útil cuando se olvida una contraseña en dev sin querer correr `pnpm db:fresh`
 * (que wipea datos de prueba).
 */
import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const [email, newPassword] = process.argv.slice(2);

  if (!email || !newPassword) {
    console.error("Uso: npx tsx scripts/reset-password.ts <email> <newPassword>");
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`Usuario no encontrado: ${email}`);
    console.error("Usuarios existentes:");
    const all = await prisma.user.findMany({ select: { email: true, role: true } });
    for (const u of all) console.error(`  ${u.email} (${u.role})`);
    process.exit(1);
  }

  const hashed = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { email },
    data: { password: hashed },
  });

  console.log(`✓ Password reseteada para ${email} (${user.role})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
