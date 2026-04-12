-- CreateEnum
CREATE TYPE "ModeloCategoria" AS ENUM ('BICICLETA', 'TRICICLO', 'SCOOTER', 'JUGUETE', 'CARGA');

-- AlterTable Modelo
ALTER TABLE "Modelo"
  ADD COLUMN "categoria" "ModeloCategoria" NOT NULL DEFAULT 'BICICLETA',
  ADD COLUMN "esBateria" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable Color
ALTER TABLE "Color"
  ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable Voltaje
ALTER TABLE "Voltaje"
  ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable ProductVariant (table is named ModeloConfiguracion via @@map)
ALTER TABLE "ModeloConfiguracion"
  ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

-- Flag the existing "Batería" model so it appears in the battery dropdown
UPDATE "Modelo" SET "esBateria" = true WHERE "nombre" = 'Batería';
