-- AlterTable
ALTER TABLE "Color" ADD COLUMN     "isGeneric" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "BatteryConfiguration" (
    "id" TEXT NOT NULL,
    "modeloId" TEXT NOT NULL,
    "voltajeId" TEXT NOT NULL,
    "batteryProductId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "BatteryConfiguration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BatteryLot" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "supplier" TEXT,
    "reference" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,

    CONSTRAINT "BatteryLot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Battery" (
    "id" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "status" "BatteryStatus" NOT NULL DEFAULT 'IN_STOCK',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Battery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssemblyOrder" (
    "id" TEXT NOT NULL,
    "customerBikeId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "status" "AssemblyStatus" NOT NULL DEFAULT 'PENDING',
    "assembledByUserId" TEXT,
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssemblyOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BatteryAssignment" (
    "id" TEXT NOT NULL,
    "batteryId" TEXT NOT NULL,
    "customerBikeId" TEXT NOT NULL,
    "assemblyOrderId" TEXT,
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedByUserId" TEXT NOT NULL,
    "installedAtVoltageChangeId" TEXT,
    "unassignedAt" TIMESTAMP(3),
    "unassignedByUserId" TEXT,
    "removedAtVoltageChangeId" TEXT,
    "notes" TEXT,

    CONSTRAINT "BatteryAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BatteryConfiguration_modeloId_voltajeId_batteryProductId_key" ON "BatteryConfiguration"("modeloId", "voltajeId", "batteryProductId");

-- CreateIndex
CREATE UNIQUE INDEX "Battery_serialNumber_key" ON "Battery"("serialNumber");

-- AddForeignKey
ALTER TABLE "BatteryConfiguration" ADD CONSTRAINT "BatteryConfiguration_modeloId_fkey" FOREIGN KEY ("modeloId") REFERENCES "Modelo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BatteryConfiguration" ADD CONSTRAINT "BatteryConfiguration_voltajeId_fkey" FOREIGN KEY ("voltajeId") REFERENCES "Voltaje"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BatteryConfiguration" ADD CONSTRAINT "BatteryConfiguration_batteryProductId_fkey" FOREIGN KEY ("batteryProductId") REFERENCES "ModeloConfiguracion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BatteryLot" ADD CONSTRAINT "BatteryLot_productId_fkey" FOREIGN KEY ("productId") REFERENCES "ModeloConfiguracion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BatteryLot" ADD CONSTRAINT "BatteryLot_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BatteryLot" ADD CONSTRAINT "BatteryLot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Battery" ADD CONSTRAINT "Battery_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "BatteryLot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Battery" ADD CONSTRAINT "Battery_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssemblyOrder" ADD CONSTRAINT "AssemblyOrder_customerBikeId_fkey" FOREIGN KEY ("customerBikeId") REFERENCES "CustomerBike"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssemblyOrder" ADD CONSTRAINT "AssemblyOrder_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssemblyOrder" ADD CONSTRAINT "AssemblyOrder_assembledByUserId_fkey" FOREIGN KEY ("assembledByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BatteryAssignment" ADD CONSTRAINT "BatteryAssignment_batteryId_fkey" FOREIGN KEY ("batteryId") REFERENCES "Battery"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BatteryAssignment" ADD CONSTRAINT "BatteryAssignment_customerBikeId_fkey" FOREIGN KEY ("customerBikeId") REFERENCES "CustomerBike"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BatteryAssignment" ADD CONSTRAINT "BatteryAssignment_assignedByUserId_fkey" FOREIGN KEY ("assignedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BatteryAssignment" ADD CONSTRAINT "BatteryAssignment_unassignedByUserId_fkey" FOREIGN KEY ("unassignedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BatteryAssignment" ADD CONSTRAINT "BatteryAssignment_installedAtVoltageChangeId_fkey" FOREIGN KEY ("installedAtVoltageChangeId") REFERENCES "VoltageChangeLog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BatteryAssignment" ADD CONSTRAINT "BatteryAssignment_removedAtVoltageChangeId_fkey" FOREIGN KEY ("removedAtVoltageChangeId") REFERENCES "VoltageChangeLog"("id") ON DELETE SET NULL ON UPDATE CASCADE;
