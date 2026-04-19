-- AlterEnum
ALTER TYPE "ModeloCategoria" ADD VALUE IF NOT EXISTS 'CARGA_PESADA';
ALTER TYPE "ModeloCategoria" ADD VALUE IF NOT EXISTS 'BASE';
ALTER TYPE "ModeloCategoria" ADD VALUE IF NOT EXISTS 'PLUS';

-- DropIndex
DROP INDEX "ModeloConfiguracion_modelo_id_color_id_voltaje_id_key";

-- AlterTable
ALTER TABLE "Modelo" ALTER COLUMN "categoria" DROP NOT NULL,
ALTER COLUMN "categoria" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ModeloConfiguracion" ADD COLUMN     "capacidad_id" TEXT;

-- CreateTable
CREATE TABLE "Capacidad" (
    "id" TEXT NOT NULL,
    "valorAh" DOUBLE PRECISION NOT NULL,
    "nombre" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Capacidad_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Capacidad_valorAh_key" ON "Capacidad"("valorAh");

-- CreateIndex
CREATE UNIQUE INDEX "ModeloConfiguracion_modelo_id_color_id_voltaje_id_capacidad_key" ON "ModeloConfiguracion"("modelo_id", "color_id", "voltaje_id", "capacidad_id");

-- AddForeignKey
ALTER TABLE "ModeloConfiguracion" ADD CONSTRAINT "ModeloConfiguracion_capacidad_id_fkey" FOREIGN KEY ("capacidad_id") REFERENCES "Capacidad"("id") ON DELETE SET NULL ON UPDATE CASCADE;
