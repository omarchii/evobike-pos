-- AlterTable
ALTER TABLE "ModeloConfiguracion" ADD COLUMN     "precioDistribuidor" DECIMAL(10,2),
ADD COLUMN     "precioDistribuidorConfirmado" BOOLEAN NOT NULL DEFAULT false;
